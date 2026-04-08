import { bigquery, DATASET } from '../lib/bigquery';

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

// ============================================
// Interfaces
// ============================================

export interface CampaignPerformance {
  campaign_id: string;
  campaign_name: string;
  campaign_status: string;
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
  ad_group_status: string;
  campaign_name: string;
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

// ============================================
// Query functies
// ============================================

/**
 * Alle campagnes met geaggregeerde performance over een datumbereik.
 */
export async function getCampaignPerformance(days: number = 30): Promise<CampaignPerformance[]> {
  const query = `
    SELECT
      CAMPAIGN_ID, CAMPAIGN_NAME, CAMPAIGN_STATUS,
      SUM(IMPRESSIONS) as impressions,
      SUM(CLICKS) as clicks,
      SUM(COST) as cost,
      SUM(CONVERSIONS) as conversions,
      SUM(CONVERSION_VALUE) as conversion_value
    FROM \`${DATASET}.GOOGLEADS_AD\`
    WHERE DATE >= DATE_SUB(CURRENT_DATE(), INTERVAL @days DAY)
    GROUP BY CAMPAIGN_ID, CAMPAIGN_NAME, CAMPAIGN_STATUS
    ORDER BY cost DESC
  `;

  const [rows] = await bigquery.query({ query, params: { days }, location: 'EU' });

  return rows.map((r: Record<string, unknown>) => {
    const base = {
      campaign_id: String(r.CAMPAIGN_ID),
      campaign_name: String(r.CAMPAIGN_NAME),
      campaign_status: String(r.CAMPAIGN_STATUS),
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
export async function getAdGroupPerformance(campaignId: string, days: number = 30): Promise<AdGroupPerformance[]> {
  const query = `
    SELECT
      AD_GROUP_ID, AD_GROUP_NAME, AD_GROUP_STATUS, CAMPAIGN_NAME,
      SUM(IMPRESSIONS) as impressions,
      SUM(CLICKS) as clicks,
      SUM(COST) as cost,
      SUM(CONVERSIONS) as conversions,
      SUM(CONVERSION_VALUE) as conversion_value
    FROM \`${DATASET}.GOOGLEADS_AD\`
    WHERE CAMPAIGN_ID = @campaignId
      AND DATE >= DATE_SUB(CURRENT_DATE(), INTERVAL @days DAY)
    GROUP BY AD_GROUP_ID, AD_GROUP_NAME, AD_GROUP_STATUS, CAMPAIGN_NAME
    ORDER BY cost DESC
  `;

  const [rows] = await bigquery.query({ query, params: { campaignId, days }, location: 'EU' });

  return rows.map((r: Record<string, unknown>) => {
    const base = {
      ad_group_id: String(r.AD_GROUP_ID),
      ad_group_name: String(r.AD_GROUP_NAME),
      ad_group_status: String(r.AD_GROUP_STATUS),
      campaign_name: String(r.CAMPAIGN_NAME),
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
 * Performance breakdown per device voor een campagne.
 */
export async function getDevicePerformance(campaignId: string, days: number = 30): Promise<DevicePerformance[]> {
  const query = `
    SELECT
      DEVICE,
      SUM(IMPRESSIONS) as impressions,
      SUM(CLICKS) as clicks,
      SUM(COST) as cost,
      SUM(CONVERSIONS) as conversions
    FROM \`${DATASET}.GOOGLEADS_AD\`
    WHERE CAMPAIGN_ID = @campaignId
      AND DATE >= DATE_SUB(CURRENT_DATE(), INTERVAL @days DAY)
    GROUP BY DEVICE
    ORDER BY cost DESC
  `;

  const [rows] = await bigquery.query({ query, params: { campaignId, days }, location: 'EU' });

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
 * Dagelijkse performance trend voor een campagne.
 */
export async function getDateTrend(campaignId: string, days: number = 30): Promise<DatePerformance[]> {
  const query = `
    SELECT
      DATE,
      SUM(IMPRESSIONS) as impressions,
      SUM(CLICKS) as clicks,
      SUM(COST) as cost,
      SUM(CONVERSIONS) as conversions,
      SUM(CONVERSION_VALUE) as conversion_value
    FROM \`${DATASET}.GOOGLEADS_AD\`
    WHERE CAMPAIGN_ID = @campaignId
      AND DATE >= DATE_SUB(CURRENT_DATE(), INTERVAL @days DAY)
    GROUP BY DATE
    ORDER BY DATE ASC
  `;

  const [rows] = await bigquery.query({ query, params: { campaignId, days }, location: 'EU' });

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
