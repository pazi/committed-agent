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

  // Per-platform kolom mapping (verschillende tabellen hebben verschillende kolomnamen)
  const platformColumns: Record<string, {
    adGroupId: string;
    adGroupName: string;
    adGroupStatus: string;
    device: string;
    cost: string;
    conversions: string;
    conversionValue: string;
  }> = {
    google_ads: {
      adGroupId: 'AD_GROUP_ID',
      adGroupName: 'AD_GROUP_NAME',
      adGroupStatus: 'AD_GROUP_STATUS',
      device: 'DEVICE',
      cost: 'COST',
      conversions: 'CONVERSIONS',
      conversionValue: 'CONVERSION_VALUE',
    },
    facebook: {
      adGroupId: 'AD_GROUP_ID',
      adGroupName: 'AD_GROUP_NAME',
      adGroupStatus: 'AD_GROUP_STATUS',
      device: 'IMPRESSION_DEVICE',
      cost: 'COST',
      conversions: 'CAST(NULL AS INT64)',
      conversionValue: 'CONVERSION_VALUE',
    },
    linkedin: {
      // LinkedIn heeft CAMPAIGN_GROUP i.p.v. AD_GROUP
      adGroupId: 'CAMPAIGN_GROUP_ID',
      adGroupName: 'CAMPAIGN_GROUP_NAME',
      adGroupStatus: 'CAST(NULL AS STRING)',
      device: 'CAST(NULL AS STRING)',
      cost: 'COST',
      conversions: 'CONVERSIONS',
      conversionValue: 'CONVERSION_VALUE',
    },
    reddit: {
      adGroupId: 'CAST(NULL AS STRING)',
      adGroupName: 'CAST(NULL AS STRING)',
      adGroupStatus: 'CAST(NULL AS STRING)',
      device: 'CAST(NULL AS STRING)',
      cost: 'SPEND',
      conversions: 'CAST(NULL AS INT64)',
      conversionValue: 'CAST(NULL AS FLOAT64)',
    },
  };

  const subqueries = activePlatforms.map(platform => {
    const table = PLATFORM_TABLES[platform];
    const label = PLATFORM_LABELS[platform];
    const cols = platformColumns[platform];
    return `
      SELECT
        '${label}' as platform,
        ACCOUNT_ID, ACCOUNT_NAME,
        CAMPAIGN_ID, CAMPAIGN_NAME,
        CAST(NULL AS STRING) as CAMPAIGN_STATUS,
        ${cols.adGroupId} as AD_GROUP_ID,
        ${cols.adGroupName} as AD_GROUP_NAME,
        ${cols.adGroupStatus} as AD_GROUP_STATUS,
        ${cols.device} as DEVICE,
        DATE,
        COALESCE(IMPRESSIONS, 0) as IMPRESSIONS,
        COALESCE(CLICKS, 0) as CLICKS,
        COALESCE(${cols.cost}, 0) as COST,
        COALESCE(${cols.conversions}, 0) as CONVERSIONS,
        COALESCE(${cols.conversionValue}, 0) as CONVERSION_VALUE
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
 * Account overzicht met aantal campagnes per account.
 */
export interface AccountOverview {
  account_id: string;
  account_name: string;
  platform: string;
  campaign_count: number;
}

export async function getAccountsWithCounts(): Promise<AccountOverview[]> {
  const queries = Object.entries(PLATFORM_TABLES).map(([platform, table]) => `
    SELECT
      ACCOUNT_ID, ACCOUNT_NAME,
      '${PLATFORM_LABELS[platform]}' as platform,
      COUNT(DISTINCT CAMPAIGN_ID) as campaign_count
    FROM \`${DATASET}.${table}\`
    GROUP BY ACCOUNT_ID, ACCOUNT_NAME
  `);

  const query = queries.join('\nUNION ALL\n') + '\nORDER BY ACCOUNT_NAME ASC';
  const [rows] = await bigquery.query({ query, location: 'EU' });

  return rows.map((r: Record<string, unknown>) => ({
    account_id: String(r.ACCOUNT_ID),
    account_name: String(r.ACCOUNT_NAME),
    platform: String(r.platform),
    campaign_count: num(r.campaign_count),
  }));
}

/**
 * Platform overzicht met aantal accounts en campagnes per platform.
 */
export interface PlatformOverview {
  id: string;
  label: string;
  account_count: number;
  campaign_count: number;
}

export async function getPlatformsWithCounts(): Promise<PlatformOverview[]> {
  const queries = Object.entries(PLATFORM_TABLES).map(([platform, table]) => `
    SELECT
      '${platform}' as id,
      '${PLATFORM_LABELS[platform]}' as label,
      COUNT(DISTINCT ACCOUNT_ID) as account_count,
      COUNT(DISTINCT CAMPAIGN_ID) as campaign_count
    FROM \`${DATASET}.${table}\`
  `);

  const query = queries.join('\nUNION ALL\n') + '\nORDER BY label ASC';
  const [rows] = await bigquery.query({ query, location: 'EU' });

  return rows.map((r: Record<string, unknown>) => ({
    id: String(r.id),
    label: String(r.label),
    account_count: num(r.account_count),
    campaign_count: num(r.campaign_count),
  }));
}

/**
 * Geaggregeerde totals voor een entity (account, platform, of beide).
 */
export interface AggregatedStats {
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  conversion_value: number;
  ctr: number;
  cpc: number;
  cpm: number;
  roas: number;
  cost_per_conversion: number;
}

export async function getAggregatedStats(filters: QueryFilters & { days?: number }): Promise<AggregatedStats> {
  const days = filters.days ?? 30;
  const union = platformUnion('', filters);
  if (!union) {
    return { impressions: 0, clicks: 0, cost: 0, conversions: 0, conversion_value: 0, ctr: 0, cpc: 0, cpm: 0, roas: 0, cost_per_conversion: 0 };
  }

  const query = `
    SELECT
      SUM(IMPRESSIONS) as impressions,
      SUM(CLICKS) as clicks,
      SUM(COST) as cost,
      SUM(CONVERSIONS) as conversions,
      SUM(CONVERSION_VALUE) as conversion_value
    FROM (${union})
  `;

  const [rows] = await bigquery.query({ query, params: { days }, location: 'EU' });
  const r = rows[0] ?? {};
  const base = {
    impressions: num(r.impressions),
    clicks: num(r.clicks),
    cost: num(r.cost),
    conversions: num(r.conversions),
    conversion_value: num(r.conversion_value),
  };
  return {
    ...base,
    ...computeMetrics(base),
    cost_per_conversion: base.conversions > 0 ? base.cost / base.conversions : 0,
  };
}

/**
 * Dagelijkse trend data zonder campaign filter (voor account/platform detail).
 */
export async function getOverallDateTrend(filters: QueryFilters & { days?: number }): Promise<DatePerformance[]> {
  const days = filters.days ?? 30;
  const union = platformUnion('', filters);
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
