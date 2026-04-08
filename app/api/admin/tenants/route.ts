import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '../../../../src/lib/supabase-server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function requireAdmin() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  return profile?.role === 'admin';
}

export async function GET() {
  if (!await requireAdmin()) return Response.json({ error: 'Geen toegang' }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from('tenants')
    .select('id, name, slug')
    .order('name');

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}
