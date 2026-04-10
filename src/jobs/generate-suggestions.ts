import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '../lib/supabase.js';
import {
  getCampaignCreativeSummary,
  getSearchTermsByCampaign,
} from '../services/supabase-creatives.service.js';

// ============================================
// Generate Suggestions Job
// ============================================
//
// Analyseert actieve campagnes en genereert verbetervoorstellen:
//
//   1. Zoektermen met hoge spend en weinig/geen conversies
//      → negatief keyword voorstel
//   2. Creative content analyse door Claude
//      → headline/description verbeteringen
//
// Draai met: npm run generate-suggestions

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface RawSuggestion {
  type: 'headline_change' | 'description_change' | 'add_negative_keyword' | 'new_headline' | 'new_description';
  current_value?: string;
  suggested_value?: string;
  reasoning: string;
  priority: 'high' | 'medium' | 'low';
}

// --------------------------------------------
// Zoekterm analyse (rule-based, geen AI nodig)
// --------------------------------------------

async function analyzeSearchTerms(
  campaignId: string,
  tenantId: string,
): Promise<RawSuggestion[]> {
  const terms = await getSearchTermsByCampaign(campaignId, 30);
  const suggestions: RawSuggestion[] = [];

  for (const term of terms) {
    const spend = Number(term.spend);
    const conversions = Number(term.conversions);
    const clicks = Number(term.clicks);

    // Hoge spend, 0 conversies → negatief keyword
    if (spend > 5 && conversions === 0) {
      suggestions.push({
        type: 'add_negative_keyword',
        current_value: term.search_term,
        reasoning: `Zoekterm "${term.search_term}" heeft €${spend.toFixed(2)} uitgegeven met ${clicks} klikken maar 0 conversies in de afgelopen 30 dagen.`,
        priority: spend > 15 ? 'high' : spend > 8 ? 'medium' : 'low',
      });
    }
  }

  return suggestions;
}

// --------------------------------------------
// Creative analyse (AI-powered)
// --------------------------------------------

async function analyzeCreatives(
  campaignId: string,
  campaignName: string,
  tenantId: string,
): Promise<RawSuggestion[]> {
  const summary = await getCampaignCreativeSummary(campaignId);

  // Skip als er geen content is
  if (!summary || summary.trim().length < 50) return [];

  const prompt = `Je bent een Google Ads specialist. Analyseer de volgende campagne-content en geef concrete verbetervoorstellen.

CAMPAGNE:
${summary}

Geef je suggesties als een JSON array. Elk object heeft deze velden:
- "type": "headline_change" | "description_change" | "new_headline" | "new_description"
- "current_value": de huidige tekst (alleen bij changes, niet bij new)
- "suggested_value": je voorgestelde verbetering
- "reasoning": korte uitleg waarom (1-2 zinnen, in het Nederlands)
- "priority": "high" | "medium" | "low"

Richtlijnen:
- Focus op de belangrijkste verbeteringen (max 5 suggesties per campagne)
- Headlines: max 30 tekens, pakkend, met USP of call-to-action
- Descriptions: max 90 tekens, informatief, met voordelen
- Vermijd generieke teksten — maak het specifiek voor deze campagne
- Stel alleen verbeteringen voor die echt impact maken
- Als de content al goed is, geef dan een lege array []

Antwoord ALLEEN met de JSON array, geen andere tekst.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content.find((b) => b.type === 'text');
    if (!text || text.type !== 'text') return [];

    // Parse JSON uit de response (strip eventuele markdown code blocks)
    let jsonStr = text.text.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const parsed = JSON.parse(jsonStr) as RawSuggestion[];
    if (!Array.isArray(parsed)) return [];

    return parsed.slice(0, 5); // max 5 per campagne
  } catch (err) {
    console.warn(`  ! AI analyse mislukt voor ${campaignName}:`, err instanceof Error ? err.message : err);
    return [];
  }
}

// --------------------------------------------
// Main
// --------------------------------------------

async function main() {
  console.log('\n[suggestions] Suggesties generatie gestart\n');

  // Haal actieve campagnes op
  const { data: campaigns, error } = await supabase
    .from('campaigns')
    .select('id, tenant_id, name, status')
    .eq('status', 'active');

  if (error) throw new Error(`Campaigns ophalen mislukt: ${error.message}`);
  if (!campaigns?.length) {
    console.log('  Geen actieve campagnes gevonden.');
    return;
  }

  console.log(`  ${campaigns.length} actieve campagnes gevonden\n`);

  let totalSuggestions = 0;

  for (const campaign of campaigns) {
    console.log(`  → ${campaign.name}`);

    // 1. Zoekterm analyse
    const searchTermSuggestions = await analyzeSearchTerms(campaign.id, campaign.tenant_id);

    // 2. Creative analyse
    const creativeSuggestions = await analyzeCreatives(campaign.id, campaign.name, campaign.tenant_id);

    const allSuggestions = [...searchTermSuggestions, ...creativeSuggestions];

    if (allSuggestions.length === 0) {
      console.log(`    Geen suggesties.`);
      continue;
    }

    // Opslaan in database
    const rows = allSuggestions.map((s) => ({
      tenant_id: campaign.tenant_id,
      campaign_id: campaign.id,
      type: s.type,
      current_value: s.current_value ?? null,
      suggested_value: s.suggested_value ?? null,
      reasoning: s.reasoning,
      priority: s.priority,
      status: 'pending',
    }));

    const { error: insertErr } = await supabase
      .from('suggestions')
      .insert(rows);

    if (insertErr) {
      console.warn(`    ! Opslaan mislukt: ${insertErr.message}`);
    } else {
      console.log(`    ✓ ${allSuggestions.length} suggesties (${searchTermSuggestions.length} zoektermen, ${creativeSuggestions.length} creative)`);
      totalSuggestions += allSuggestions.length;
    }
  }

  console.log(`\n[suggestions] Klaar — ${totalSuggestions} suggesties gegenereerd.\n`);
}

main().catch((err) => {
  console.error('[suggestions] Mislukt:', err);
  process.exit(1);
});
