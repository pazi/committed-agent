import 'dotenv/config';
import { supabase } from '../src/lib/supabase.js';
import { bigquery, DATASET } from '../src/lib/bigquery.js';

const BATCH_SIZE = 500;

// ============================================
// Stap 1: Zorg dat tenant + account bestaan
// ============================================

async function ensureTenant(name: string, slug: string): Promise<string> {
  const { data: existing } = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .single();

  if (existing) return existing.id;

  const { data, error } = await supabase
    .from('tenants')
    .insert({ name, slug })
    .select('id')
    .single();

  if (error) throw new Error(`Tenant aanmaken mislukt: ${error.message}`);
  console.log(`  Tenant aangemaakt: ${name} (${data.id})`);
  return data.id;
}

async function ensureAccount(
  tenantId: string,
  platform: string,
  externalAccountId: string,
  name: string,
): Promise<string> {
  const { data: existing } = await supabase
    .from('accounts')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('platform', platform)
    .eq('external_account_id', externalAccountId)
    .single();

  if (existing) return existing.id;

  const { data, error } = await supabase
    .from('accounts')
    .insert({ tenant_id: tenantId, platform, external_account_id: externalAccountId, name })
    .select('id')
    .single();

  if (error) throw new Error(`Account aanmaken mislukt: ${error.message}`);
  console.log(`  Account aangemaakt: ${name} (${data.id})`);
  return data.id;
}

// ============================================
// Stap 2: Sync campagnes, adsets (ad groups), ads
// ============================================

async function upsertEntity(
  table: string,
  record: Record<string, unknown>,
  conflictColumns: string,
): Promise<string> {
  const { data, error } = await supabase
    .from(table)
    .upsert(record, { onConflict: conflictColumns })
    .select('id')
    .single();

  if (error) throw new Error(`Upsert ${table} mislukt: ${error.message}`);
  return data.id;
}

// ============================================
// Stap 3: Haal data uit BigQuery en sync
// ============================================

interface BQRow {
  ACCOUNT_ID: string;
  ACCOUNT_NAME: string;
  CAMPAIGN_ID: string;
  CAMPAIGN_NAME: string;
  CAMPAIGN_STATUS: string;
  AD_GROUP_ID: string;
  AD_GROUP_NAME: string;
  AD_GROUP_STATUS: string;
  AD_ID: string;
  AD_STATUS: string;
  AD_TYPE: string;
  DEVICE: string;
  NETWORK: string;
  DATE: { value: string } | string;
  IMPRESSIONS: number;
  CLICKS: number;
  COST: number;
  CONVERSIONS: number;
  CONVERSION_VALUE: number;
}

async function fetchAllFromBigQuery(): Promise<BQRow[]> {
  console.log('BigQuery data ophalen...');

  const query = `
    SELECT
      ACCOUNT_ID, ACCOUNT_NAME,
      CAMPAIGN_ID, CAMPAIGN_NAME, CAMPAIGN_STATUS,
      AD_GROUP_ID, AD_GROUP_NAME, AD_GROUP_STATUS,
      AD_ID, AD_STATUS, AD_TYPE,
      DEVICE, NETWORK,
      DATE,
      IMPRESSIONS, CLICKS, COST,
      CONVERSIONS, CONVERSION_VALUE
    FROM \`${DATASET}.GOOGLEADS_AD\`
    ORDER BY DATE DESC
  `;

  const [rows] = await bigquery.query({ query, location: 'EU' });
  console.log(`  ${rows.length} rijen opgehaald uit BigQuery`);
  return rows as BQRow[];
}

function parseDate(d: { value: string } | string): string {
  if (typeof d === 'object' && 'value' in d) return d.value;
  return String(d);
}

function normalizeStatus(s: string): string {
  const lower = s.toLowerCase();
  if (lower === 'enabled') return 'active';
  if (lower === 'paused') return 'paused';
  return 'archived';
}

async function main() {
  const tenantSlug = process.argv[2] ?? 'capgemini-academy';
  const tenantName = process.argv[3] ?? 'Capgemini Academy';

  console.log(`\nSync starten voor tenant: ${tenantName}\n`);

  // Stap 1: Tenant
  const tenantId = await ensureTenant(tenantName, tenantSlug);
  console.log(`  Tenant ID: ${tenantId}`);

  // Stap 2: BigQuery data ophalen
  const rows = await fetchAllFromBigQuery();

  // Stap 3: Unieke entities verzamelen en aanmaken
  const accountCache = new Map<string, string>();
  const campaignCache = new Map<string, string>();
  const adsetCache = new Map<string, string>();
  const adCache = new Map<string, string>();

  console.log('\nEntities synchroniseren...');

  for (const row of rows) {
    // Account
    if (!accountCache.has(row.ACCOUNT_ID)) {
      const accountId = await ensureAccount(tenantId, 'google_ads', row.ACCOUNT_ID, row.ACCOUNT_NAME);
      accountCache.set(row.ACCOUNT_ID, accountId);
    }
    const accountId = accountCache.get(row.ACCOUNT_ID)!;

    // Campaign
    if (!campaignCache.has(row.CAMPAIGN_ID)) {
      const campaignId = await upsertEntity('campaigns', {
        tenant_id: tenantId,
        account_id: accountId,
        external_id: row.CAMPAIGN_ID,
        name: row.CAMPAIGN_NAME,
        status: normalizeStatus(row.CAMPAIGN_STATUS),
      }, 'account_id,external_id');
      campaignCache.set(row.CAMPAIGN_ID, campaignId);
    }
    const campaignId = campaignCache.get(row.CAMPAIGN_ID)!;

    // Adset (Ad Group)
    if (!adsetCache.has(row.AD_GROUP_ID)) {
      const adsetId = await upsertEntity('adsets', {
        tenant_id: tenantId,
        campaign_id: campaignId,
        external_id: row.AD_GROUP_ID,
        name: row.AD_GROUP_NAME,
        status: normalizeStatus(row.AD_GROUP_STATUS),
      }, 'campaign_id,external_id');
      adsetCache.set(row.AD_GROUP_ID, adsetId);
    }
    const adsetId = adsetCache.get(row.AD_GROUP_ID)!;

    // Ad
    const adKey = `${row.AD_ID}`;
    if (!adCache.has(adKey)) {
      const adId = await upsertEntity('ads', {
        tenant_id: tenantId,
        adset_id: adsetId,
        external_id: row.AD_ID,
        name: `Ad ${row.AD_ID}`,
        status: normalizeStatus(row.AD_STATUS),
        ad_format: row.AD_TYPE,
      }, 'adset_id,external_id');
      adCache.set(adKey, adId);
    }
  }

  console.log(`  ${accountCache.size} account(s)`);
  console.log(`  ${campaignCache.size} campagne(s)`);
  console.log(`  ${adsetCache.size} ad group(s)`);
  console.log(`  ${adCache.size} ad(s)`);

  // Metrics worden NIET naar Supabase gesynct.
  // De chat interface haalt metrics live uit BigQuery.
  console.log('\nSync voltooid! Metrics worden live uit BigQuery opgehaald.');
}

main().catch((err) => {
  console.error('Sync mislukt:', err.message);
  process.exit(1);
});
