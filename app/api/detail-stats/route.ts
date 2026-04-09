import {
  getAggregatedStats,
  getCampaignPerformance,
  getOverallDateTrend,
  type QueryFilters,
} from '../../../src/services/bigquery.service';

/**
 * Geeft alle stats voor een detail page (account of platform).
 * Query params:
 * - accountId (optioneel)
 * - platform (optioneel) — interne id zoals 'google_ads'
 * - days (default 30)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    const platform = searchParams.get('platform');
    const days = Number(searchParams.get('days') ?? '30');

    const filters: QueryFilters & { days: number } = { days };
    if (accountId) filters.accountIds = [accountId];
    if (platform) filters.platforms = [platform];

    const [stats, campaigns, trend] = await Promise.all([
      getAggregatedStats(filters),
      getCampaignPerformance(days, filters),
      getOverallDateTrend(filters),
    ]);

    return Response.json({ stats, campaigns, trend });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Fout' }, { status: 500 });
  }
}
