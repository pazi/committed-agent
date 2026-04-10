import type {
  GoogleAdsAd,
  GoogleAdsAdGroup,
  GoogleAdsAsset,
  GoogleAdsAssetPerformanceLabel,
  GoogleAdsAssetType,
  GoogleAdsCampaign,
  GoogleAdsCampaignStatus,
  GoogleAdsCustomer,
  GoogleAdsMetricsRow,
  GoogleAdsSearchTerm,
} from '../types/google-ads.js';
import type { EntityStatus } from '../types/index.js';

// ============================================
// Google Ads → database row mapping
// ============================================
//
// Pure functies. Geen Supabase calls, geen async. De sync job is
// verantwoordelijk voor het oplossen van UUID lookups (campaign_id,
// adset_id, etc.) en de daadwerkelijke upserts.
//
// De rows die we hier produceren bevatten *externe* IDs (zoals
// `external_id`, `campaign_external_id`). De sync job vertaalt die
// later naar interne UUIDs.

export const PLATFORM = 'google_ads' as const;

// --------------------------------------------
// Helpers
// --------------------------------------------

function mapStatus(s: GoogleAdsCampaignStatus): EntityStatus {
  switch (s) {
    case 'ENABLED': return 'active';
    case 'PAUSED': return 'paused';
    case 'REMOVED': return 'archived';
    default: return 'paused';
  }
}

function mapPerformanceLabel(label?: GoogleAdsAssetPerformanceLabel): string | undefined {
  if (!label) return undefined;
  return label.toLowerCase();
}

/**
 * Bepaal het ad_format op basis van de Google Ads ad type string.
 * Versimpeld naar de termen die we elders in onze db gebruiken.
 */
function mapAdFormat(type: string): string {
  const lower = type.toLowerCase();
  if (lower.includes('responsive_search')) return 'responsive_search';
  if (lower.includes('responsive_display')) return 'responsive_display';
  if (lower.includes('image')) return 'image';
  if (lower.includes('video')) return 'video';
  if (lower.includes('shopping')) return 'shopping';
  if (lower.includes('app')) return 'app';
  return lower;
}

// --------------------------------------------
// Output row types
// --------------------------------------------
//
// Deze types vertegenwoordigen de "input" voor een Supabase upsert.
// Ze bevatten nog externe IDs die door de sync job vertaald moeten
// worden naar UUIDs voor de FKs.

export interface AccountUpsert {
  tenant_id: string;
  platform: 'google_ads';
  external_account_id: string;
  name: string;
  currency: string;
  timezone: string;
}

export interface CampaignUpsert {
  tenant_id: string;
  // sync job lost dit op naar account UUID
  external_account_id: string;
  external_id: string;
  name: string;
  status: EntityStatus;
  objective?: string;
  budget_daily?: number;
  start_date?: string;
  end_date?: string;
}

export interface AdsetUpsert {
  tenant_id: string;
  external_campaign_id: string;
  external_id: string;
  name: string;
  status: EntityStatus;
  bid_strategy?: string;
}

export interface CreativeUpsert {
  tenant_id: string;
  platform: 'google_ads';
  external_id: string; // ad_id
  name: string;
  type: string; // 'text' voor RSA, 'image' voor image ads, etc.
  headline?: string;
  body?: string;
  call_to_action?: string;
}

export interface AdUpsert {
  tenant_id: string;
  external_adgroup_id: string;
  external_id: string;
  name: string;
  status: EntityStatus;
  ad_format: string;
  /** Externe creative key — sync job vertaalt naar creative UUID */
  external_creative_id?: string;
}

export interface CreativeAssetUpsert {
  tenant_id: string;
  platform: 'google_ads';
  external_id: string; // asset_id
  asset_type: string;  // lowercased Google asset_type
  content?: string;
  url?: string;
  performance_label?: string;
  /** Optionele koppeling naar de creative waar dit asset bij hoort */
  external_creative_id?: string;
}

export interface SearchTermUpsert {
  tenant_id: string;
  platform: 'google_ads';
  date: string;
  external_campaign_id: string;
  external_adgroup_id: string;
  search_term: string;
  match_type: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  conversion_value: number;
}

export interface AdInsightUpsert {
  tenant_id: string;
  date: string;
  platform: 'google_ads';
  external_campaign_id?: string;
  external_adgroup_id?: string;
  external_ad_id?: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  conversion_value: number;
  reach: number; // Google Ads heeft geen reach op insight niveau, wordt 0
}

// --------------------------------------------
// Mapping functions
// --------------------------------------------

export function mapCustomer(
  customer: GoogleAdsCustomer,
  tenant_id: string,
): AccountUpsert {
  return {
    tenant_id,
    platform: PLATFORM,
    external_account_id: customer.customer_id,
    name: customer.descriptive_name,
    currency: customer.currency_code,
    timezone: customer.time_zone,
  };
}

export function mapCampaign(
  campaign: GoogleAdsCampaign,
  tenant_id: string,
): CampaignUpsert {
  return {
    tenant_id,
    external_account_id: campaign.customer_id,
    external_id: campaign.campaign_id,
    name: campaign.name,
    status: mapStatus(campaign.status),
    objective: campaign.advertising_channel_type.toLowerCase(),
    budget_daily: campaign.budget_amount,
    start_date: campaign.start_date,
    end_date: campaign.end_date,
  };
}

export function mapAdGroup(
  adGroup: GoogleAdsAdGroup,
  tenant_id: string,
): AdsetUpsert {
  return {
    tenant_id,
    external_campaign_id: adGroup.campaign_id,
    external_id: adGroup.ad_group_id,
    name: adGroup.name,
    status: mapStatus(adGroup.status),
  };
}

/**
 * Een Google Ads RSA wordt gemapt naar:
 *   - 1× CreativeUpsert (de "ad-eenheid", met de eerste headline/description als preview)
 *   - 1× AdUpsert die naar die creative verwijst
 *   - N× CreativeAssetUpsert voor alle losse headlines en descriptions
 *
 * Voor non-RSA ads (image, video) leveren we alleen de creative + ad,
 * geen losse assets.
 */
export interface MappedAd {
  creative: CreativeUpsert;
  ad: AdUpsert;
  assets: CreativeAssetUpsert[];
}

export function mapAd(ad: GoogleAdsAd, tenant_id: string): MappedAd {
  const isRsa = ad.type.toUpperCase().includes('RESPONSIVE_SEARCH');
  const firstHeadline = ad.headlines?.[0]?.text;
  const firstDescription = ad.descriptions?.[0]?.text;

  const creative: CreativeUpsert = {
    tenant_id,
    platform: PLATFORM,
    external_id: ad.ad_id,
    name: ad.name ?? `Google Ads ${ad.type} ${ad.ad_id}`,
    type: isRsa ? 'text' : mapAdFormat(ad.type),
    headline: firstHeadline,
    body: firstDescription,
  };

  const adRow: AdUpsert = {
    tenant_id,
    external_adgroup_id: ad.ad_group_id,
    external_id: ad.ad_id,
    name: ad.name ?? `Ad ${ad.ad_id}`,
    status: mapStatus(ad.status),
    ad_format: mapAdFormat(ad.type),
    external_creative_id: ad.ad_id, // creative.external_id == ad.ad_id voor Google
  };

  const assets: CreativeAssetUpsert[] = [];

  if (ad.headlines) {
    for (let i = 0; i < ad.headlines.length; i++) {
      const h = ad.headlines[i];
      assets.push({
        tenant_id,
        platform: PLATFORM,
        // Gebruik asset_id als beschikbaar, anders genereer een stabiel ID
        external_id: h.asset_id ?? `${ad.ad_id}_h${i}`,
        asset_type: 'headline',
        content: h.text,
        performance_label: mapPerformanceLabel(h.performance_label),
        external_creative_id: ad.ad_id,
      });
    }
  }

  if (ad.descriptions) {
    for (let i = 0; i < ad.descriptions.length; i++) {
      const d = ad.descriptions[i];
      assets.push({
        tenant_id,
        platform: PLATFORM,
        external_id: d.asset_id ?? `${ad.ad_id}_d${i}`,
        asset_type: 'description',
        content: d.text,
        performance_label: mapPerformanceLabel(d.performance_label),
        external_creative_id: ad.ad_id,
      });
    }
  }

  return { creative, ad: adRow, assets };
}

/**
 * Losse PMax / cross-ad assets (zonder direct ad parent).
 */
export function mapAsset(
  asset: GoogleAdsAsset,
  tenant_id: string,
): CreativeAssetUpsert {
  const typeMap: Record<GoogleAdsAssetType, string> = {
    HEADLINE: 'headline',
    LONG_HEADLINE: 'long_headline',
    DESCRIPTION: 'description',
    IMAGE: 'image',
    VIDEO: 'video',
    LOGO: 'logo',
    SITELINK: 'sitelink',
    CALLOUT: 'callout',
  };

  return {
    tenant_id,
    platform: PLATFORM,
    external_id: asset.asset_id,
    asset_type: typeMap[asset.asset_type] ?? asset.asset_type.toLowerCase(),
    content: asset.text_content,
    url: asset.image_url,
    performance_label: mapPerformanceLabel(asset.performance_label),
  };
}

export function mapSearchTerm(
  term: GoogleAdsSearchTerm,
  tenant_id: string,
): SearchTermUpsert {
  return {
    tenant_id,
    platform: PLATFORM,
    date: term.date,
    external_campaign_id: term.campaign_id,
    external_adgroup_id: term.ad_group_id,
    search_term: term.search_term,
    match_type: term.match_type.toLowerCase(),
    impressions: term.impressions,
    clicks: term.clicks,
    spend: term.cost,
    conversions: term.conversions,
    conversion_value: term.conversions_value,
  };
}

export function mapMetricsRow(
  row: GoogleAdsMetricsRow,
  tenant_id: string,
): AdInsightUpsert {
  return {
    tenant_id,
    date: row.date,
    platform: PLATFORM,
    external_campaign_id: row.campaign_id,
    external_adgroup_id: row.ad_group_id,
    external_ad_id: row.ad_id,
    impressions: row.impressions,
    clicks: row.clicks,
    spend: row.cost,
    conversions: row.conversions,
    conversion_value: row.conversions_value,
    reach: 0,
  };
}
