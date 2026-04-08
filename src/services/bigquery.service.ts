import { bigquery, DATASET } from '../lib/bigquery.js';

export interface GoogleAdsRow {
  campaign_id: string;
  campaign_name: string;
  ad_group_id: string;
  ad_group_name: string;
  ad_id: string;
  device: string;
  network: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  conversion_value: number;
  date: string;
}

/**
 * Haal Google Ads data op uit BigQuery (Supermetrics dataset).
 *
 * Kolommen zijn uppercase in Supermetrics — we mappen naar lowercase.
 * Gebruikt parameterized queries om SQL injection te voorkomen.
 */
export async function getGoogleAdsData(limit: number): Promise<GoogleAdsRow[]> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100_000) {
    throw new Error('Limit moet een geheel getal zijn tussen 1 en 100.000');
  }

  const query = `
    SELECT
      CAMPAIGN_ID,
      CAMPAIGN_NAME,
      AD_GROUP_ID,
      AD_GROUP_NAME,
      AD_ID,
      DEVICE,
      NETWORK,
      IMPRESSIONS,
      CLICKS,
      COST,
      CONVERSIONS,
      CONVERSION_VALUE,
      DATE
    FROM
      \`${DATASET}.GOOGLEADS_AD\`
    ORDER BY
      DATE DESC
    LIMIT @limit
  `;

  const [rows] = await bigquery.query({
    query,
    params: { limit },
    location: 'EU',
  });

  return rows.map((row: Record<string, unknown>) => ({
    campaign_id: String(row.CAMPAIGN_ID ?? ''),
    campaign_name: String(row.CAMPAIGN_NAME ?? ''),
    ad_group_id: String(row.AD_GROUP_ID ?? ''),
    ad_group_name: String(row.AD_GROUP_NAME ?? ''),
    ad_id: String(row.AD_ID ?? ''),
    device: String(row.DEVICE ?? ''),
    network: String(row.NETWORK ?? ''),
    impressions: Number(row.IMPRESSIONS ?? 0),
    clicks: Number(row.CLICKS ?? 0),
    cost: Number(row.COST ?? 0),
    conversions: Number(row.CONVERSIONS ?? 0),
    conversion_value: Number(row.CONVERSION_VALUE ?? 0),
    date: row.DATE && typeof row.DATE === 'object' && 'value' in row.DATE
      ? String((row.DATE as { value: string }).value)
      : String(row.DATE ?? ''),
  }));
}
