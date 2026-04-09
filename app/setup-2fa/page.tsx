'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '../../src/lib/supabase-browser';

export default function Setup2FAPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [enrollData, setEnrollData] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    async function init() {
      // Check of user al 2FA heeft → redirect naar home
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const verified = factors?.totp?.find(f => f.status === 'verified');
      if (verified) {
        router.replace('/');
        return;
      }

      // Cleanup unverified factors van eerdere pogingen
      const unverified = factors?.totp?.filter(f => f.status !== 'verified') ?? [];
      for (const f of unverified) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }

      // Start enrollment
      const { data, error: err } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `Authenticator ${new Date().toISOString().slice(0, 10)}`,
      });
      if (err) {
        setError(err.message);
      } else if (data) {
        setEnrollData({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
      }
      setLoading(false);
    }
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    if (!enrollData) return;
    setError('');
    setVerifying(true);

    const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId: enrollData.id });
    if (chErr || !challenge) {
      setError(chErr?.message ?? 'Challenge mislukt');
      setVerifying(false);
      return;
    }

    const { error: vErr } = await supabase.auth.mfa.verify({
      factorId: enrollData.id,
      challengeId: challenge.id,
      code: verifyCode,
    });

    if (vErr) {
      setError(vErr.message === 'Invalid TOTP code entered' ? 'Code is onjuist of verlopen' : vErr.message);
      setVerifying(false);
      return;
    }

    router.push('/');
    router.refresh();
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <div className="bg-gray-900 rounded-xl px-6 py-3">
            <Image src="/logo.webp" alt="TCA Logo" width={160} height={36} />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <h1 className="text-xl font-semibold text-gray-900 mb-1">Stel 2FA in</h1>
          <p className="text-sm text-gray-500 mb-6">
            Tweestapsverificatie is verplicht voor je account. Scan de QR code met een authenticator app
            (Google Authenticator, Authy, 1Password, etc) en voer de code in om je account te beveiligen.
          </p>

          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg mb-4 border border-red-200">{error}</div>
          )}

          {loading && <p className="text-sm text-gray-400">Laden...</p>}

          {enrollData && (
            <div className="space-y-4">
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex justify-center">
                <div dangerouslySetInnerHTML={{ __html: enrollData.qr }} />
              </div>

              <details className="text-xs text-gray-500">
                <summary className="cursor-pointer hover:text-gray-700">Of voer handmatig in</summary>
                <code className="block mt-2 bg-gray-50 border border-gray-200 rounded px-2 py-1.5 font-mono break-all text-gray-700">
                  {enrollData.secret}
                </code>
              </details>

              <form onSubmit={handleVerify} className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Voer de 6-cijferige code in
                  </label>
                  <input
                    type="text"
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    autoFocus
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-2xl text-gray-900 font-mono tabular-nums tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={verifying || verifyCode.length !== 6}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl px-4 py-2.5 text-sm font-medium transition-colors"
                >
                  {verifying ? 'Verifiëren...' : 'Inschakelen'}
                </button>
              </form>
            </div>
          )}

          <div className="mt-6 text-center">
            <button
              onClick={handleSignOut}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Uitloggen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
