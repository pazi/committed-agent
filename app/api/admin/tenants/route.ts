import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '../../../../src/lib/supabase-server';
import { getAccounts } from '../../../../src/services/bigquery.service';

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

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

export async function GET() {
  if (!await requireAdmin()) return Response.json({ error: 'Geen toegang' }, { status: 403 });

  // Sync BigQuery accounts naar Supabase tenants tabel
  try {
    const bqAccounts = await getAccounts();
    // Unieke account namen
    const uniqueNames = Array.from(new Set(bqAccounts.map(a => a.account_name)));

    const { data: existingTenants } = await supabaseAdmin
      .from('tenants')
      .select('name');

    const existingNames = new Set((existingTenants ?? []).map(t => t.name));
    const missing = uniqueNames.filter(n => !existingNames.has(n));

    if (missing.length > 0) {
      await supabaseAdmin.from('tenants').insert(
        missing.map(name => ({ name, slug: slugify(name) })),
      );
    }
  } catch (err) {
    console.error('Auto-sync tenants failed:', err);
  }

  const { data, error } = await supabaseAdmin
    .from('tenants')
    .select('id, name, slug')
    .order('name');

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}
