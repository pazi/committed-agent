'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '../../src/lib/supabase-browser';
import { Sidebar } from '../components/Sidebar';

interface AccountOverview {
  account_id: string;
  account_name: string;
  platform: string;
  campaign_count: number;
}

const platformColors: Record<string, string> = {
  'Google Ads': 'bg-yellow-100 text-yellow-700',
  'Facebook Ads': 'bg-blue-100 text-blue-700',
  'LinkedIn Ads': 'bg-sky-100 text-sky-700',
  'Reddit Ads': 'bg-orange-100 text-orange-700',
};

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<AccountOverview[]>([]);
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

    fetch('/api/accounts-overview').then(async r => {
      if (!r.ok) {
        setError('Kon accounts niet laden');
      } else {
        const data = await r.json();
        if (Array.isArray(data)) setAccounts(data);
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
            <h1 className="text-2xl font-semibold text-gray-900">Accounts</h1>
            <p className="text-sm text-gray-500 mt-1">
              {loading ? 'Laden...' : `${accounts.length} account(s)`}
            </p>
          </header>

          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl border border-red-200 mb-4">
              {error}
            </div>
          )}

          {!loading && accounts.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Naam</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Platform</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Campagnes</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((acc) => {
                    const href = `/accounts/${encodeURIComponent(acc.account_id)}?name=${encodeURIComponent(acc.account_name)}&platform=${encodeURIComponent(acc.platform)}`;
                    return (
                      <tr key={`${acc.platform}-${acc.account_id}`} className="border-t border-gray-100 hover:bg-blue-50/40 transition-colors cursor-pointer group">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900 group-hover:text-blue-700">
                          <Link href={href} className="block">{acc.account_name}</Link>
                        </td>
                        <td className="px-6 py-4">
                          <Link href={href} className="block">
                            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${platformColors[acc.platform] ?? 'bg-gray-100 text-gray-600'}`}>
                              {acc.platform}
                            </span>
                          </Link>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700 text-right tabular-nums">
                          <Link href={href} className="block">{acc.campaign_count.toLocaleString('nl-NL')}</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
