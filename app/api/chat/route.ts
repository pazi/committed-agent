import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '../../../src/lib/supabase-server';
import {
  getCampaignPerformance,
  getAdGroupPerformance,
  getDevicePerformance,
  getDateTrend,
  type QueryFilters,
} from '../../../src/services/bigquery.service';
import {
  getCreativeAssetsByCampaign,
  getSearchTermsByCampaign,
  getCampaignCreativeSummary,
} from '../../../src/services/supabase-creatives.service';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Je bent een ervaren online marketing specialist en campagne-optimalisatie expert. Je werkt voor een marketingbureau en helpt campagnemanagers met het optimaliseren van online advertising campagnes over meerdere platformen (Google Ads, Facebook Ads, LinkedIn Ads, Reddit Ads).

Je hebt toegang tot live campagnedata via tools. Gebruik deze tools om data op te halen voordat je advies geeft.

BELANGRIJK — Je antwoord wordt op twee plekken getoond:
1. Het VOLLEDIGE antwoord (met tabellen, data, analyse) verschijnt automatisch in het canvas-paneel links op de pagina.
2. De gebruiker ziet in de chat alleen wat er NA de separator "---" staat.

Structureer je antwoord ALTIJD exact zo:

<volledige data-analyse met tabellen, KPI's, aanbevelingen — dit verschijnt in het canvas>

---

<korte chat-tekst, max 1-2 zinnen, bijv: "De analyse staat in het canvas. Wat wil je nu doen?">

- <Vervolgactie 1, bijv: Inzoomen op campagne X>
- <Vervolgactie 2, bijv: Device performance bekijken>
- <Vervolgactie 3, bijv: Slecht presterende ad groups pauzeren>

Belangrijk over vervolgacties:
- Schrijf de actie ZONDER vierkante haken eromheen
- Schrijf de actie ZONDER vraagteken erachter
- Maak ze direct en imperatief, alsof het een knop is
- Geef altijd 2-4 vervolgacties
- Schrijf NIET het woord "VERVOLGACTIES:" of "Vervolgacties:" — alleen de bullets

Richtlijnen voor de analyse:
- Data bevat een 'platform' kolom — vermeld altijd welk platform bij welke campagne hoort
- Bereken en toon altijd relevante KPI's: CTR, CPC, CPM, ROAS
- Gebruik markdown tabellen voor overzichten
- Identificeer slecht presterende onderdelen en geef concrete actie-suggesties
- Prioriteer suggesties op verwachte impact
- Denk aan: pacing, bereik, performance trends
- Antwoord altijd in het Nederlands
- Wees direct en concreet, geen vage adviezen

GRAFIEKEN:
Je kunt grafieken renderen door een markdown code block met taal "chart" te gebruiken. Het is een JSON object:

\`\`\`chart
{
  "type": "bar",
  "title": "Spend per platform",
  "data": [
    {"name": "Google Ads", "value": 1234.56},
    {"name": "Facebook", "value": 567.89}
  ]
}
\`\`\`

Chart types:
- "bar" — staafdiagram (gebruik xKey + yKeys voor multi-bar, of name+value voor simpel)
- "line" — lijndiagram (handig voor trends over tijd)
- "area" — vlakdiagram (zelfde als line maar gevuld)
- "pie" — taartdiagram (gebruik nameKey + valueKey)

Voorbeelden:

Multi-series bar chart:
\`\`\`chart
{"type":"bar","title":"Performance per platform","xKey":"platform","yKeys":["clicks","conversions"],"data":[{"platform":"Google","clicks":120,"conversions":5},{"platform":"Facebook","clicks":80,"conversions":3}]}
\`\`\`

Trend line:
\`\`\`chart
{"type":"line","title":"Spend trend","xKey":"date","yKeys":["spend"],"data":[{"date":"2026-04-01","spend":120},{"date":"2026-04-02","spend":135}]}
\`\`\`

Pie chart:
\`\`\`chart
{"type":"pie","title":"Budget verdeling","nameKey":"name","valueKey":"value","data":[{"name":"Google","value":60},{"name":"Facebook","value":30},{"name":"LinkedIn","value":10}]}
\`\`\`

Gebruik grafieken proactief om data inzichtelijk te maken — vooral bij vergelijkingen, trends, en verdelingen. Toon eerst de grafiek, dan een korte tekstuele analyse.

CREATIVE CONTENT ANALYSE:
Je hebt ook toegang tot creative content data (headlines, descriptions, assets) en zoektermen. Gebruik deze tools wanneer de gebruiker vraagt over:
- Advertentieteksten, headlines, descriptions, uitingen
- Creative performance, welke assets goed/slecht presteren
- Zoektermen, search queries, negatieve keywords

Performance labels interpreteren:
- BEST = top performer, behouden en meer inzetten
- GOOD = solide, geen actie nodig
- LOW = slecht presterend, vervangen of pauzeren
- LEARNING = te nieuw om te beoordelen, afwachten
- PENDING/UNRATED = onvoldoende data

Bij verbetervoorstellen:
- Toon altijd de huidige tekst en je voorgestelde verbetering (before/after)
- Leg uit WAAROM de verbetering beter zou zijn (specifiek, niet vaag)
- Baseer suggesties op performance data, niet op gevoel`;

const tools: Anthropic.Tool[] = [
  {
    name: 'get_campaigns',
    description: 'Haal een overzicht op van alle campagnes met geaggregeerde performance metrics (impressions, clicks, cost, conversions, CTR, CPC, CPM, ROAS). Data bevat campagnes van alle actieve platformen (Google Ads, Facebook, LinkedIn, Reddit). Standaard over de afgelopen 30 dagen.',
    input_schema: {
      type: 'object' as const,
      properties: {
        days: { type: 'number', description: 'Aantal dagen terug (standaard 30)' },
      },
      required: [],
    },
  },
  {
    name: 'get_adgroup_performance',
    description: 'Haal performance metrics op per ad group (advertentiegroep) voor een specifieke campagne. Geeft impressions, clicks, cost, conversions, CTR, CPC, CPM, ROAS per ad group.',
    input_schema: {
      type: 'object' as const,
      properties: {
        campaign_id: { type: 'string', description: 'Het campaign ID' },
        days: { type: 'number', description: 'Aantal dagen terug (standaard 30)' },
      },
      required: ['campaign_id'],
    },
  },
  {
    name: 'get_device_breakdown',
    description: 'Haal performance metrics op per device (desktop, mobile, tablet) voor een specifieke campagne.',
    input_schema: {
      type: 'object' as const,
      properties: {
        campaign_id: { type: 'string', description: 'Het campaign ID' },
        days: { type: 'number', description: 'Aantal dagen terug (standaard 30)' },
      },
      required: ['campaign_id'],
    },
  },
  {
    name: 'get_date_trend',
    description: 'Haal dagelijkse performance trends op voor een specifieke campagne. Handig om pacing en trends te analyseren.',
    input_schema: {
      type: 'object' as const,
      properties: {
        campaign_id: { type: 'string', description: 'Het campaign ID' },
        days: { type: 'number', description: 'Aantal dagen terug (standaard 30)' },
      },
      required: ['campaign_id'],
    },
  },
  {
    name: 'get_creative_content',
    description: 'Haal creative assets op (headlines, descriptions, images, videos) voor een campagne uit Supabase, inclusief performance labels van het platform. Gebruik dit om advertentieteksten te analyseren en verbetervoorstellen te doen.',
    input_schema: {
      type: 'object' as const,
      properties: {
        campaign_id: { type: 'string', description: 'Het Supabase campaign UUID' },
      },
      required: ['campaign_id'],
    },
  },
  {
    name: 'get_search_terms',
    description: 'Haal zoektermen op voor een campagne met performance data (impressions, clicks, spend, conversions). Handig om negatieve keywords te identificeren of nieuwe keyword-kansen te vinden.',
    input_schema: {
      type: 'object' as const,
      properties: {
        campaign_id: { type: 'string', description: 'Het Supabase campaign UUID' },
        days: { type: 'number', description: 'Aantal dagen terug (standaard 30)' },
      },
      required: ['campaign_id'],
    },
  },
  {
    name: 'get_creative_summary',
    description: 'Haal een compacte samenvatting op van alle creatives en assets voor een campagne. Geeft een leesbaar overzicht in plaats van ruwe data — handig als startpunt voor analyse.',
    input_schema: {
      type: 'object' as const,
      properties: {
        campaign_id: { type: 'string', description: 'Het Supabase campaign UUID' },
      },
      required: ['campaign_id'],
    },
  },
];

let activeFilters: QueryFilters = {};

async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
  switch (name) {
    case 'get_campaigns': {
      const data = await getCampaignPerformance((input.days as number) ?? 30, activeFilters);
      return JSON.stringify(data, null, 2);
    }
    case 'get_adgroup_performance': {
      const data = await getAdGroupPerformance(
        input.campaign_id as string,
        (input.days as number) ?? 30,
        activeFilters,
      );
      return JSON.stringify(data, null, 2);
    }
    case 'get_device_breakdown': {
      const data = await getDevicePerformance(
        input.campaign_id as string,
        (input.days as number) ?? 30,
        activeFilters,
      );
      return JSON.stringify(data, null, 2);
    }
    case 'get_date_trend': {
      const data = await getDateTrend(
        input.campaign_id as string,
        (input.days as number) ?? 30,
        activeFilters,
      );
      return JSON.stringify(data, null, 2);
    }
    case 'get_creative_content': {
      const data = await getCreativeAssetsByCampaign(input.campaign_id as string);
      return JSON.stringify(data, null, 2);
    }
    case 'get_search_terms': {
      const data = await getSearchTermsByCampaign(
        input.campaign_id as string,
        (input.days as number) ?? 30,
      );
      return JSON.stringify(data, null, 2);
    }
    case 'get_creative_summary': {
      const summary = await getCampaignCreativeSummary(input.campaign_id as string);
      return summary;
    }
    default:
      return JSON.stringify({ error: `Onbekende tool: ${name}` });
  }
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(request: Request) {
  try {
    const { messages, accountIds, platforms, dateFrom, dateTo, compareDateFrom, compareDateTo } = (await request.json()) as {
      messages: ChatMessage[];
      accountIds?: string[];
      platforms?: string[];
      dateFrom?: string;
      dateTo?: string;
      compareDateFrom?: string;
      compareDateTo?: string;
    };

    activeFilters = { accountIds, platforms, dateFrom, dateTo };

    const anthropicMessages: Anthropic.MessageParam[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Context over actieve filters meegeven
    let filterContext = '';
    if (dateFrom && dateTo) filterContext += `\nActieve datumrange: ${dateFrom} t/m ${dateTo}.`;
    if (compareDateFrom && compareDateTo) filterContext += `\nVergelijkingsperiode: ${compareDateFrom} t/m ${compareDateTo}. Als de gebruiker vraagt om data, haal dan BEIDE periodes op en vergelijk ze.`;

    let response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: SYSTEM_PROMPT + filterContext,
      tools,
      messages: anthropicMessages,
    });

    while (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter(
        (block) => block.type === 'tool_use',
      );

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const toolUse of toolUseBlocks) {
        const { id, name, input } = toolUse as { id: string; name: string; input: Record<string, unknown> };
        const result = await executeTool(name, input);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: id,
          content: result,
        });
      }

      anthropicMessages.push({ role: 'assistant', content: response.content });
      anthropicMessages.push({ role: 'user', content: toolResults });

      response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools,
        messages: anthropicMessages,
      });
    }

    const textBlock = response.content.find((b) => b.type === 'text');
    const text = textBlock && 'text' in textBlock ? textBlock.text : '';

    // Sla Q&A op in chat_history
    try {
      const supabase = await createServerClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
        await supabaseAdmin.from('chat_history').insert({
          user_id: user.id,
          question: lastUserMessage?.content ?? '',
          response: text,
          filters: { accountIds, platforms, dateFrom, dateTo, compareDateFrom, compareDateTo },
        });
      }
    } catch (saveErr) {
      console.error('Chat history save error:', saveErr);
    }

    return Response.json({ role: 'assistant', content: text });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Chat API error:', message);
    return Response.json({ error: message }, { status: 500 });
  }
}
