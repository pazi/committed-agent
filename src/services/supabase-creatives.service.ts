import { supabase } from '../lib/supabase';

// ============================================
// Supabase Creatives Service
// ============================================
//
// Queries Supabase for creative content data that has been synced
// from Google Ads (and potentially other platforms).

/**
 * Fetch a campaign with its full nested content:
 * campaign → adsets → ads → creatives → creative_assets
 */
export async function getCampaignWithContent(campaignId: string) {
  const { data: campaign, error: campErr } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();

  if (campErr) throw new Error(`Failed to fetch campaign: ${campErr.message}`);

  const { data: adsets, error: adsetErr } = await supabase
    .from('adsets')
    .select('*')
    .eq('campaign_id', campaignId);

  if (adsetErr) throw new Error(`Failed to fetch adsets: ${adsetErr.message}`);

  const adsetIds = (adsets ?? []).map((a) => a.id);
  if (adsetIds.length === 0) {
    return { ...campaign, adsets: [] };
  }

  const { data: ads, error: adsErr } = await supabase
    .from('ads')
    .select('*')
    .in('adset_id', adsetIds);

  if (adsErr) throw new Error(`Failed to fetch ads: ${adsErr.message}`);

  const creativeIds = [...new Set((ads ?? []).map((a) => a.creative_id).filter(Boolean))];

  let creativesMap: Record<string, any> = {};
  if (creativeIds.length > 0) {
    const { data: creatives, error: crErr } = await supabase
      .from('creatives')
      .select('*')
      .in('id', creativeIds);

    if (crErr) throw new Error(`Failed to fetch creatives: ${crErr.message}`);

    const { data: assets, error: assetErr } = await supabase
      .from('creative_assets')
      .select('*')
      .in('creative_id', creativeIds);

    if (assetErr) throw new Error(`Failed to fetch creative_assets: ${assetErr.message}`);

    for (const c of creatives ?? []) {
      creativesMap[c.id] = {
        ...c,
        assets: (assets ?? []).filter((a) => a.creative_id === c.id),
      };
    }
  }

  // Nest everything together
  const adsWithCreatives = (ads ?? []).map((ad) => ({
    ...ad,
    creative: ad.creative_id ? creativesMap[ad.creative_id] ?? null : null,
  }));

  const adsetsWithAds = (adsets ?? []).map((adset) => ({
    ...adset,
    ads: adsWithCreatives.filter((ad) => ad.adset_id === adset.id),
  }));

  return { ...campaign, adsets: adsetsWithAds };
}

/**
 * Fetch all creative_assets for a campaign, joined through
 * adsets → ads → creatives → creative_assets. Includes performance_label.
 */
export async function getCreativeAssetsByCampaign(campaignId: string) {
  const { data: adsets } = await supabase
    .from('adsets')
    .select('id')
    .eq('campaign_id', campaignId);

  const adsetIds = (adsets ?? []).map((a) => a.id);
  if (adsetIds.length === 0) return [];

  const { data: ads } = await supabase
    .from('ads')
    .select('id, creative_id')
    .in('adset_id', adsetIds);

  const creativeIds = [...new Set((ads ?? []).map((a) => a.creative_id).filter(Boolean))];
  if (creativeIds.length === 0) return [];

  const { data: assets, error } = await supabase
    .from('creative_assets')
    .select('id, creative_id, platform, external_id, asset_type, content, url, performance_label')
    .in('creative_id', creativeIds);

  if (error) throw new Error(`Failed to fetch creative_assets: ${error.message}`);

  return assets ?? [];
}

/**
 * Fetch search_terms for a campaign, ordered by spend desc.
 * Defaults to last 30 days.
 */
export async function getSearchTermsByCampaign(campaignId: string, days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().split('T')[0]; // YYYY-MM-DD

  const { data, error } = await supabase
    .from('search_terms')
    .select('*')
    .eq('campaign_id', campaignId)
    .gte('date', sinceStr)
    .order('spend', { ascending: false });

  if (error) throw new Error(`Failed to fetch search_terms: ${error.message}`);

  return data ?? [];
}

/**
 * List all campaigns with basic info. Optionally filter by tenant slug.
 */
export async function getCampaignsList(tenantSlug?: string) {
  let query = supabase
    .from('campaigns')
    .select(`
      id,
      tenant_id,
      account_id,
      external_id,
      name,
      status,
      objective,
      budget_daily,
      accounts!inner ( id, platform, name )
    `)
    .order('name');

  if (tenantSlug) {
    // Look up tenant id from slug first
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', tenantSlug)
      .single();

    if (tenant) {
      query = query.eq('tenant_id', tenant.id);
    }
  }

  const { data, error } = await query;

  if (error) throw new Error(`Failed to fetch campaigns: ${error.message}`);

  return data ?? [];
}

/**
 * Return a compact text summary of all creatives + assets for a campaign,
 * suitable for feeding into an AI context window.
 */
export async function getCampaignCreativeSummary(campaignId: string) {
  const campaign = await getCampaignWithContent(campaignId);
  const lines: string[] = [];

  lines.push(`Campaign: ${campaign.name} (${campaign.status})`);
  lines.push(`Objective: ${campaign.objective ?? 'n/a'} | Daily budget: ${campaign.budget_daily ?? 'n/a'}`);
  lines.push('');

  for (const adset of campaign.adsets ?? []) {
    lines.push(`  Ad Set: ${adset.name} (${adset.status})`);
    lines.push(`  Bid strategy: ${adset.bid_strategy ?? 'n/a'}`);

    for (const ad of adset.ads ?? []) {
      lines.push(`    Ad: ${ad.name} (${ad.status}, format: ${ad.ad_format ?? 'n/a'})`);

      const creative = ad.creative;
      if (creative) {
        lines.push(`      Creative: ${creative.name} (${creative.type})`);
        if (creative.headline) lines.push(`        Headline: ${creative.headline}`);
        if (creative.body) lines.push(`        Body: ${creative.body}`);
        if (creative.call_to_action) lines.push(`        CTA: ${creative.call_to_action}`);

        for (const asset of creative.assets ?? []) {
          const label = asset.performance_label ? ` [${asset.performance_label}]` : '';
          const value = asset.content || asset.url || '';
          lines.push(`        Asset (${asset.asset_type}): ${value}${label}`);
        }
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}
