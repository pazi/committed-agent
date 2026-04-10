import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    // Campaign met account info
    const { data: campaign, error: campErr } = await supabase
      .from('campaigns')
      .select(`
        *,
        accounts (
          id,
          platform,
          name
        )
      `)
      .eq('id', id)
      .single();

    if (campErr || !campaign) {
      return Response.json(
        { error: campErr?.message ?? 'Campagne niet gevonden' },
        { status: 404 },
      );
    }

    // Adsets met ads, creatives en creative_assets
    const { data: adsets } = await supabase
      .from('adsets')
      .select(`
        *,
        ads (
          *,
          creatives (
            *,
            creative_assets (*)
          )
        )
      `)
      .eq('campaign_id', id)
      .order('name');

    // Search terms (laatste 30 dagen, top 100 op spend)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: searchTerms } = await supabase
      .from('search_terms')
      .select('*')
      .eq('campaign_id', id)
      .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
      .order('spend', { ascending: false })
      .limit(100);

    const platformLabels: Record<string, string> = {
      google_ads: 'Google Ads',
      meta: 'Facebook Ads',
      linkedin: 'LinkedIn Ads',
      reddit: 'Reddit Ads',
    };
    const rawPlatform = campaign.accounts?.platform;

    return Response.json({
      ...campaign,
      platform: platformLabels[rawPlatform] ?? rawPlatform ?? null,
      account_name: campaign.accounts?.name ?? null,
      adsets: adsets ?? [],
      search_terms: searchTerms ?? [],
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Fout bij ophalen campagne' },
      { status: 500 },
    );
  }
}
