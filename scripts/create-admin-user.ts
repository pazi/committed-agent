import 'dotenv/config';
import { supabase } from '../src/lib/supabase.js';

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];
  const tenantSlug = process.argv[4] ?? 'capgemini-academy';

  if (!email || !password) {
    console.error('Gebruik: npx tsx scripts/create-admin-user.ts <email> <wachtwoord> [tenant-slug]');
    process.exit(1);
  }

  // Zoek tenant
  const { data: tenant, error: tenantErr } = await supabase
    .from('tenants')
    .select('id, name')
    .eq('slug', tenantSlug)
    .single();

  if (tenantErr || !tenant) {
    console.error(`Tenant '${tenantSlug}' niet gevonden. Voer eerst sync-bigquery-to-supabase.ts uit.`);
    process.exit(1);
  }

  console.log(`Tenant: ${tenant.name} (${tenant.id})`);

  // Maak user aan via Supabase Admin API
  const { data: user, error: userErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: email.split('@')[0],
      tenant_id: tenant.id,
      role: 'admin',
    },
  });

  if (userErr) {
    console.error('User aanmaken mislukt:', userErr.message);
    process.exit(1);
  }

  console.log(`Admin user aangemaakt: ${email} (${user.user.id})`);
  console.log('Je kunt nu inloggen op /login');
}

main().catch((err) => {
  console.error('Fout:', err.message);
  process.exit(1);
});
