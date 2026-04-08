import { z } from 'zod/v4';
import type { AdInsight, RawSupermetricsRow } from '../types/index.js';

/**
 * Zod schema voor validatie van een getransformeerde AdInsight row.
 */
const adInsightSchema = z.object({
  tenant_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hour: z.number().min(0).max(23).optional(),
  platform: z.string().min(1),
  account_id: z.string().uuid().optional(),
  campaign_id: z.string().uuid().optional(),
  adset_id: z.string().uuid().optional(),
  ad_id: z.string().uuid().optional(),
  device: z.string().optional(),
  placement: z.string().optional(),
  impressions: z.number().int().min(0),
  reach: z.number().int().min(0),
  clicks: z.number().int().min(0),
  spend: z.number().min(0),
  conversions: z.number().int().min(0),
  conversion_value: z.number().min(0),
});

/**
 * Normaliseer een datum string naar YYYY-MM-DD formaat.
 */
function normalizeDate(raw: string): string {
  const d = new Date(raw);
  return d.toISOString().split('T')[0];
}

/**
 * Converteer een waarde veilig naar een nummer.
 */
function toNumber(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

/**
 * Normaliseer platform namen naar interne conventie.
 */
function normalizePlatform(raw?: string): string {
  if (!raw) return 'unknown';
  const lower = raw.toLowerCase().trim();
  const map: Record<string, string> = {
    'facebook': 'meta',
    'facebook ads': 'meta',
    'instagram': 'meta',
    'meta': 'meta',
    'google': 'google_ads',
    'google ads': 'google_ads',
    'adwords': 'google_ads',
    'linkedin': 'linkedin',
    'linkedin ads': 'linkedin',
    'tiktok': 'tiktok',
    'tiktok ads': 'tiktok',
    'pinterest': 'pinterest',
    'snapchat': 'snapchat',
  };
  return map[lower] ?? lower;
}

export interface MappingContext {
  tenantId: string;
  platform: string;
  /** Optionele lookup om external IDs te mappen naar interne UUIDs */
  campaignIdMap?: Map<string, string>;
  adsetIdMap?: Map<string, string>;
  adIdMap?: Map<string, string>;
  accountIdMap?: Map<string, string>;
}

/**
 * Map een ruwe Supermetrics row naar een AdInsight record.
 */
export function mapSupermetricsRow(
  row: RawSupermetricsRow,
  ctx: MappingContext,
): AdInsight {
  const platform = normalizePlatform(row.Platform ?? ctx.platform);

  return {
    tenant_id: ctx.tenantId,
    date: normalizeDate(row.Date),
    hour: row.Hour !== undefined ? toNumber(row.Hour) : undefined,
    platform,
    account_id: ctx.accountIdMap?.get(String(row['Account ID'] ?? '')),
    campaign_id: ctx.campaignIdMap?.get(String(row['Campaign ID'] ?? '')),
    adset_id: ctx.adsetIdMap?.get(String(row['Ad Set ID'] ?? '')),
    ad_id: ctx.adIdMap?.get(String(row['Ad ID'] ?? '')),
    device: row.Device as string | undefined,
    placement: row.Placement as string | undefined,
    impressions: toNumber(row.Impressions),
    reach: toNumber(row.Reach),
    clicks: toNumber(row.Clicks),
    spend: toNumber(row.Spend),
    conversions: toNumber(row.Conversions),
    conversion_value: toNumber(row['Conversion Value']),
  };
}

/**
 * Valideer een AdInsight record met Zod.
 * Gooit een error als de data ongeldig is.
 */
export function validateInsight(insight: AdInsight): AdInsight {
  return adInsightSchema.parse(insight) as AdInsight;
}

/**
 * Map en valideer een batch ruwe rows.
 * Retourneert valide records + een lijst van fouten.
 */
export function mapAndValidateBatch(
  rows: RawSupermetricsRow[],
  ctx: MappingContext,
): { valid: AdInsight[]; errors: Array<{ index: number; error: string }> } {
  const valid: AdInsight[] = [];
  const errors: Array<{ index: number; error: string }> = [];

  for (let i = 0; i < rows.length; i++) {
    try {
      const mapped = mapSupermetricsRow(rows[i], ctx);
      const validated = validateInsight(mapped);
      valid.push(validated);
    } catch (err) {
      errors.push({
        index: i,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { valid, errors };
}
