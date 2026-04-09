-- ============================================
-- Migration: 2026-04-09
-- Voegt platform + external_id toe aan creatives,
-- zodat creatives per platform-ad geüpsert kunnen worden.
-- ============================================

alter table creatives
  add column if not exists platform text,
  add column if not exists external_id text;

-- Unique key voor upsert per platform-ad combinatie.
-- We staan toe dat external_id null is voor handmatig aangemaakte
-- creatives — alleen rijen met een external_id moeten uniek zijn.
create unique index if not exists creatives_tenant_platform_external_uniq
  on creatives(tenant_id, platform, external_id)
  where external_id is not null;

create index if not exists idx_creatives_platform on creatives(tenant_id, platform)
  where platform is not null;
