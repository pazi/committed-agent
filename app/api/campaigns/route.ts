import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('campaigns')
      .select(`
        id,
        name,
        status,
        objective,
        budget_daily,
        account_id,
        accounts (
          id,
          platform,
          name
        )
      `)
      .order('name');

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    const platformLabels: Record<string, string> = {
      google_ads: 'Google Ads',
      meta: 'Facebook Ads',
      linkedin: 'LinkedIn Ads',
      reddit: 'Reddit Ads',
    };

    const campaigns = (data ?? []).map((c: any) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      objective: c.objective,
      budget_daily: c.budget_daily,
      platform: platformLabels[c.accounts?.platform] ?? c.accounts?.platform ?? null,
      account_name: c.accounts?.name ?? null,
    }));

    return Response.json(campaigns);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Fout bij ophalen campagnes' },
      { status: 500 },
    );
  }
}
