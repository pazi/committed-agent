// ============================================
// Google Ads API — domain types
// ============================================
//
// Deze types beschrijven de vorm van data zoals we die van de Google Ads
// API verwachten *na* normalisatie door onze service. Ze zijn bewust
// platform-specifiek (snake_case Google Ads veldnamen blijven herkenbaar)
// maar gestript van de diepe nesting van de raw GAQL response.
//
// Mapping naar onze interne database types (Campaign, Ad, Creative, etc.)
// gebeurt in src/mappings/google-ads.mapping.ts.

export type GoogleAdsCampaignStatus = 'ENABLED' | 'PAUSED' | 'REMOVED' | 'UNKNOWN';
export type GoogleAdsAdGroupStatus = GoogleAdsCampaignStatus;
export type GoogleAdsAdStatus = GoogleAdsCampaignStatus;

export type GoogleAdsAdvertisingChannelType =
  | 'SEARCH'
  | 'DISPLAY'
  | 'SHOPPING'
  | 'VIDEO'
  | 'PERFORMANCE_MAX'
  | 'DEMAND_GEN'
  | 'LOCAL'
  | 'UNKNOWN';

/**
 * Performance label dat Google Ads zelf teruggeeft per asset binnen een RSA / PMax.
 * Gebruikt voor het bepalen of een asset vervangen moet worden.
 */
export type GoogleAdsAssetPerformanceLabel =
  | 'BEST'
  | 'GOOD'
  | 'LOW'
  | 'LEARNING'
  | 'PENDING'
  | 'UNRATED';

export type GoogleAdsAssetType =
  | 'HEADLINE'
  | 'LONG_HEADLINE'
  | 'DESCRIPTION'
  | 'IMAGE'
  | 'VIDEO'
  | 'LOGO'
  | 'SITELINK'
  | 'CALLOUT';

// --------------------------------------------
// Customer (account)
// --------------------------------------------
export interface GoogleAdsCustomer {
  customer_id: string; // 10-digit, zonder dashes
  descriptive_name: string;
  currency_code: string;
  time_zone: string;
  manager: boolean;
  test_account: boolean;
}

// --------------------------------------------
// Campaign
// --------------------------------------------
export interface GoogleAdsCampaign {
  customer_id: string;
  campaign_id: string;
  name: string;
  status: GoogleAdsCampaignStatus;
  advertising_channel_type: GoogleAdsAdvertisingChannelType;
  start_date?: string;
  end_date?: string;
  /** Daily budget in account currency (micros omgerekend naar units) */
  budget_amount?: number;
  bidding_strategy_type?: string;
}

// --------------------------------------------
// Ad Group (Google's equivalent van adset)
// --------------------------------------------
export interface GoogleAdsAdGroup {
  customer_id: string;
  campaign_id: string;
  ad_group_id: string;
  name: string;
  status: GoogleAdsAdGroupStatus;
  type?: string; // SEARCH_STANDARD, DISPLAY_STANDARD, etc.
  cpc_bid?: number;
}

// --------------------------------------------
// Ad
// --------------------------------------------
export interface GoogleAdsAd {
  customer_id: string;
  ad_group_id: string;
  ad_id: string;
  name?: string;
  status: GoogleAdsAdStatus;
  type: string; // RESPONSIVE_SEARCH_AD, IMAGE_AD, etc.
  final_urls: string[];
  /** Voor RSA: alle headlines met optioneel hun assignment id */
  headlines?: GoogleAdsTextAsset[];
  descriptions?: GoogleAdsTextAsset[];
  path1?: string;
  path2?: string;
}

export interface GoogleAdsTextAsset {
  asset_id?: string;
  text: string;
  pinned_field?: string;
  performance_label?: GoogleAdsAssetPerformanceLabel;
}

// --------------------------------------------
// Asset (los, voor PMax / cross-ad gebruik)
// --------------------------------------------
export interface GoogleAdsAsset {
  customer_id: string;
  asset_id: string;
  asset_type: GoogleAdsAssetType;
  text_content?: string;
  image_url?: string;
  video_id?: string;
  performance_label?: GoogleAdsAssetPerformanceLabel;
  /** Optionele koppeling naar de campaign / ad group / ad waar het asset aan hangt */
  campaign_id?: string;
  ad_group_id?: string;
}

// --------------------------------------------
// Search term (zoektermenrapport)
// --------------------------------------------
export interface GoogleAdsSearchTerm {
  customer_id: string;
  campaign_id: string;
  ad_group_id: string;
  date: string; // YYYY-MM-DD
  search_term: string;
  match_type: 'EXACT' | 'PHRASE' | 'BROAD' | 'NEAR_EXACT' | 'NEAR_PHRASE' | 'NONE';
  status: 'ADDED' | 'EXCLUDED' | 'ADDED_EXCLUDED' | 'NONE' | 'UNKNOWN';
  impressions: number;
  clicks: number;
  cost: number; // in account currency, niet micros
  conversions: number;
  conversions_value: number;
}

// --------------------------------------------
// Performance metrics row (los van entiteit)
// --------------------------------------------
export interface GoogleAdsMetricsRow {
  customer_id: string;
  campaign_id?: string;
  ad_group_id?: string;
  ad_id?: string;
  date: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  conversions_value: number;
  ctr?: number;
  average_cpc?: number;
}

// --------------------------------------------
// Query opties
// --------------------------------------------
export interface DateRange {
  start_date: string; // YYYY-MM-DD inclusive
  end_date: string;   // YYYY-MM-DD inclusive
}

export interface FetchOptions {
  customer_id: string;
  date_range: DateRange;
  /** Optionele filter op campaign IDs */
  campaign_ids?: string[];
}
