import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '../../../../src/lib/supabase-server';

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
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') return null;
  return { userId: user.id };
}

// GET: lijst alle users met hun tenant koppelingen
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: 'Geen toegang' }, { status: 403 });

  const { data: users, error } = await supabaseAdmin
    .from('user_profiles')
    .select('id, email, full_name, role, is_active, created_at')
    .order('created_at', { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Haal tenant koppelingen op voor alle users
  const { data: userTenants } = await supabaseAdmin
    .from('user_tenants')
    .select('user_id, tenant_id, tenants(name)');

  const tenantMap = new Map<string, Array<{ id: string; name: string }>>();
  for (const ut of userTenants ?? []) {
    const list = tenantMap.get(ut.user_id) ?? [];
    list.push({ id: ut.tenant_id, name: (ut.tenants as unknown as { name: string })?.name ?? '' });
    tenantMap.set(ut.user_id, list);
  }

  const result = (users ?? []).map((u) => ({
    ...u,
    tenants: tenantMap.get(u.id) ?? [],
  }));

  return Response.json(result);
}

// POST: maak een nieuwe user aan met tenant koppelingen
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: 'Geen toegang' }, { status: 403 });

  const { email, full_name, password, role, tenant_ids } = await request.json();

  if (!email || !full_name || !password || !role) {
    return Response.json({ error: 'Alle velden zijn verplicht' }, { status: 400 });
  }

  if (!['admin', 'manager', 'client'].includes(role)) {
    return Response.json({ error: 'Ongeldige role' }, { status: 400 });
  }

  // Admins/managers: altijd alle tenants. Clients: meegegeven tenant_ids
  let assignTenantIds: string[] = tenant_ids ?? [];
  if (role === 'admin' || role === 'manager') {
    const { data: allTenants } = await supabaseAdmin.from('tenants').select('id');
    assignTenantIds = (allTenants ?? []).map((t) => t.id);
  }

  if (assignTenantIds.length === 0) {
    return Response.json({ error: 'Selecteer minimaal 1 tenant' }, { status: 400 });
  }

  // Maak user aan — de trigger maakt het profiel + koppelingen
  const { data: user, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name,
      role,
      // Voor de trigger: eerste tenant als fallback
      tenant_id: assignTenantIds[0],
    },
  });

  if (createErr) return Response.json({ error: createErr.message }, { status: 500 });

  // Verwijder door trigger aangemaakte koppelingen en insert de juiste set
  await supabaseAdmin.from('user_tenants').delete().eq('user_id', user.user.id);
  await supabaseAdmin.from('user_tenants').insert(
    assignTenantIds.map((tid) => ({ user_id: user.user.id, tenant_id: tid })),
  );

  return Response.json({ id: user.user.id, email, full_name, role });
}

// PATCH: update user role, status, of tenant koppelingen
export async function PATCH(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: 'Geen toegang' }, { status: 403 });

  const { userId, role, is_active, full_name, tenant_ids } = await request.json();
  if (!userId) return Response.json({ error: 'userId is verplicht' }, { status: 400 });

  // Update profiel
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (role) updates.role = role;
  if (is_active !== undefined) updates.is_active = is_active;
  if (full_name) updates.full_name = full_name;

  const { error } = await supabaseAdmin
    .from('user_profiles')
    .update(updates)
    .eq('id', userId);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Bij role wijziging naar admin/manager: koppel aan alle tenants
  if (role === 'admin' || role === 'manager') {
    const { data: allTenants } = await supabaseAdmin.from('tenants').select('id');
    await supabaseAdmin.from('user_tenants').delete().eq('user_id', userId);
    await supabaseAdmin.from('user_tenants').insert(
      (allTenants ?? []).map((t) => ({ user_id: userId, tenant_id: t.id })),
    );
  }

  // Update tenant koppelingen als expliciet meegegeven (voor clients)
  if (tenant_ids && !['admin', 'manager'].includes(role)) {
    await supabaseAdmin.from('user_tenants').delete().eq('user_id', userId);
    if (tenant_ids.length > 0) {
      await supabaseAdmin.from('user_tenants').insert(
        tenant_ids.map((tid: string) => ({ user_id: userId, tenant_id: tid })),
      );
    }
  }

  return Response.json({ success: true });
}

// DELETE: verwijder user
export async function DELETE(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: 'Geen toegang' }, { status: 403 });

  const { userId } = await request.json();

  if (userId === admin.userId) {
    return Response.json({ error: 'Je kunt jezelf niet verwijderen' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ success: true });
}
