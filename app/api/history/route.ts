import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '../../../src/lib/supabase-server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * GET /api/history          → lijst (zonder response body — lazy load)
 * GET /api/history?id=xxx   → één item met volledige response
 */
export async function GET(request: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Niet ingelogd' }, { status: 401 });

  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const isAdmin = profile?.role === 'admin';
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  // Single item ophalen
  if (id) {
    let q = supabaseAdmin.from('chat_history').select('*').eq('id', id).single();
    if (!isAdmin) q = supabaseAdmin.from('chat_history').select('*').eq('id', id).eq('user_id', user.id).single();
    const { data, error } = await q;
    if (error) return Response.json({ error: error.message }, { status: 404 });
    return Response.json(data);
  }

  // Lijst ophalen — zonder response body
  let query = supabaseAdmin
    .from('chat_history')
    .select('id, user_id, question, filters, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (!isAdmin) query = query.eq('user_id', user.id);

  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });

  if (isAdmin && data && data.length > 0) {
    const userIds = Array.from(new Set(data.map(d => d.user_id)));
    const { data: profiles } = await supabaseAdmin
      .from('user_profiles')
      .select('id, email, full_name')
      .in('id', userIds);

    const profileMap = new Map((profiles ?? []).map(p => [p.id, p]));
    return Response.json(data.map(d => ({ ...d, user: profileMap.get(d.user_id) ?? null })));
  }

  return Response.json(data ?? []);
}
