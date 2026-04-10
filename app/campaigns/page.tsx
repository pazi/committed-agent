'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '../../src/lib/supabase-browser';
import { Sidebar } from '../components/Sidebar';

interface CampaignRow {
  id: string;
  name: string;
  status: string;
  objective: string | null;
  budget_daily: number | null;
  platform: string | null;
  account_name: string | null;
}

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  paused: 'bg-yellow-100 text-yellow-700',
  archived: 'bg-gray-100 text-gray-500',
};

const platformColors: Record<string, string> = {
  'Google Ads': 'bg-yellow-100 text-yellow-700',
  'Facebook Ads': 'bg-blue-100 text-blue-700',
  'LinkedIn Ads': 'bg-sky-100 text-sky-700',
  'Reddit Ads': 'bg-orange-100 text-orange-700',
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [search, setSearch] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userRole, setUserRole] = useState('');
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? '');
      setUserRole(data.user?.user_metadata?.role ?? '');
    });

    fetch('/api/campaigns').then(async (r) => {
      if (!r.ok) {
        setError('Kon campagnes niet laden');
      } else {
        const data = await r.json();
        if (Array.isArray(data)) setCampaigns(data);
        else setError(data.error ?? 'Onbekende fout');
      }
      setLoading(false);
    });
  }, [supabase.auth]);

  const filtered = campaigns.filter((c) => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="flex h-screen">
      <Sidebar userEmail={userEmail} userRole={userRole} onSignOut={handleSignOut} />

      <div className="flex-1 overflow-y-auto bg-gray-50/50">
        <div className="max-w-5xl mx-auto p-8">
          <header className="mb-6">
            <h1 className="text-2xl font-semibold text-gray-900">Campagnes</h1>
            <p className="text-sm text-gray-500 mt-1">
              {loading ? 'Laden...' : `${campaigns.length} campagne(s)`}
            </p>
          </header>

          {/* Filters */}
          <div className="flex items-center gap-4 mb-5">
            <div className="relative flex-1 max-w-sm">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Zoek campagne..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex gap-1 bg-white rounded-lg border border-gray-200 p-1">
              {['active', 'paused', 'all'].map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    statusFilter === f
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {f === 'all' ? 'Alle' : f === 'active' ? 'Actief' : 'Gepauzeerd'}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl border border-red-200 mb-4">
              {error}
            </div>
          )}

          {!loading && campaigns.length > 0 && (
            <>
            <p className="text-xs text-gray-400 mb-2">{filtered.length} van {campaigns.length} campagnes</p>
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Naam</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Platform</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Doel</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Dagbudget</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr
                      key={c.id}
                      className="border-t border-gray-100 hover:bg-blue-50/40 transition-colors cursor-pointer group"
                    >
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 group-hover:text-blue-700">
                        <Link href={`/campaigns/${c.id}`} className="block">{c.name}</Link>
                      </td>
                      <td className="px-6 py-4">
                        <Link href={`/campaigns/${c.id}`} className="block">
                          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${platformColors[c.platform ?? ''] ?? 'bg-gray-100 text-gray-600'}`}>
                            {c.platform ?? '-'}
                          </span>
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <Link href={`/campaigns/${c.id}`} className="block">
                          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColors[c.status] ?? 'bg-gray-100 text-gray-500'}`}>
                            {c.status}
                          </span>
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        <Link href={`/campaigns/${c.id}`} className="block">{c.objective ?? '-'}</Link>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 text-right tabular-nums">
                        <Link href={`/campaigns/${c.id}`} className="block">
                          {c.budget_daily != null ? `€ ${Number(c.budget_daily).toLocaleString('nl-NL', { minimumFractionDigits: 2 })}` : '-'}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
          )}

          {!loading && campaigns.length === 0 && !error && (
            <p className="text-sm text-gray-500">Geen campagnes gevonden.</p>
          )}
        </div>
      </div>
    </div>
  );
}
