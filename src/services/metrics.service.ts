import { supabase } from '../lib/supabase.js';
import type { AggregatedMetrics, EntityLevel } from '../types/index.js';

function computeMetrics(raw: {
  impressions: number;
  reach: number;
  clicks: number;
  spend: number;
  conversions: number;
  conversion_value: number;
}): AggregatedMetrics {
  return {
    ...raw,
    ctr: raw.impressions > 0 ? raw.clicks / raw.impressions : 0,
    cpc: raw.clicks > 0 ? raw.spend / raw.clicks : 0,
    cpm: raw.impressions > 0 ? (raw.spend / raw.impressions) * 1000 : 0,
    conversion_rate: raw.clicks > 0 ? raw.conversions / raw.clicks : 0,
    roas: raw.spend > 0 ? raw.conversion_value / raw.spend : 0,
    cost_per_conversion: raw.conversions > 0 ? raw.spend / raw.conversions : 0,
  };
}

/**
 * Haal geaggregeerde metrics op voor een specifieke entity over een datumbereik.
 */
export async function getMetricsForEntity(
  tenantId: string,
  level: EntityLevel,
  entityId: string,
  lookbackDays: number,
): Promise<AggregatedMetrics | null> {
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - lookbackDays);
  const fromDateStr = fromDate.toISOString().split('T')[0];

  const column = `${level === 'adset' ? 'adset' : level}_id`;

  const { data, error } = await supabase
    .from('ad_insights')
    .select('impressions, reach, clicks, spend, conversions, conversion_value')
    .eq('tenant_id', tenantId)
    .eq(column, entityId)
    .gte('date', fromDateStr);

  if (error) {
    console.error(`Error fetching metrics for ${level} ${entityId}:`, error.message);
    return null;
  }

  if (!data || data.length === 0) return null;

  const totals = data.reduce(
    (acc, row) => ({
      impressions: acc.impressions + (row.impressions ?? 0),
      reach: acc.reach + (row.reach ?? 0),
      clicks: acc.clicks + (row.clicks ?? 0),
      spend: acc.spend + Number(row.spend ?? 0),
      conversions: acc.conversions + (row.conversions ?? 0),
      conversion_value: acc.conversion_value + Number(row.conversion_value ?? 0),
    }),
    { impressions: 0, reach: 0, clicks: 0, spend: 0, conversions: 0, conversion_value: 0 },
  );

  return computeMetrics(totals);
}

/**
 * Haal alle entity IDs op van een bepaald level voor een tenant.
 */
export async function getEntityIds(
  tenantId: string,
  level: EntityLevel,
): Promise<Array<{ id: string; name: string }>> {
  const table = level === 'campaign' ? 'campaigns' : level === 'adset' ? 'adsets' : 'ads';

  const { data, error } = await supabase
    .from(table)
    .select('id, name')
    .eq('tenant_id', tenantId)
    .eq('status', 'active');

  if (error) {
    console.error(`Error fetching ${level} entities:`, error.message);
    return [];
  }

  return data ?? [];
}
