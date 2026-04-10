import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const campaignId = searchParams.get('campaign_id');

    let query = supabase
      .from('suggestions')
      .select(`
        *,
        campaigns ( id, name ),
        creatives ( id, name )
      `)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (campaignId) query = query.eq('campaign_id', campaignId);

    const { data, error } = await query;
    if (error) return Response.json({ error: error.message }, { status: 500 });

    const suggestions = (data ?? []).map((s: any) => ({
      ...s,
      campaign_name: s.campaigns?.name ?? null,
      creative_name: s.creatives?.name ?? null,
      campaigns: undefined,
      creatives: undefined,
    }));

    return Response.json(suggestions);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Fout bij ophalen suggesties' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { id, status, reviewed_by } = await request.json();
    if (!id || !status) {
      return Response.json({ error: 'id en status zijn verplicht' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('suggestions')
      .update({
        status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewed_by ?? null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json(data);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Fout bij updaten suggestie' },
      { status: 500 },
    );
  }
}
