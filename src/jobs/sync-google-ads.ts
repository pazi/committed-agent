import 'dotenv/config';
import { supabase } from '../lib/supabase.js';
import { createGoogleAdsClient, type GoogleAdsClient } from '../services/google-ads.service.js';
import {
  PLATFORM,
  mapAd,
  mapAdGroup,
  mapAsset,
  mapCampaign,
  mapCustomer,
  mapMetricsRow,
  mapSearchTerm,
} from '../mappings/google-ads.mapping.js';
import type { DateRange } from '../types/google-ads.js';

// ============================================
// Google Ads → Supabase sync job
// ============================================
//
// Dit script orchestreert de volledige sync voor één tenant + één
// Google Ads customer. Volgorde is belangrijk vanwege FK constraints:
//
//   1. tenant     (ensure)
//   2. account    (upsert customer)
//   3. campaigns  (upsert)            → bouwt campaignIdMap (external→uuid)
//   4. ad groups  (upsert)            → bouwt adsetIdMap
//   5. creatives  (upsert)            → bouwt creativeIdMap
//   6. ads        (upsert, met creative_id)
//   7. assets     (upsert, met creative_id)
//   8. search_terms (upsert)
//   9. ad_insights  (upsert)
//
// Het script werkt zowel tegen StubGoogleAdsClient als (later) tegen
// LiveGoogleAdsClient — de factory in google-ads.service kiest welke
// op basis van env vars.

interface SyncOptions {
  tenant_slug: string;
  customer_id: string;
  date_range: DateRange;
}

// --------------------------------------------
// Helpers
// --------------------------------------------

async function ensureTenant(slug: string): Promise<string> {
  const { data: existing } = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (existing) return existing.id;

  const { data, error } = await supabase
    .from('tenants')
    .insert({ name: slug, slug })
    .select('id')
    .single();

  if (error) throw new Error(`Tenant aanmaken mislukt: ${error.message}`);
  console.log(`  ✓ Tenant aangemaakt: ${slug} (${data.id})`);
  return data.id;
}

/** Upsert via supabase, returnt de geïnserteerde/geüpdatede rows incl. id. */
async function upsert<T extends object>(
  table: string,
  rows: T[],
  onConflict: string,
): Promise<Array<T & { id: string }>> {
  if (rows.length === 0) return [];
  const { data, error } = await supabase
    .from(table)
    .upsert(rows as never, { onConflict })
    .select();

  if (error) throw new Error(`Upsert ${table} mislukt: ${error.message}`);
  return (data ?? []) as Array<T & { id: string }>;
}

// --------------------------------------------
// Sync orchestration
// --------------------------------------------

export async function syncGoogleAds(
  client: GoogleAdsClient,
  opts: SyncOptions,
): Promise<void> {
  const { tenant_slug, customer_id, date_range } = opts;
  console.log(`\n[google-ads] Sync gestart voor ${tenant_slug} / customer ${customer_id}`);
  console.log(`             ${date_range.start_date} → ${date_range.end_date}\n`);

  // 1. Tenant
  const tenant_id = await ensureTenant(tenant_slug);

  // 2. Account
  const customer = await client.getCustomer(customer_id);
  const accountInput = mapCustomer(customer, tenant_id);
  const [accountRow] = await upsert(
    'accounts',
    [accountInput],
    'tenant_id,platform,external_account_id',
  );
  const account_id = accountRow.id as string;
  console.log(`  ✓ Account: ${customer.descriptive_name} (${account_id})`);

  // 3. Campaigns
  const campaigns = await client.getCampaigns({ customer_id, date_range });
  const campaignInputs = campaigns.map((c) => {
    const m = mapCampaign(c, tenant_id);
    return {
      tenant_id,
      account_id,
      external_id: m.external_id,
      name: m.name,
      status: m.status,
      objective: m.objective,
      budget_daily: m.budget_daily,
      start_date: m.start_date,
      end_date: m.end_date,
    };
  });
  const campaignRows = await upsert('campaigns', campaignInputs, 'account_id,external_id');
  const campaignIdMap = new Map<string, string>();
  for (const row of campaignRows) {
    campaignIdMap.set(row.external_id as string, row.id as string);
  }
  console.log(`  ✓ Campaigns: ${campaignRows.length}`);

  // 4. Ad groups
  const adGroups = await client.getAdGroups({ customer_id, date_range });
  const adsetInputs = adGroups
    .map((ag) => {
      const m = mapAdGroup(ag, tenant_id);
      const campaign_id = campaignIdMap.get(m.external_campaign_id);
      if (!campaign_id) {
        console.warn(`  ! Ad group ${ag.ad_group_id}: campaign ${m.external_campaign_id} niet gevonden`);
        return null;
      }
      return {
        tenant_id,
        campaign_id,
        external_id: m.external_id,
        name: m.name,
        status: m.status,
        bid_strategy: m.bid_strategy,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const adsetRows = await upsert('adsets', adsetInputs, 'campaign_id,external_id');
  const adsetIdMap = new Map<string, string>();
  for (const row of adsetRows) {
    adsetIdMap.set(row.external_id as string, row.id as string);
  }
  console.log(`  ✓ Ad groups: ${adsetRows.length}`);

  // 5. Ads (+ 6. Creatives + 7. Assets) — opgehaald in één call
  const ads = await client.getAds({ customer_id, date_range });
  const mappedAds = ads.map((ad) => mapAd(ad, tenant_id));

  // 5a. Creatives upsert
  const creativeInputs = mappedAds.map((m) => ({
    tenant_id,
    platform: PLATFORM,
    external_id: m.creative.external_id,
    name: m.creative.name,
    type: m.creative.type,
    headline: m.creative.headline,
    body: m.creative.body,
    call_to_action: m.creative.call_to_action,
  }));
  const creativeRows = await upsert(
    'creatives',
    creativeInputs,
    'tenant_id,platform,external_id',
  );
  const creativeIdMap = new Map<string, string>();
  for (const row of creativeRows) {
    creativeIdMap.set(row.external_id as string, row.id as string);
  }
  console.log(`  ✓ Creatives: ${creativeRows.length}`);

  // 5b. Ads upsert (met creative_id)
  const adInputs = mappedAds
    .map((m) => {
      const adset_id = adsetIdMap.get(m.ad.external_adgroup_id);
      const creative_id = m.ad.external_creative_id
        ? creativeIdMap.get(m.ad.external_creative_id)
        : undefined;
      if (!adset_id) {
        console.warn(`  ! Ad ${m.ad.external_id}: ad group ${m.ad.external_adgroup_id} niet gevonden`);
        return null;
      }
      return {
        tenant_id,
        adset_id,
        external_id: m.ad.external_id,
        name: m.ad.name,
        status: m.ad.status,
        ad_format: m.ad.ad_format,
        creative_id,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const adRows = await upsert('ads', adInputs, 'adset_id,external_id');
  console.log(`  ✓ Ads: ${adRows.length}`);

  // 5c. Creative assets (uit RSA + losse PMax assets)
  const inlineAssets = mappedAds.flatMap((m) => m.assets);
  const standaloneAssets = (await client.getAssets({ customer_id, date_range })).map(
    (a) => mapAsset(a, tenant_id),
  );
  const allAssets = [...inlineAssets, ...standaloneAssets];

  const assetInputs = allAssets.map((a) => ({
    tenant_id,
    platform: PLATFORM,
    external_id: a.external_id,
    asset_type: a.asset_type,
    content: a.content,
    url: a.url,
    performance_label: a.performance_label,
    creative_id: a.external_creative_id
      ? creativeIdMap.get(a.external_creative_id)
      : undefined,
  }));

  const assetRows = await upsert(
    'creative_assets',
    assetInputs,
    'tenant_id,platform,external_id,asset_type',
  );
  console.log(`  ✓ Creative assets: ${assetRows.length}`);

  // 8. Search terms
  const searchTerms = await client.getSearchTerms({ customer_id, date_range });
  const searchTermInputs = searchTerms
    .map((t) => {
      const m = mapSearchTerm(t, tenant_id);
      const campaign_id = campaignIdMap.get(m.external_campaign_id);
      const adset_id = adsetIdMap.get(m.external_adgroup_id);
      if (!campaign_id || !adset_id) {
        console.warn(`  ! Search term '${m.search_term}': campaign/adset niet gevonden`);
        return null;
      }
      return {
        tenant_id,
        platform: PLATFORM,
        date: m.date,
        account_id,
        campaign_id,
        adset_id,
        search_term: m.search_term,
        match_type: m.match_type,
        impressions: m.impressions,
        clicks: m.clicks,
        spend: m.spend,
        conversions: m.conversions,
        conversion_value: m.conversion_value,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const searchTermRows = await upsert(
    'search_terms',
    searchTermInputs,
    'tenant_id,date,platform,campaign_id,adset_id,search_term,match_type',
  );
  console.log(`  ✓ Search terms: ${searchTermRows.length}`);

  // 9. Ad insights (per ad_group level voor nu — fijnste granulariteit
  //    waar de stub data voor geeft)
  const metrics = await client.getMetrics({
    customer_id,
    date_range,
    level: 'ad',
  });
  const insightInputs = metrics
    .map((row) => {
      const m = mapMetricsRow(row, tenant_id);
      const campaign_id = m.external_campaign_id ? campaignIdMap.get(m.external_campaign_id) : undefined;
      const adset_id = m.external_adgroup_id ? adsetIdMap.get(m.external_adgroup_id) : undefined;
      // ad_id lookup via adRows
      const ad_id = m.external_ad_id
        ? (adRows.find((a) => a.external_id === m.external_ad_id)?.id as string | undefined)
        : undefined;
      return {
        tenant_id,
        date: m.date,
        platform: PLATFORM,
        account_id,
        campaign_id,
        adset_id,
        ad_id,
        impressions: m.impressions,
        clicks: m.clicks,
        spend: m.spend,
        conversions: m.conversions,
        conversion_value: m.conversion_value,
        reach: m.reach,
      };
    });

  // ad_insights heeft een complexe unique key — we gebruiken een
  // simpele insert voor nu en laten Postgres op conflict niets doen.
  // Dit is goed genoeg voor de eerste run; voor incremental sync
  // bouwen we later een nettere upsert.
  if (insightInputs.length > 0) {
    const { error } = await supabase
      .from('ad_insights')
      .upsert(insightInputs, {
        onConflict: 'tenant_id,date,hour,platform,campaign_id,adset_id,ad_id,device,placement',
        ignoreDuplicates: true,
      });
    if (error) {
      console.warn(`  ! ad_insights upsert waarschuwing: ${error.message}`);
    }
  }
  console.log(`  ✓ Ad insights: ${insightInputs.length}`);

  console.log(`\n[google-ads] Sync afgerond.\n`);
}

// --------------------------------------------
// CLI entrypoint
// --------------------------------------------

async function main() {
  const tenant_slug = process.env.TENANT_SLUG ?? 'demo';
  const customer_id = process.env.GOOGLE_ADS_CUSTOMER_ID ?? '1234567890';

  // Default: laatste 7 dagen
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 7);
  const fmt = (d: Date) => d.toISOString().split('T')[0];

  const client = createGoogleAdsClient();
  await syncGoogleAds(client, {
    tenant_slug,
    customer_id,
    date_range: { start_date: fmt(start), end_date: fmt(end) },
  });
}

// Run alleen bij directe aanroep, niet bij import
const isDirectRun = import.meta.url === `file://${process.argv[1]}`;
if (isDirectRun) {
  main().catch((err) => {
    console.error('[google-ads] Sync mislukt:', err);
    process.exit(1);
  });
}
