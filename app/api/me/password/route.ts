import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '../../../../src/lib/supabase-server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(request: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email) return Response.json({ error: 'Niet ingelogd' }, { status: 401 });

  const { currentPassword, newPassword } = await request.json();

  if (!currentPassword || !newPassword) {
    return Response.json({ error: 'Beide wachtwoorden zijn verplicht' }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return Response.json({ error: 'Nieuw wachtwoord moet minimaal 8 tekens zijn' }, { status: 400 });
  }

  // Verifieer huidig wachtwoord met een sign-in attempt
  const verifyClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { error: verifyErr } = await verifyClient.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });

  if (verifyErr) {
    return Response.json({ error: 'Huidig wachtwoord is onjuist' }, { status: 400 });
  }

  // Update via admin API
  const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    password: newPassword,
  });

  if (updateErr) return Response.json({ error: updateErr.message }, { status: 500 });

  return Response.json({ success: true });
}
