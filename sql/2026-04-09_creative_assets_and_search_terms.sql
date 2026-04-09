-- ============================================
-- Migration: 2026-04-09
-- Voegt creative_assets en search_terms tabellen toe
-- voor inhoudelijke campagne bijsturing (stap 1: observability).
-- ============================================

-- --------------------------------------------
-- Creative Assets
-- Asset-level breakdown voor PMax / Advantage+ campagnes,
-- en losse onderdelen (headlines, descriptions, images, videos)
-- die binnen één creative kunnen worden gerouleerd.
-- --------------------------------------------
create table if not exists creative_assets (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  creative_id uuid references creatives(id) on delete cascade,

  -- Optionele platform referentie (voor PMax assets die geen 1-op-1 creative hebben)
  platform text,
  external_id text,

  asset_type text not null, -- headline, long_headline, description, image, video, logo, sitelink, callout
  content text,             -- tekst content (headline/description/etc.)
  url text,                 -- asset URL voor images/videos
  thumbnail_url text,

  -- Performance label dat het platform zelf teruggeeft
  performance_label text,   -- best, good, low, learning, pending, unrated

  -- Optionele eigen scoring (gevuld door onze automation)
  internal_score numeric(6,4),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (tenant_id, platform, external_id, asset_type)
);

create index if not exists idx_creative_assets_tenant on creative_assets(tenant_id);
create index if not exists idx_creative_assets_creative on creative_assets(creative_id);
create index if not exists idx_creative_assets_type on creative_assets(tenant_id, asset_type);

-- --------------------------------------------
-- Search Terms
-- Zoektermen / search query reports per platform
-- (Google Ads search queries, Meta search results, etc.)
-- Basis voor automatische negatives, nieuwe keywords, en
-- inhoudelijke targeting suggesties.
-- --------------------------------------------
create table if not exists search_terms (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  date date not null,
  platform text not null,

  account_id uuid references accounts(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete cascade,
  adset_id uuid references adsets(id) on delete cascade,

  search_term text not null,
  match_type text,          -- exact, phrase, broad, dynamic, none

  -- Performance metrics
  impressions integer not null default 0,
  clicks integer not null default 0,
  spend numeric(12,4) not null default 0,
  conversions numeric(12,4) not null default 0,
  conversion_value numeric(12,4) not null default 0,

  -- Status: hoe is deze term verwerkt door onze automation
  status text not null default 'active', -- active, added_as_keyword, added_as_negative, ignored
  reviewed_at timestamptz,
  reviewed_by text,

  created_at timestamptz not null default now(),

  -- Voorkom dubbele import per dag
  unique (tenant_id, date, platform, campaign_id, adset_id, search_term, match_type)
);

create index if not exists idx_search_terms_tenant_date on search_terms(tenant_id, date);
create index if not exists idx_search_terms_campaign on search_terms(campaign_id);
create index if not exists idx_search_terms_adset on search_terms(adset_id);
create index if not exists idx_search_terms_platform on search_terms(tenant_id, platform);
create index if not exists idx_search_terms_status on search_terms(tenant_id, status);

-- --------------------------------------------
-- Row Level Security
-- --------------------------------------------
alter table creative_assets enable row level security;
alter table search_terms enable row level security;
