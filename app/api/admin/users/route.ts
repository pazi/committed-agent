import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '../../../../src/lib/supabase-server';

// Service role client voor admin operaties
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function requireAdmin() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('role, tenant_id')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') return null;
  return { userId: user.id, tenantId: profile.tenant_id };
}

// GET: lijst alle users van de tenant
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: 'Geen toegang' }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from('user_profiles')
    .select('id, email, full_name, role, is_active, created_at, tenant_id, tenants(name)')
    .order('created_at', { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}

// POST: maak een nieuwe user aan
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: 'Geen toegang' }, { status: 403 });

  const { email, full_name, password, role, tenant_id } = await request.json();

  if (!email || !full_name || !password || !role || !tenant_id) {
    return Response.json({ error: 'Alle velden zijn verplicht' }, { status: 400 });
  }

  if (!['admin', 'manager', 'client'].includes(role)) {
    return Response.json({ error: 'Ongeldige role' }, { status: 400 });
  }

  const { data: user, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name,
      tenant_id,
      role,
    },
  });

  if (createErr) return Response.json({ error: createErr.message }, { status: 500 });

  return Response.json({ id: user.user.id, email, full_name, role });
}

// PATCH: update user role of status
export async function PATCH(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: 'Geen toegang' }, { status: 403 });

  const { userId, role, is_active, full_name } = await request.json();

  if (!userId) return Response.json({ error: 'userId is verplicht' }, { status: 400 });

  // Check dat de user bij dezelfde tenant hoort
  const { data: target } = await supabaseAdmin
    .from('user_profiles')
    .select('tenant_id')
    .eq('id', userId)
    .single();

  if (!target || target.tenant_id !== admin.tenantId) {
    return Response.json({ error: 'User niet gevonden' }, { status: 404 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (role) updates.role = role;
  if (is_active !== undefined) updates.is_active = is_active;
  if (full_name) updates.full_name = full_name;

  const { error } = await supabaseAdmin
    .from('user_profiles')
    .update(updates)
    .eq('id', userId);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ success: true });
}

// DELETE: verwijder user
export async function DELETE(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: 'Geen toegang' }, { status: 403 });

  const { userId } = await request.json();

  // Voorkom dat admin zichzelf verwijdert
  if (userId === admin.userId) {
    return Response.json({ error: 'Je kunt jezelf niet verwijderen' }, { status: 400 });
  }

  // Check tenant
  const { data: target } = await supabaseAdmin
    .from('user_profiles')
    .select('tenant_id')
    .eq('id', userId)
    .single();

  if (!target || target.tenant_id !== admin.tenantId) {
    return Response.json({ error: 'User niet gevonden' }, { status: 404 });
  }

  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ success: true });
}
