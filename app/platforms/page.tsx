'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '../../src/lib/supabase-browser';
import { Sidebar } from '../components/Sidebar';

interface PlatformOverview {
  id: string;
  label: string;
  account_count: number;
  campaign_count: number;
}

const platformColors: Record<string, string> = {
  'Google Ads': 'from-yellow-50 to-amber-50 border-yellow-200',
  'Facebook Ads': 'from-blue-50 to-indigo-50 border-blue-200',
  'LinkedIn Ads': 'from-sky-50 to-cyan-50 border-sky-200',
  'Reddit Ads': 'from-orange-50 to-red-50 border-orange-200',
};

export default function PlatformsPage() {
  const [platforms, setPlatforms] = useState<PlatformOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userRole, setUserRole] = useState('');
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? '');
      setUserRole(data.user?.user_metadata?.role ?? '');
    });

    fetch('/api/platforms-overview').then(async r => {
      if (!r.ok) {
        setError('Kon platformen niet laden');
      } else {
        const data = await r.json();
        if (Array.isArray(data)) setPlatforms(data);
        else setError(data.error ?? 'Onbekende fout');
      }
      setLoading(false);
    });
  }, [supabase.auth]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="flex h-screen">
      <Sidebar userEmail={userEmail} userRole={userRole} onSignOut={handleSignOut} />

      <div className="flex-1 overflow-y-auto bg-gray-50/50">
        <div className="max-w-4xl mx-auto p-8">
          <header className="mb-6">
            <h1 className="text-2xl font-semibold text-gray-900">Platforms</h1>
            <p className="text-sm text-gray-500 mt-1">
              {loading ? 'Laden...' : `${platforms.length} platform(en)`}
            </p>
          </header>

          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl border border-red-200 mb-4">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {platforms.map((p) => (
              <Link
                key={p.id}
                href={`/platforms/${p.id}`}
                className={`bg-gradient-to-br ${platformColors[p.label] ?? 'from-gray-50 to-gray-100 border-gray-200'} border rounded-2xl p-6 shadow-sm hover:shadow-md hover:scale-[1.01] transition-all`}
              >
                <h2 className="text-lg font-semibold text-gray-900 mb-4">{p.label}</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-2xl font-bold text-gray-900 tabular-nums">
                      {p.account_count.toLocaleString('nl-NL')}
                    </p>
                    <p className="text-xs text-gray-600 uppercase tracking-wide mt-1">Accounts</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 tabular-nums">
                      {p.campaign_count.toLocaleString('nl-NL')}
                    </p>
                    <p className="text-xs text-gray-600 uppercase tracking-wide mt-1">Campagnes</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
