-- ============================================
-- Marketing Automation Platform — Database Schema
-- Supabase (PostgreSQL)
-- ============================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- --------------------------------------------
-- 1. Tenants (klanten/accounts in jullie systeem)
-- --------------------------------------------
create table tenants (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- --------------------------------------------
-- 2. Accounts (platform accounts per tenant)
-- --------------------------------------------
create table accounts (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  platform text not null, -- 'meta', 'google_ads', 'linkedin', 'tiktok', etc.
  external_account_id text not null,
  name text not null,
  currency text not null default 'EUR',
  timezone text not null default 'Europe/Amsterdam',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, platform, external_account_id)
);

create index idx_accounts_tenant on accounts(tenant_id);

-- --------------------------------------------
-- 3. Campaigns
-- --------------------------------------------
create table campaigns (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  external_id text not null,
  name text not null,
  status text not null default 'active', -- active, paused, archived
  objective text, -- awareness, traffic, conversions, etc.
  budget_daily numeric(12,2),
  budget_lifetime numeric(12,2),
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, external_id)
);

create index idx_campaigns_tenant on campaigns(tenant_id);
create index idx_campaigns_account on campaigns(account_id);

-- --------------------------------------------
-- 4. Adsets (advertentiegroepen)
-- --------------------------------------------
create table adsets (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  campaign_id uuid not null references campaigns(id) on delete cascade,
  external_id text not null,
  name text not null,
  status text not null default 'active',
  budget_daily numeric(12,2),
  budget_lifetime numeric(12,2),
  bid_strategy text,
  targeting jsonb, -- doelgroep targeting config
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, external_id)
);

create index idx_adsets_tenant on adsets(tenant_id);
create index idx_adsets_campaign on adsets(campaign_id);

-- --------------------------------------------
-- 5. Creatives (creaties — voor ads FK)
-- --------------------------------------------
create table creatives (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  type text not null, -- image, video, html, text
  url text, -- asset URL
  thumbnail_url text,
  headline text,
  body text,
  call_to_action text,
  -- Platform referentie voor upsert per externe ad
  platform text,
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_creatives_tenant on creatives(tenant_id);
create unique index creatives_tenant_platform_external_uniq
  on creatives(tenant_id, platform, external_id)
  where external_id is not null;
create index idx_creatives_platform on creatives(tenant_id, platform)
  where platform is not null;

-- --------------------------------------------
-- 6. Ads (advertenties)
-- --------------------------------------------
create table ads (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  adset_id uuid not null references adsets(id) on delete cascade,
  external_id text not null,
  name text not null,
  status text not null default 'active',
  creative_id uuid references creatives(id),
  ad_format text, -- image, video, carousel, etc.
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (adset_id, external_id)
);

create index idx_ads_tenant on ads(tenant_id);
create index idx_ads_adset on ads(adset_id);
create index idx_ads_creative on ads(creative_id);

-- --------------------------------------------
-- 7. Audiences (doelgroepen)
-- --------------------------------------------
create table audiences (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  platform text not null,
  external_id text,
  size integer,
  type text, -- custom, lookalike, saved, remarketing
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_audiences_tenant on audiences(tenant_id);

-- --------------------------------------------
-- 8. Ad Insights (fact table — kerndata)
-- --------------------------------------------
create table ad_insights (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  date date not null,
  hour smallint, -- 0-23, nullable voor dagelijks aggregaat
  platform text not null,
  account_id uuid references accounts(id),
  campaign_id uuid references campaigns(id),
  adset_id uuid references adsets(id),
  ad_id uuid references ads(id),
  creative_id uuid references creatives(id),

  -- Dimensies
  device text, -- mobile, desktop, tablet
  placement text, -- feed, stories, search, audience_network, website URL, zoekwoord
  age_range text, -- 18-24, 25-34, etc.
  gender text, -- male, female, unknown

  -- Bereik metrics
  impressions integer not null default 0,
  reach integer not null default 0,

  -- Performance metrics
  clicks integer not null default 0,
  spend numeric(12,4) not null default 0,
  conversions numeric(12,4) not null default 0,
  conversion_value numeric(12,4) not null default 0,

  -- Video metrics (optioneel)
  video_views integer default 0,
  video_completions integer default 0,

  -- Engagement (optioneel)
  likes integer default 0,
  shares integer default 0,
  comments integer default 0,

  created_at timestamptz not null default now(),

  -- Voorkom dubbele imports
  unique (tenant_id, date, hour, platform, campaign_id, adset_id, ad_id, device, placement)
);

-- Performance indexes
create index idx_insights_tenant_date on ad_insights(tenant_id, date);
create index idx_insights_campaign on ad_insights(campaign_id);
create index idx_insights_adset on ad_insights(adset_id);
create index idx_insights_ad on ad_insights(ad_id);
create index idx_insights_platform on ad_insights(tenant_id, platform);
create index idx_insights_device on ad_insights(tenant_id, device) where device is not null;
create index idx_insights_placement on ad_insights(tenant_id, placement) where placement is not null;
create index idx_insights_date_range on ad_insights(date, tenant_id);

-- --------------------------------------------
-- 8a. Creative Assets (asset-level breakdown)
-- Voor Google Ads RSA / Performance Max assets en
-- losse onderdelen die binnen één creative rouleren.
-- --------------------------------------------
create table creative_assets (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  creative_id uuid references creatives(id) on delete cascade,

  platform text,
  external_id text,

  asset_type text not null, -- headline, long_headline, description, image, video, logo, sitelink, callout
  content text,
  url text,
  thumbnail_url text,

  performance_label text,   -- best, good, low, learning, pending, unrated
  internal_score numeric(6,4),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (tenant_id, platform, external_id, asset_type)
);

create index idx_creative_assets_tenant on creative_assets(tenant_id);
create index idx_creative_assets_creative on creative_assets(creative_id);
create index idx_creative_assets_type on creative_assets(tenant_id, asset_type);

-- --------------------------------------------
-- 8b. Search Terms (zoektermenrapport)
-- Basis voor negatives, nieuwe keywords en inhoudelijke
-- targeting suggesties (primair Google Ads).
-- --------------------------------------------
create table search_terms (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  date date not null,
  platform text not null,

  account_id uuid references accounts(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete cascade,
  adset_id uuid references adsets(id) on delete cascade,

  search_term text not null,
  match_type text, -- exact, phrase, broad, dynamic, none

  impressions integer not null default 0,
  clicks integer not null default 0,
  spend numeric(12,4) not null default 0,
  conversions numeric(12,4) not null default 0,
  conversion_value numeric(12,4) not null default 0,

  status text not null default 'active', -- active, added_as_keyword, added_as_negative, ignored
  reviewed_at timestamptz,
  reviewed_by text,

  created_at timestamptz not null default now(),

  unique (tenant_id, date, platform, campaign_id, adset_id, search_term, match_type)
);

create index idx_search_terms_tenant_date on search_terms(tenant_id, date);
create index idx_search_terms_campaign on search_terms(campaign_id);
create index idx_search_terms_adset on search_terms(adset_id);
create index idx_search_terms_platform on search_terms(tenant_id, platform);
create index idx_search_terms_status on search_terms(tenant_id, status);

-- --------------------------------------------
-- 9. Benchmarks
-- --------------------------------------------
create table benchmarks (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  platform text not null, -- meta, google_ads, linkedin
  level text not null, -- campaign, adset, ad, creative, placement
  metric text not null, -- ctr, cpc, cpm, conversion_rate, roas
  min_value numeric(12,4),
  max_value numeric(12,4),
  target_value numeric(12,4),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, platform, level, metric)
);

create index idx_benchmarks_tenant on benchmarks(tenant_id);

-- --------------------------------------------
-- 10. Automation Rules
-- --------------------------------------------
create table automation_rules (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  description text,
  level text not null, -- campaign, adset, ad
  platform text, -- null = alle platformen

  -- Condities: [{ "metric": "ctr", "operator": "<", "value": 0.01 }]
  condition_json jsonb not null,

  -- Actie: { "type": "pause" | "adjust_budget" | "notify", "params": {...} }
  action_json jsonb not null,

  -- Mode: 'auto' voert direct uit, 'suggest' toont alleen suggestie
  mode text not null default 'suggest', -- 'auto' | 'suggest'

  active boolean not null default true,
  lookback_days integer not null default 7, -- evalueer data van afgelopen N dagen
  min_impressions integer not null default 100, -- minimum data voor evaluatie
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_rules_tenant on automation_rules(tenant_id);
create index idx_rules_active on automation_rules(tenant_id, active) where active = true;

-- --------------------------------------------
-- 11. Automation Logs
-- --------------------------------------------
create table automation_logs (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  rule_id uuid not null references automation_rules(id) on delete cascade,
  entity_type text not null, -- campaign, adset, ad
  entity_id uuid not null,
  action jsonb not null,
  status text not null, -- 'suggested', 'executed', 'failed', 'dismissed'
  metrics_snapshot jsonb, -- metrics op moment van evaluatie
  response text, -- API response of foutmelding
  reviewed_by text, -- wie heeft de suggestie goedgekeurd/afgewezen
  created_at timestamptz not null default now()
);

create index idx_logs_tenant on automation_logs(tenant_id);
create index idx_logs_rule on automation_logs(rule_id);
create index idx_logs_entity on automation_logs(entity_type, entity_id);
create index idx_logs_status on automation_logs(tenant_id, status);

-- ============================================
-- Row Level Security (RLS) — multi-tenant isolatie
-- ============================================

alter table tenants enable row level security;
alter table accounts enable row level security;
alter table campaigns enable row level security;
alter table adsets enable row level security;
alter table ads enable row level security;
alter table creatives enable row level security;
alter table audiences enable row level security;
alter table ad_insights enable row level security;
alter table creative_assets enable row level security;
alter table search_terms enable row level security;
alter table benchmarks enable row level security;
alter table automation_rules enable row level security;
alter table automation_logs enable row level security;

-- NB: RLS policies worden per applicatie ingesteld.
-- De service role key bypassed RLS, dus backend jobs werken altijd.
-- Voor frontend/API access voeg je policies toe zoals:
--
-- create policy "Tenant isolation" on accounts
--   for all using (tenant_id = auth.jwt()->>'tenant_id');
