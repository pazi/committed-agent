'use client';

import { useState, useEffect } from 'react';
import { createClient } from '../../src/lib/supabase-browser';

interface Factor {
  id: string;
  status: 'verified' | 'unverified';
  friendly_name?: string;
}

export function TwoFactorSetup() {
  const supabase = createClient();
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollData, setEnrollData] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function loadFactors() {
    setLoading(true);
    const { data, error: err } = await supabase.auth.mfa.listFactors();
    if (err) {
      setError(err.message);
    } else {
      setFactors(data?.totp ?? []);
    }
    setLoading(false);
  }

  useEffect(() => { loadFactors(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function startEnroll() {
    setError('');
    setSuccess('');
    const { data, error: err } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: `Authenticator ${new Date().toISOString().slice(0, 10)}`,
    });
    if (err) {
      setError(err.message);
      return;
    }
    if (data) {
      setEnrollData({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
      setEnrolling(true);
    }
  }

  async function cancelEnroll() {
    if (enrollData) {
      await supabase.auth.mfa.unenroll({ factorId: enrollData.id });
    }
    setEnrolling(false);
    setEnrollData(null);
    setVerifyCode('');
    setError('');
  }

  async function verifyEnroll() {
    if (!enrollData) return;
    setError('');
    const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId: enrollData.id });
    if (chErr || !challenge) {
      setError(chErr?.message ?? 'Challenge mislukt');
      return;
    }
    const { error: vErr } = await supabase.auth.mfa.verify({
      factorId: enrollData.id,
      challengeId: challenge.id,
      code: verifyCode,
    });
    if (vErr) {
      setError(vErr.message === 'Invalid TOTP code entered' ? 'Code is onjuist of verlopen' : vErr.message);
      return;
    }
    setSuccess('2FA is ingeschakeld.');
    setEnrolling(false);
    setEnrollData(null);
    setVerifyCode('');
    loadFactors();
  }

  async function disableFactor(id: string) {
    if (!confirm('Weet je zeker dat je 2FA wilt uitschakelen?')) return;
    setError('');
    const { error: err } = await supabase.auth.mfa.unenroll({ factorId: id });
    if (err) {
      setError(err.message);
      return;
    }
    setSuccess('2FA is uitgeschakeld.');
    loadFactors();
  }

  if (loading) return <p className="text-xs text-gray-400">2FA status laden...</p>;

  const verifiedFactor = factors.find(f => f.status === 'verified');

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-700">Tweestapsverificatie (2FA)</h3>

      {error && (
        <div className="bg-red-50 text-red-700 text-xs px-3 py-2 rounded-lg border border-red-200">{error}</div>
      )}
      {success && (
        <div className="bg-green-50 text-green-700 text-xs px-3 py-2 rounded-lg border border-green-200">{success}</div>
      )}

      {!enrolling && verifiedFactor && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-green-800">2FA actief</p>
            <p className="text-xs text-green-600">{verifiedFactor.friendly_name ?? 'Authenticator app'}</p>
          </div>
          <button
            onClick={() => disableFactor(verifiedFactor.id)}
            className="text-xs text-red-600 hover:text-red-700 font-medium"
          >
            Uitschakelen
          </button>
        </div>
      )}

      {!enrolling && !verifiedFactor && (
        <div>
          <p className="text-xs text-gray-500 mb-2">Beveilig je account met een authenticator app (Google Authenticator, Authy, 1Password, etc).</p>
          <button
            type="button"
            onClick={startEnroll}
            className="text-sm text-blue-600 hover:text-blue-500 font-medium"
          >
            2FA inschakelen
          </button>
        </div>
      )}

      {enrolling && enrollData && (
        <div className="space-y-3 bg-gray-50 border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-600">Scan deze QR code met je authenticator app:</p>
          <div className="flex justify-center bg-white rounded-lg p-3">
            <div dangerouslySetInnerHTML={{ __html: enrollData.qr }} />
          </div>
          <details className="text-xs text-gray-500">
            <summary className="cursor-pointer hover:text-gray-700">Of voer handmatig in</summary>
            <code className="block mt-2 bg-white border border-gray-200 rounded px-2 py-1.5 font-mono break-all">
              {enrollData.secret}
            </code>
          </details>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Voer de 6-cijferige code in:</label>
            <input
              type="text"
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              autoFocus
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 font-mono tabular-nums tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={cancelEnroll} className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5">
              Annuleren
            </button>
            <button
              type="button"
              onClick={verifyEnroll}
              disabled={verifyCode.length !== 6}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium px-4 py-1.5 rounded-lg transition-colors"
            >
              Verifiëren & inschakelen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
