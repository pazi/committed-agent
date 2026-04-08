'use client';

import { useState, type FormEvent } from 'react';
import { createClient } from '../../src/lib/supabase-browser';
import Image from 'next/image';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
    setLoading(false);
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
          {sent ? (
            <div className="text-center">
              <div className="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-lg mb-4 border border-green-200">
                We hebben een reset-link naar <strong>{email}</strong> gestuurd. Check je inbox.
              </div>
              <Link href="/login" className="text-sm text-blue-600 hover:text-blue-500">
                Terug naar inloggen
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-semibold text-gray-900 mb-1">Wachtwoord vergeten</h1>
              <p className="text-sm text-gray-500 mb-6">
                Vul je e-mailadres in en we sturen je een link om je wachtwoord te resetten.
              </p>

              {error && (
                <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg mb-4 border border-red-200">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    E-mailadres
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="naam@bedrijf.nl"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl px-4 py-2.5 text-sm font-medium transition-colors"
                >
                  {loading ? 'Verzenden...' : 'Reset-link versturen'}
                </button>
              </form>

              <div className="mt-4 text-center">
                <Link href="/login" className="text-sm text-blue-600 hover:text-blue-500">
                  Terug naar inloggen
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
