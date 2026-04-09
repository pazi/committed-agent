import 'dotenv/config';
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

export class LiveGoogleAdsClient implements GoogleAdsClient {
  constructor(private readonly config: GoogleAdsConfig) {}

  private notImplemented(method: string): never {
    throw new Error(
      `LiveGoogleAdsClient.${method}() is nog niet geïmplementeerd. ` +
      `Wachten op Google Ads developer token en OAuth credentials. ` +
      `Zet GOOGLE_ADS_USE_STUB=true om de stub client te forceren.`,
    );
  }

  async getCustomer(): Promise<GoogleAdsCustomer> { this.notImplemented('getCustomer'); }
  async listAccessibleCustomers(): Promise<GoogleAdsCustomer[]> { this.notImplemented('listAccessibleCustomers'); }
  async getCampaigns(): Promise<GoogleAdsCampaign[]> { this.notImplemented('getCampaigns'); }
  async getAdGroups(): Promise<GoogleAdsAdGroup[]> { this.notImplemented('getAdGroups'); }
  async getAds(): Promise<GoogleAdsAd[]> { this.notImplemented('getAds'); }
  async getAssets(): Promise<GoogleAdsAsset[]> { this.notImplemented('getAssets'); }
  async getSearchTerms(): Promise<GoogleAdsSearchTerm[]> { this.notImplemented('getSearchTerms'); }
  async getMetrics(): Promise<GoogleAdsMetricsRow[]> { this.notImplemented('getMetrics'); }
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
