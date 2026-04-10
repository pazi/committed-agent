import 'dotenv/config';
import { GoogleAdsApi } from 'google-ads-api';
import type { Customer as GadsCustomer } from 'google-ads-api';
import type {
  FetchOptions,
  GoogleAdsAd,
  GoogleAdsAdGroup,
  GoogleAdsAsset,
  GoogleAdsCampaign,
  GoogleAdsCustomer,
  GoogleAdsMetricsRow,
  GoogleAdsSearchTerm,
} from '../types/google-ads.js';

// ============================================
// Google Ads service
// ============================================
//
// Dit bestand definieert het *contract* tussen de rest van de tool en
// de Google Ads API. We werken bewust met een interface zodat we:
//
//   1. Nu al door kunnen ontwikkelen tegen een StubGoogleAdsClient,
//      voordat de developer token / OAuth credentials binnen zijn.
//   2. De echte client (LiveGoogleAdsClient) later kunnen inpluggen
//      zonder dat de mappers, jobs of automation rules veranderen.
//   3. In tests een mock kunnen injecteren.
//
// De factory createGoogleAdsClient() kiest op basis van env vars welke
// implementatie er teruggegeven wordt.

// --------------------------------------------
// Public interface
// --------------------------------------------

export interface GoogleAdsClient {
  /** Haal customer (account) info op voor één customer ID. */
  getCustomer(customer_id: string): Promise<GoogleAdsCustomer>;

  /** Lijst alle customers waar de huidige login customer toegang toe heeft. */
  listAccessibleCustomers(): Promise<GoogleAdsCustomer[]>;

  /** Haal campaigns op voor een customer (optioneel binnen een datumrange). */
  getCampaigns(opts: FetchOptions): Promise<GoogleAdsCampaign[]>;

  /** Haal ad groups op. */
  getAdGroups(opts: FetchOptions): Promise<GoogleAdsAdGroup[]>;

  /** Haal ads op (incl. RSA headlines/descriptions). */
  getAds(opts: FetchOptions): Promise<GoogleAdsAd[]>;

  /** Haal losse assets op (PMax + cross-ad assets). */
  getAssets(opts: FetchOptions): Promise<GoogleAdsAsset[]>;

  /** Haal het zoektermenrapport op. */
  getSearchTerms(opts: FetchOptions): Promise<GoogleAdsSearchTerm[]>;

  /** Haal metrics rows op (per dag/campaign/ad group/ad afhankelijk van granulariteit). */
  getMetrics(opts: FetchOptions & { level: 'campaign' | 'ad_group' | 'ad' }): Promise<GoogleAdsMetricsRow[]>;
}

// --------------------------------------------
// Configuration
// --------------------------------------------

export interface GoogleAdsConfig {
  developer_token: string;
  client_id: string;
  client_secret: string;
  refresh_token: string;
  /** MCC ID (zonder dashes) — optioneel, alleen nodig bij manager accounts */
  login_customer_id?: string;
}

/**
 * Lees de Google Ads config uit env vars.
 * Returnt null als één van de verplichte vars ontbreekt — de factory
 * valt dan terug op de stub client.
 */
export function readGoogleAdsConfigFromEnv(): GoogleAdsConfig | null {
  const developer_token = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const client_id = process.env.GOOGLE_ADS_CLIENT_ID;
  const client_secret = process.env.GOOGLE_ADS_CLIENT_SECRET;
  const refresh_token = process.env.GOOGLE_ADS_REFRESH_TOKEN;
  const login_customer_id = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;

  if (!developer_token || !client_id || !client_secret || !refresh_token) {
    return null;
  }

  return {
    developer_token,
    client_id,
    client_secret,
    refresh_token,
    login_customer_id,
  };
}

// --------------------------------------------
// Stub implementation
// --------------------------------------------
//
// Deterministische fake data zodat de rest van de pipeline kan worden
// ontwikkeld voordat de echte credentials binnen zijn. De stub geeft
// genoeg variatie zodat creative fatigue / search term automation
// rules getest kunnen worden, maar bevat geen toevalsruis (zelfde
// input → zelfde output) zodat tests stabiel blijven.

export class StubGoogleAdsClient implements GoogleAdsClient {
  async getCustomer(customer_id: string): Promise<GoogleAdsCustomer> {
    return {
      customer_id,
      descriptive_name: `Stub Customer ${customer_id}`,
      currency_code: 'EUR',
      time_zone: 'Europe/Amsterdam',
      manager: false,
      test_account: true,
    };
  }

  async listAccessibleCustomers(): Promise<GoogleAdsCustomer[]> {
    return [await this.getCustomer('1234567890')];
  }

  async getCampaigns({ customer_id }: FetchOptions): Promise<GoogleAdsCampaign[]> {
    return [
      {
        customer_id,
        campaign_id: '11111111',
        name: 'Stub — Search Brand',
        status: 'ENABLED',
        advertising_channel_type: 'SEARCH',
        budget_amount: 50,
        bidding_strategy_type: 'TARGET_CPA',
      },
      {
        customer_id,
        campaign_id: '22222222',
        name: 'Stub — Performance Max',
        status: 'ENABLED',
        advertising_channel_type: 'PERFORMANCE_MAX',
        budget_amount: 120,
        bidding_strategy_type: 'MAXIMIZE_CONVERSION_VALUE',
      },
    ];
  }

  async getAdGroups({ customer_id }: FetchOptions): Promise<GoogleAdsAdGroup[]> {
    return [
      {
        customer_id,
        campaign_id: '11111111',
        ad_group_id: '101',
        name: 'Stub Ad Group — Brand exact',
        status: 'ENABLED',
        type: 'SEARCH_STANDARD',
      },
    ];
  }

  async getAds({ customer_id }: FetchOptions): Promise<GoogleAdsAd[]> {
    return [
      {
        customer_id,
        ad_group_id: '101',
        ad_id: '9001',
        status: 'ENABLED',
        type: 'RESPONSIVE_SEARCH_AD',
        final_urls: ['https://example.com'],
        headlines: [
          { asset_id: 'h1', text: 'Koop nu — gratis verzending', performance_label: 'BEST' },
          { asset_id: 'h2', text: 'Officiële webshop',           performance_label: 'GOOD' },
          { asset_id: 'h3', text: 'Beste prijs garantie',         performance_label: 'LOW' },
        ],
        descriptions: [
          { asset_id: 'd1', text: 'Snelle levering, gratis retour.', performance_label: 'GOOD' },
          { asset_id: 'd2', text: 'Tevreden of geld terug.',         performance_label: 'LEARNING' },
        ],
      },
    ];
  }

  async getAssets({ customer_id }: FetchOptions): Promise<GoogleAdsAsset[]> {
    return [
      {
        customer_id,
        asset_id: 'h1',
        asset_type: 'HEADLINE',
        text_content: 'Koop nu — gratis verzending',
        performance_label: 'BEST',
        campaign_id: '22222222',
      },
      {
        customer_id,
        asset_id: 'h3',
        asset_type: 'HEADLINE',
        text_content: 'Beste prijs garantie',
        performance_label: 'LOW',
        campaign_id: '22222222',
      },
    ];
  }

  async getSearchTerms({ customer_id, date_range }: FetchOptions): Promise<GoogleAdsSearchTerm[]> {
    return [
      {
        customer_id,
        campaign_id: '11111111',
        ad_group_id: '101',
        date: date_range.end_date,
        search_term: 'merknaam korting',
        match_type: 'PHRASE',
        status: 'NONE',
        impressions: 1240,
        clicks: 87,
        cost: 12.34,
        conversions: 5,
        conversions_value: 250,
      },
      {
        customer_id,
        campaign_id: '11111111',
        ad_group_id: '101',
        date: date_range.end_date,
        search_term: 'gratis merknaam download',
        match_type: 'BROAD',
        status: 'NONE',
        impressions: 890,
        clicks: 45,
        cost: 6.10,
        conversions: 0,
        conversions_value: 0,
      },
    ];
  }

  async getMetrics({
    customer_id,
    date_range,
    level,
  }: FetchOptions & { level: 'campaign' | 'ad_group' | 'ad' }): Promise<GoogleAdsMetricsRow[]> {
    return [
      {
        customer_id,
        campaign_id: '11111111',
        ad_group_id: level !== 'campaign' ? '101' : undefined,
        ad_id: level === 'ad' ? '9001' : undefined,
        date: date_range.end_date,
        impressions: 5400,
        clicks: 312,
        cost: 48.75,
        conversions: 18,
        conversions_value: 920,
      },
    ];
  }
}

// --------------------------------------------
// Live implementation (placeholder)
// --------------------------------------------
//
// Wordt geïmplementeerd zodra de developer token + OAuth credentials
// binnen zijn. We kiezen voor de google-ads-api npm package
// (https://www.npmjs.com/package/google-ads-api) zodra we 'm
// installeren. Voor nu gooien alle methods een duidelijke error
// zodat het direct opvalt als iets per ongeluk de echte client probeert
// te gebruiken zonder credentials.

// Enum lookup tables — de google-ads-api library retourneert soms numerieke
// enum values i.p.v. strings. Deze maps vertalen terug naar de string names
// die onze types en mappings verwachten.
const CAMPAIGN_STATUS: Record<number, string> = { 0: 'UNSPECIFIED', 1: 'UNKNOWN', 2: 'ENABLED', 3: 'PAUSED', 4: 'REMOVED' };
const AD_GROUP_STATUS = CAMPAIGN_STATUS;
const AD_GROUP_AD_STATUS = CAMPAIGN_STATUS;
const CHANNEL_TYPE: Record<number, string> = {
  0: 'UNSPECIFIED', 1: 'UNKNOWN', 2: 'SEARCH', 3: 'DISPLAY', 4: 'SHOPPING',
  5: 'HOTEL', 6: 'VIDEO', 7: 'MULTI_CHANNEL', 8: 'LOCAL', 9: 'SMART',
  10: 'PERFORMANCE_MAX', 11: 'LOCAL_SERVICES', 12: 'DISCOVERY', 13: 'TRAVEL',
  14: 'DEMAND_GEN',
};
const AD_TYPE: Record<number, string> = {
  0: 'UNSPECIFIED', 1: 'UNKNOWN', 2: 'TEXT_AD', 3: 'EXPANDED_TEXT_AD',
  6: 'HOTEL_AD', 7: 'SHOPPING_SMART_AD', 8: 'SHOPPING_PRODUCT_AD',
  12: 'IMAGE_AD', 13: 'VIDEO_AD', 15: 'RESPONSIVE_SEARCH_AD',
  19: 'APP_AD', 22: 'RESPONSIVE_DISPLAY_AD', 25: 'CALL_AD',
  33: 'DISCOVERY_MULTI_ASSET_AD', 34: 'DISCOVERY_CAROUSEL_AD',
  35: 'TRAVEL_AD', 36: 'SMART_CAMPAIGN_AD', 38: 'DEMAND_GEN_PRODUCT_AD',
};
const ASSET_TYPE: Record<number, string> = {
  0: 'UNSPECIFIED', 1: 'UNKNOWN', 2: 'YOUTUBE_VIDEO', 3: 'MEDIA_BUNDLE',
  4: 'IMAGE', 5: 'TEXT', 6: 'LEAD_FORM', 7: 'BOOK_ON_GOOGLE',
  8: 'PROMOTION', 9: 'CALLOUT', 10: 'STRUCTURED_SNIPPET',
  11: 'SITELINK', 13: 'PAGE_FEED', 14: 'DYNAMIC_EDUCATION',
  15: 'MOBILE_APP', 16: 'HOTEL_CALLOUT', 17: 'CALL', 18: 'PRICE',
  19: 'HOTEL_PROPERTY',
};
const PERF_LABEL: Record<number, string> = {
  0: 'UNSPECIFIED', 1: 'UNKNOWN', 2: 'BEST', 3: 'GOOD', 4: 'LOW', 5: 'LEARNING', 6: 'PENDING',
};
const MATCH_TYPE: Record<number, string> = {
  0: 'UNSPECIFIED', 1: 'UNKNOWN', 2: 'EXACT', 3: 'PHRASE', 4: 'BROAD', 5: 'NEAR_EXACT', 6: 'NEAR_PHRASE',
};
const SEARCH_TERM_STATUS: Record<number, string> = {
  0: 'UNSPECIFIED', 1: 'UNKNOWN', 2: 'ADDED', 3: 'EXCLUDED', 4: 'ADDED_EXCLUDED', 5: 'NONE',
};

/** Vertaal een waarde die string of number kan zijn naar een string via een lookup table. */
function enumStr(value: unknown, map: Record<number, string>, fallback = 'UNKNOWN'): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return map[value] ?? fallback;
  return fallback;
}

export class LiveGoogleAdsClient implements GoogleAdsClient {
  private readonly api: InstanceType<typeof GoogleAdsApi>;
  private readonly config: GoogleAdsConfig;

  constructor(config: GoogleAdsConfig) {
    this.config = config;
    this.api = new GoogleAdsApi({
      client_id: config.client_id,
      client_secret: config.client_secret,
      developer_token: config.developer_token,
    });
  }

  /** Maak een Customer instance voor de gegeven (of standaard) customer_id. */
  private customer(customer_id?: string): GadsCustomer {
    return this.api.Customer({
      customer_id: customer_id ?? process.env.GOOGLE_ADS_CUSTOMER_ID ?? '',
      refresh_token: this.config.refresh_token,
      login_customer_id: this.config.login_customer_id,
    });
  }

  /** Zet micros (× 1.000.000) om naar gewone currency units. */
  private micros(value: number | Long | null | undefined): number {
    if (value == null) return 0;
    return Number(value) / 1_000_000;
  }

  async getCustomer(customer_id: string): Promise<GoogleAdsCustomer> {
    const cust = this.customer(customer_id);
    const rows = await cust.query(`
      SELECT
        customer.id,
        customer.descriptive_name,
        customer.currency_code,
        customer.time_zone,
        customer.manager,
        customer.test_account
      FROM customer
      LIMIT 1
    `);
    const r = rows[0]?.customer;
    if (!r) throw new Error(`Customer ${customer_id} niet gevonden`);
    return {
      customer_id: String(r.id),
      descriptive_name: r.descriptive_name ?? '',
      currency_code: r.currency_code ?? 'EUR',
      time_zone: r.time_zone ?? 'Europe/Amsterdam',
      manager: r.manager ?? false,
      test_account: r.test_account ?? false,
    };
  }

  async listAccessibleCustomers(): Promise<GoogleAdsCustomer[]> {
    const response = await this.api.listAccessibleCustomers(this.config.refresh_token);
    const ids = response.resource_names?.map((rn) => String(rn).replace('customers/', '')) ?? [];
    const results: GoogleAdsCustomer[] = [];
    for (const id of ids) {
      try {
        results.push(await this.getCustomer(id));
      } catch {
        // Sommige accessible customers zijn niet opvraagbaar (bv. MCC zonder directe toegang)
      }
    }
    return results;
  }

  async getCampaigns({ customer_id, date_range }: FetchOptions): Promise<GoogleAdsCampaign[]> {
    const cust = this.customer(customer_id);
    const rows = await cust.query(`
      SELECT
        customer.id,
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.advertising_channel_type,
        campaign_budget.amount_micros,
        campaign.bidding_strategy_type
      FROM campaign
      WHERE segments.date BETWEEN '${date_range.start_date}' AND '${date_range.end_date}'
        AND campaign.status != 'REMOVED'
    `);

    return rows.map((row: any) => ({
      customer_id: String(row.customer?.id ?? customer_id),
      campaign_id: String(row.campaign?.id),
      name: row.campaign?.name ?? '',
      status: enumStr(row.campaign?.status, CAMPAIGN_STATUS) as GoogleAdsCampaign['status'],
      advertising_channel_type: enumStr(row.campaign?.advertising_channel_type, CHANNEL_TYPE) as GoogleAdsCampaign['advertising_channel_type'],
      budget_amount: this.micros(row.campaign_budget?.amount_micros),
      bidding_strategy_type: row.campaign?.bidding_strategy_type != null ? String(row.campaign.bidding_strategy_type) : undefined,
    }));
  }

  async getAdGroups({ customer_id, date_range }: FetchOptions): Promise<GoogleAdsAdGroup[]> {
    const cust = this.customer(customer_id);
    const rows = await cust.query(`
      SELECT
        customer.id,
        campaign.id,
        ad_group.id,
        ad_group.name,
        ad_group.status,
        ad_group.type,
        ad_group.cpc_bid_micros
      FROM ad_group
      WHERE segments.date BETWEEN '${date_range.start_date}' AND '${date_range.end_date}'
        AND ad_group.status != 'REMOVED'
    `);

    return rows.map((row: any) => ({
      customer_id: String(row.customer?.id ?? customer_id),
      campaign_id: String(row.campaign?.id),
      ad_group_id: String(row.ad_group?.id),
      name: row.ad_group?.name ?? '',
      status: enumStr(row.ad_group?.status, AD_GROUP_STATUS) as GoogleAdsAdGroup['status'],
      type: row.ad_group?.type != null ? String(row.ad_group.type) : undefined,
      cpc_bid: row.ad_group?.cpc_bid_micros ? this.micros(row.ad_group.cpc_bid_micros) : undefined,
    }));
  }

  async getAds({ customer_id, date_range }: FetchOptions): Promise<GoogleAdsAd[]> {
    const cust = this.customer(customer_id);
    const rows = await cust.query(`
      SELECT
        customer.id,
        ad_group.id,
        ad_group_ad.ad.id,
        ad_group_ad.ad.name,
        ad_group_ad.status,
        ad_group_ad.ad.type,
        ad_group_ad.ad.final_urls,
        ad_group_ad.ad.responsive_search_ad.headlines,
        ad_group_ad.ad.responsive_search_ad.descriptions,
        ad_group_ad.ad.responsive_search_ad.path1,
        ad_group_ad.ad.responsive_search_ad.path2,
        ad_group_ad.ad.expanded_text_ad.headline_part1,
        ad_group_ad.ad.expanded_text_ad.headline_part2,
        ad_group_ad.ad.expanded_text_ad.headline_part3,
        ad_group_ad.ad.expanded_text_ad.description,
        ad_group_ad.ad.expanded_text_ad.description2
      FROM ad_group_ad
      WHERE segments.date BETWEEN '${date_range.start_date}' AND '${date_range.end_date}'
        AND ad_group_ad.status != 'REMOVED'
    `);

    return rows.map((row: any) => {
      const ad = row.ad_group_ad?.ad ?? {};
      const rsa = ad.responsive_search_ad;
      const eta = ad.expanded_text_ad;

      // RSA headlines/descriptions
      let headlines = rsa?.headlines?.map((h: any) => ({
        asset_id: h.asset ? String(h.asset).replace(/^customers\/\d+\/assets\//, '') : undefined,
        text: h.text ?? '',
        pinned_field: h.pinned_field != null ? String(h.pinned_field) : undefined,
        performance_label: enumStr(h.performance_label, PERF_LABEL) as any,
      })) ?? undefined;

      let descriptions = rsa?.descriptions?.map((d: any) => ({
        asset_id: d.asset ? String(d.asset).replace(/^customers\/\d+\/assets\//, '') : undefined,
        text: d.text ?? '',
        pinned_field: d.pinned_field != null ? String(d.pinned_field) : undefined,
        performance_label: enumStr(d.performance_label, PERF_LABEL) as any,
      })) ?? undefined;

      // ETA: converteer naar zelfde formaat als RSA headlines/descriptions
      if (!headlines && eta) {
        headlines = [eta.headline_part1, eta.headline_part2, eta.headline_part3]
          .filter(Boolean)
          .map((text: string) => ({ text }));
      }
      if (!descriptions && eta) {
        descriptions = [eta.description, eta.description2]
          .filter(Boolean)
          .map((text: string) => ({ text }));
      }

      return {
        customer_id: String(row.customer?.id ?? customer_id),
        ad_group_id: String(row.ad_group?.id),
        ad_id: String(ad.id),
        name: ad.name ?? undefined,
        status: enumStr(row.ad_group_ad?.status, AD_GROUP_AD_STATUS) as GoogleAdsAd['status'],
        type: enumStr(ad.type, AD_TYPE),
        final_urls: ad.final_urls ?? [],
        headlines,
        descriptions,
        path1: rsa?.path1 ?? undefined,
        path2: rsa?.path2 ?? undefined,
      };
    });
  }

  async getAssets({ customer_id, date_range }: FetchOptions): Promise<GoogleAdsAsset[]> {
    const cust = this.customer(customer_id);
    // Haal campaign-level assets op (vooral relevant voor PMax)
    const rows = await cust.query(`
      SELECT
        customer.id,
        asset.id,
        asset.type,
        asset.text_asset.text,
        asset.image_asset.full_size.url,
        asset.youtube_video_asset.youtube_video_id,
        campaign_asset.campaign
      FROM campaign_asset
      WHERE segments.date BETWEEN '${date_range.start_date}' AND '${date_range.end_date}'
    `);

    return rows.map((row: any) => {
      const asset = row.asset ?? {};
      const campaignResource = row.campaign_asset?.campaign ?? '';
      // Extraheer campaign_id uit resource name "customers/123/campaigns/456"
      const campaignIdMatch = String(campaignResource).match(/campaigns\/(\d+)/);

      return {
        customer_id: String(row.customer?.id ?? customer_id),
        asset_id: String(asset.id),
        asset_type: enumStr(asset.type, ASSET_TYPE) as GoogleAdsAsset['asset_type'],
        text_content: asset.text_asset?.text ?? undefined,
        image_url: asset.image_asset?.full_size?.url ?? undefined,
        video_id: asset.youtube_video_asset?.youtube_video_id ?? undefined,
        performance_label: undefined,
        campaign_id: campaignIdMatch ? campaignIdMatch[1] : undefined,
      };
    });
  }

  async getSearchTerms({ customer_id, date_range }: FetchOptions): Promise<GoogleAdsSearchTerm[]> {
    const cust = this.customer(customer_id);
    const rows = await cust.query(`
      SELECT
        customer.id,
        campaign.id,
        ad_group.id,
        segments.date,
        search_term_view.search_term,
        search_term_view.status,
        segments.search_term_match_type,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value
      FROM search_term_view
      WHERE segments.date BETWEEN '${date_range.start_date}' AND '${date_range.end_date}'
    `);

    return rows.map((row: any) => ({
      customer_id: String(row.customer?.id ?? customer_id),
      campaign_id: String(row.campaign?.id),
      ad_group_id: String(row.ad_group?.id),
      date: row.segments?.date ?? date_range.end_date,
      search_term: row.search_term_view?.search_term ?? '',
      match_type: enumStr(row.segments?.search_term_match_type, MATCH_TYPE, 'NONE') as GoogleAdsSearchTerm['match_type'],
      status: enumStr(row.search_term_view?.status, SEARCH_TERM_STATUS, 'NONE') as GoogleAdsSearchTerm['status'],
      impressions: Number(row.metrics?.impressions ?? 0),
      clicks: Number(row.metrics?.clicks ?? 0),
      cost: this.micros(row.metrics?.cost_micros),
      conversions: Number(row.metrics?.conversions ?? 0),
      conversions_value: Number(row.metrics?.conversions_value ?? 0),
    }));
  }

  async getMetrics({
    customer_id,
    date_range,
    level,
  }: FetchOptions & { level: 'campaign' | 'ad_group' | 'ad' }): Promise<GoogleAdsMetricsRow[]> {
    const cust = this.customer(customer_id);

    // Bouw SELECT en FROM dynamisch op basis van granulariteit
    const selects = [
      'customer.id',
      'campaign.id',
      'segments.date',
      'metrics.impressions',
      'metrics.clicks',
      'metrics.cost_micros',
      'metrics.conversions',
      'metrics.conversions_value',
      'metrics.ctr',
      'metrics.average_cpc',
    ];

    let from: string;
    if (level === 'campaign') {
      from = 'campaign';
    } else if (level === 'ad_group') {
      selects.push('ad_group.id');
      from = 'ad_group';
    } else {
      selects.push('ad_group.id', 'ad_group_ad.ad.id');
      from = 'ad_group_ad';
    }

    const rows = await cust.query(`
      SELECT ${selects.join(', ')}
      FROM ${from}
      WHERE segments.date BETWEEN '${date_range.start_date}' AND '${date_range.end_date}'
    `);

    return rows.map((row: any) => ({
      customer_id: String(row.customer?.id ?? customer_id),
      campaign_id: String(row.campaign?.id),
      ad_group_id: row.ad_group?.id ? String(row.ad_group.id) : undefined,
      ad_id: row.ad_group_ad?.ad?.id ? String(row.ad_group_ad.ad.id) : undefined,
      date: row.segments?.date ?? date_range.end_date,
      impressions: Number(row.metrics?.impressions ?? 0),
      clicks: Number(row.metrics?.clicks ?? 0),
      cost: this.micros(row.metrics?.cost_micros),
      conversions: Number(row.metrics?.conversions ?? 0),
      conversions_value: Number(row.metrics?.conversions_value ?? 0),
      ctr: row.metrics?.ctr != null ? Number(row.metrics.ctr) : undefined,
      average_cpc: row.metrics?.average_cpc != null ? this.micros(row.metrics.average_cpc) : undefined,
    }));
  }
}

// --------------------------------------------
// Factory
// --------------------------------------------

/**
 * Geeft de juiste GoogleAdsClient terug op basis van env vars.
 *
 * Beslissing:
 *   - GOOGLE_ADS_USE_STUB=true            → altijd stub
 *   - geen volledige config in env        → stub (met waarschuwing)
 *   - volledige config aanwezig            → live client
 */
export function createGoogleAdsClient(): GoogleAdsClient {
  if (process.env.GOOGLE_ADS_USE_STUB === 'true') {
    return new StubGoogleAdsClient();
  }

  const config = readGoogleAdsConfigFromEnv();
  if (!config) {
    console.warn(
      '[google-ads] Geen volledige Google Ads credentials in env. ' +
      'Gebruik StubGoogleAdsClient. Vul .env aan met GOOGLE_ADS_DEVELOPER_TOKEN, ' +
      'GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET en GOOGLE_ADS_REFRESH_TOKEN.',
    );
    return new StubGoogleAdsClient();
  }

  return new LiveGoogleAdsClient(config);
}
