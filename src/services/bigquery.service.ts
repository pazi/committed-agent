import { bigquery, DATASET } from '../lib/bigquery';

// ============================================
// Platform mapping
// ============================================

const PLATFORM_TABLES: Record<string, string> = {
  google_ads: 'GOOGLEADS_AD',
  facebook: 'FBADS_AD',
  linkedin: 'LINKEDINADS_AD',
  reddit: 'RDA_AD',
};

const PLATFORM_LABELS: Record<string, string> = {
  google_ads: 'Google Ads',
  facebook: 'Facebook Ads',
  linkedin: 'LinkedIn Ads',
  reddit: 'Reddit Ads',
};

// ============================================
// Helpers
// ============================================

function parseBQDate(d: unknown): string {
  if (d && typeof d === 'object' && 'value' in (d as Record<string, unknown>)) {
    return String((d as { value: string }).value);
  }
  return String(d ?? '');
}

function num(v: unknown): number {
  return Number(v ?? 0);
}

function computeMetrics(row: { impressions: number; clicks: number; cost: number; conversions: number; conversion_value: number }) {
  return {
    ctr: row.impressions > 0 ? row.clicks / row.impressions : 0,
    cpc: row.clicks > 0 ? row.cost / row.clicks : 0,
    cpm: row.impressions > 0 ? (row.cost / row.impressions) * 1000 : 0,
    roas: row.cost > 0 ? row.conversion_value / row.cost : 0,
  };
}

function accountFilter(accountIds?: string[]): string {
  if (!accountIds || accountIds.length === 0) return '';
  const escaped = accountIds.map(id => `'${id.replace(/'/g, "''")}'`).join(',');
  return `AND ACCOUNT_ID IN (${escaped})`;
}

/**
 * Bouw een UNION ALL query die data uit meerdere platform-tabellen haalt,
 * genormaliseerd naar dezelfde kolommen.
 */
function platformUnion(
  extraWhere: string,
  filters?: QueryFilters,
): string {
  const activePlatforms = filters?.platforms && filters.platforms.length > 0
    ? filters.platforms.filter(p => p in PLATFORM_TABLES)
    : Object.keys(PLATFORM_TABLES);

  if (activePlatforms.length === 0) return '';

  const dateWhere = filters?.dateFrom && filters?.dateTo
    ? `DATE >= '${filters.dateFrom}' AND DATE <= '${filters.dateTo}'`
    : 'DATE >= DATE_SUB(CURRENT_DATE(), INTERVAL @days DAY)';

  const subqueries = activePlatforms.map(platform => {
    const table = PLATFORM_TABLES[platform];
    const label = PLATFORM_LABELS[platform];
    return `
      SELECT
        '${label}' as platform,
        ACCOUNT_ID, ACCOUNT_NAME,
        CAMPAIGN_ID, CAMPAIGN_NAME,
        CAST(NULL AS STRING) as CAMPAIGN_STATUS,
        ${platform === 'google_ads' ? 'AD_GROUP_ID' : platform === 'reddit' ? 'CAST(NULL AS STRING)' : 'AD_GROUP_ID'} as AD_GROUP_ID,
        ${platform === 'google_ads' ? 'AD_GROUP_NAME' : platform === 'reddit' ? 'CAST(NULL AS STRING)' : 'AD_GROUP_NAME'} as AD_GROUP_NAME,
        ${platform === 'google_ads' ? 'AD_GROUP_STATUS' : 'CAST(NULL AS STRING)'} as AD_GROUP_STATUS,
        ${platform === 'google_ads' ? 'DEVICE' : platform === 'facebook' ? 'IMPRESSION_DEVICE' : 'CAST(NULL AS STRING)'} as DEVICE,
        DATE,
        COALESCE(IMPRESSIONS, 0) as IMPRESSIONS,
        COALESCE(CLICKS, 0) as CLICKS,
        COALESCE(COST, 0) as COST,
        ${platform === 'google_ads' ? 'COALESCE(CONVERSIONS, 0)' : '0'} as CONVERSIONS,
        ${platform === 'google_ads' ? 'COALESCE(CONVERSION_VALUE, 0)' : platform === 'facebook' ? 'COALESCE(CONVERSION_VALUE, 0)' : '0'} as CONVERSION_VALUE
      FROM \`${DATASET}.${table}\`
      WHERE ${dateWhere}
        ${accountFilter(filters?.accountIds)}
        ${extraWhere}
    `;
  });

  return subqueries.join('\nUNION ALL\n');
}

// ============================================
// Interfaces
// ============================================

export interface AccountInfo {
  account_id: string;
  account_name: string;
  platform: string;
}

export interface PlatformInfo {
  id: string;
  label: string;
}

export interface CampaignPerformance {
  campaign_id: string;
  campaign_name: string;
  platform: string;
  account_name: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  conversion_value: number;
  ctr: number;
  cpc: number;
  cpm: number;
  roas: number;
}

export interface AdGroupPerformance {
  ad_group_id: string;
  ad_group_name: string;
  campaign_name: string;
  platform: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  conversion_value: number;
  ctr: number;
  cpc: number;
  cpm: number;
  roas: number;
}

export interface DevicePerformance {
  device: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  ctr: number;
  cpc: number;
  cpm: number;
}

export interface DatePerformance {
  date: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  conversion_value: number;
  ctr: number;
  cpc: number;
}

export interface QueryFilters {
  accountIds?: string[];
  platforms?: string[];
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string;   // YYYY-MM-DD
}

// ============================================
// Query functies
// ============================================

/**
 * Beschikbare platformen.
 */
export function getPlatforms(): PlatformInfo[] {
  return Object.entries(PLATFORM_LABELS).map(([id, label]) => ({ id, label }));
}

/**
 * Haal alle beschikbare accounts op, per platform.
 */
export async function getAccounts(): Promise<AccountInfo[]> {
  const queries = Object.entries(PLATFORM_TABLES).map(([platform, table]) => `
    SELECT DISTINCT ACCOUNT_ID, ACCOUNT_NAME, '${PLATFORM_LABELS[platform]}' as platform
    FROM \`${DATASET}.${table}\`
  `);

  const query = queries.join('\nUNION ALL\n') + '\nORDER BY platform, ACCOUNT_NAME';
  const [rows] = await bigquery.query({ query, location: 'EU' });

  return rows.map((r: Record<string, unknown>) => ({
    account_id: String(r.ACCOUNT_ID),
    account_name: String(r.ACCOUNT_NAME),
    platform: String(r.platform),
  }));
}

/**
 * Alle campagnes met geaggregeerde performance.
 */
export async function getCampaignPerformance(days: number = 30, filters?: QueryFilters): Promise<CampaignPerformance[]> {
  const union = platformUnion('', filters);
  if (!union) return [];

  const query = `
    SELECT
      platform, ACCOUNT_NAME, CAMPAIGN_ID, CAMPAIGN_NAME,
      SUM(IMPRESSIONS) as impressions,
      SUM(CLICKS) as clicks,
      SUM(COST) as cost,
      SUM(CONVERSIONS) as conversions,
      SUM(CONVERSION_VALUE) as conversion_value
    FROM (${union})
    GROUP BY platform, ACCOUNT_NAME, CAMPAIGN_ID, CAMPAIGN_NAME
    ORDER BY cost DESC
  `;

  const [rows] = await bigquery.query({ query, params: { days }, location: 'EU' });

  return rows.map((r: Record<string, unknown>) => {
    const base = {
      campaign_id: String(r.CAMPAIGN_ID),
      campaign_name: String(r.CAMPAIGN_NAME),
      platform: String(r.platform),
      account_name: String(r.ACCOUNT_NAME),
      impressions: num(r.impressions),
      clicks: num(r.clicks),
      cost: num(r.cost),
      conversions: num(r.conversions),
      conversion_value: num(r.conversion_value),
    };
    return { ...base, ...computeMetrics(base) };
  });
}

/**
 * Ad group performance voor een specifieke campagne.
 */
export async function getAdGroupPerformance(campaignId: string, days: number = 30, filters?: QueryFilters): Promise<AdGroupPerformance[]> {
  const union = platformUnion(`AND CAMPAIGN_ID = '${campaignId.replace(/'/g, "''")}'`, filters);
  if (!union) return [];

  const query = `
    SELECT
      platform, CAMPAIGN_NAME, AD_GROUP_ID, AD_GROUP_NAME,
      SUM(IMPRESSIONS) as impressions,
      SUM(CLICKS) as clicks,
      SUM(COST) as cost,
      SUM(CONVERSIONS) as conversions,
      SUM(CONVERSION_VALUE) as conversion_value
    FROM (${union})
    WHERE AD_GROUP_ID IS NOT NULL
    GROUP BY platform, CAMPAIGN_NAME, AD_GROUP_ID, AD_GROUP_NAME
    ORDER BY cost DESC
  `;

  const [rows] = await bigquery.query({ query, params: { days }, location: 'EU' });

  return rows.map((r: Record<string, unknown>) => {
    const base = {
      ad_group_id: String(r.AD_GROUP_ID),
      ad_group_name: String(r.AD_GROUP_NAME),
      campaign_name: String(r.CAMPAIGN_NAME),
      platform: String(r.platform),
      impressions: num(r.impressions),
      clicks: num(r.clicks),
      cost: num(r.cost),
      conversions: num(r.conversions),
      conversion_value: num(r.conversion_value),
    };
    return { ...base, ...computeMetrics(base) };
  });
}

/**
 * Performance breakdown per device.
 */
export async function getDevicePerformance(campaignId: string, days: number = 30, filters?: QueryFilters): Promise<DevicePerformance[]> {
  const union = platformUnion(`AND CAMPAIGN_ID = '${campaignId.replace(/'/g, "''")}'`, filters);
  if (!union) return [];

  const query = `
    SELECT
      DEVICE,
      SUM(IMPRESSIONS) as impressions,
      SUM(CLICKS) as clicks,
      SUM(COST) as cost,
      SUM(CONVERSIONS) as conversions
    FROM (${union})
    WHERE DEVICE IS NOT NULL AND DEVICE != ''
    GROUP BY DEVICE
    ORDER BY cost DESC
  `;

  const [rows] = await bigquery.query({ query, params: { days }, location: 'EU' });

  return rows.map((r: Record<string, unknown>) => {
    const base = {
      device: String(r.DEVICE),
      impressions: num(r.impressions),
      clicks: num(r.clicks),
      cost: num(r.cost),
      conversions: num(r.conversions),
    };
    return {
      ...base,
      ctr: base.impressions > 0 ? base.clicks / base.impressions : 0,
      cpc: base.clicks > 0 ? base.cost / base.clicks : 0,
      cpm: base.impressions > 0 ? (base.cost / base.impressions) * 1000 : 0,
    };
  });
}

/**
 * Dagelijkse performance trend.
 */
export async function getDateTrend(campaignId: string, days: number = 30, filters?: QueryFilters): Promise<DatePerformance[]> {
  const union = platformUnion(`AND CAMPAIGN_ID = '${campaignId.replace(/'/g, "''")}'`, filters);
  if (!union) return [];

  const query = `
    SELECT
      DATE,
      SUM(IMPRESSIONS) as impressions,
      SUM(CLICKS) as clicks,
      SUM(COST) as cost,
      SUM(CONVERSIONS) as conversions,
      SUM(CONVERSION_VALUE) as conversion_value
    FROM (${union})
    GROUP BY DATE
    ORDER BY DATE ASC
  `;

  const [rows] = await bigquery.query({ query, params: { days }, location: 'EU' });

  return rows.map((r: Record<string, unknown>) => {
    const base = {
      date: parseBQDate(r.DATE),
      impressions: num(r.impressions),
      clicks: num(r.clicks),
      cost: num(r.cost),
      conversions: num(r.conversions),
      conversion_value: num(r.conversion_value),
    };
    return {
      ...base,
      ctr: base.impressions > 0 ? base.clicks / base.impressions : 0,
      cpc: base.clicks > 0 ? base.cost / base.clicks : 0,
    };
  });
}
