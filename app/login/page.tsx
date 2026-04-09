'use client';

import { useState, type FormEvent } from 'react';
import { createClient } from '../../src/lib/supabase-browser';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Step = 'credentials' | 'mfa';

export default function LoginPage() {
  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [factorId, setFactorId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });

    if (signInErr) {
      setError(signInErr.message === 'Invalid login credentials' ? 'Onjuist e-mailadres of wachtwoord.' : signInErr.message);
      setLoading(false);
      return;
    }

    // Check of MFA verplicht is
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (aalData?.currentLevel === 'aal1' && aalData?.nextLevel === 'aal2') {
      // 2FA challenge nodig
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totp = factors?.totp?.find(f => f.status === 'verified');
      if (!totp) {
        setError('2FA is vereist maar geen factor gevonden');
        setLoading(false);
        return;
      }
      setFactorId(totp.id);
      setStep('mfa');
      setLoading(false);
    } else {
      router.push('/');
      router.refresh();
    }
  }

  async function handleVerifyMfa(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
    if (chErr || !challenge) {
      setError(chErr?.message ?? 'Challenge mislukt');
      setLoading(false);
      return;
    }

    const { error: vErr } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: mfaCode,
    });

    if (vErr) {
      setError(vErr.message === 'Invalid TOTP code entered' ? 'Code is onjuist of verlopen' : vErr.message);
      setLoading(false);
      return;
    }

    router.push('/');
    router.refresh();
  }

  async function handleCancelMfa() {
    await supabase.auth.signOut();
    setStep('credentials');
    setMfaCode('');
    setError('');
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <div className="bg-gray-900 rounded-xl px-6 py-3">
            <Image src="/logo.webp" alt="TCA Logo" width={160} height={36} />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          {step === 'credentials' ? (
            <>
              <h1 className="text-xl font-semibold text-gray-900 mb-1">Inloggen</h1>
              <p className="text-sm text-gray-500 mb-6">Log in om je campagnes te beheren</p>

              {error && (
                <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg mb-4 border border-red-200">
                  {error}
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">E-mailadres</label>
                  <input
                    id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="naam@bedrijf.nl"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Wachtwoord</label>
                  <input
                    id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Je wachtwoord"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl px-4 py-2.5 text-sm font-medium transition-colors"
                >
                  {loading ? 'Inloggen...' : 'Inloggen'}
                </button>
              </form>

              <div className="mt-4 text-center">
                <Link href="/forgot-password" className="text-sm text-blue-600 hover:text-blue-500">
                  Wachtwoord vergeten?
                </Link>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold text-gray-900 mb-1">Verificatiecode</h1>
              <p className="text-sm text-gray-500 mb-6">Voer de 6-cijferige code uit je authenticator app in.</p>

              {error && (
                <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg mb-4 border border-red-200">
                  {error}
                </div>
              )}

              <form onSubmit={handleVerifyMfa} className="space-y-4">
                <div>
                  <input
                    type="text"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                    autoFocus
                    placeholder="000000"
                    maxLength={6}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-2xl text-gray-900 font-mono tabular-nums tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || mfaCode.length !== 6}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl px-4 py-2.5 text-sm font-medium transition-colors"
                >
                  {loading ? 'Verifiëren...' : 'Verifiëren'}
                </button>
              </form>

              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={handleCancelMfa}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Annuleren
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
