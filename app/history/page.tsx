'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../src/lib/supabase-browser';
import { Sidebar } from '../components/Sidebar';
import { ChatMarkdown } from '../components/ChatMarkdown';

interface HistoryFilters {
  accountIds?: string[];
  platforms?: string[];
  dateFrom?: string;
  dateTo?: string;
  compareDateFrom?: string;
  compareDateTo?: string;
}

interface HistoryItem {
  id: string;
  user_id: string;
  question: string;
  filters: HistoryFilters | null;
  created_at: string;
  user?: { email: string; full_name: string } | null;
}

interface FullHistoryItem extends HistoryItem {
  response: string;
}

const platformLabels: Record<string, string> = {
  google_ads: 'Google Ads',
  facebook: 'Facebook Ads',
  linkedin: 'LinkedIn Ads',
  reddit: 'Reddit Ads',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('nl-NL', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [accountNames, setAccountNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedItem, setSelectedItem] = useState<FullHistoryItem | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [userRole, setUserRole] = useState('');
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? '');
      setUserRole(data.user?.user_metadata?.role ?? '');
    });

    fetch('/api/history').then(async r => {
      if (!r.ok) setError('Kon geschiedenis niet laden');
      else setItems(await r.json());
      setLoading(false);
    });

    fetch('/api/accounts').then(async r => {
      if (r.ok) {
        const data = await r.json();
        if (data.accounts) {
          const map = new Map<string, string>();
          for (const a of data.accounts) map.set(a.account_id, a.account_name);
          setAccountNames(map);
        }
      }
    });
  }, [supabase.auth]);

  async function openItem(item: HistoryItem) {
    setModalLoading(true);
    const res = await fetch(`/api/history?id=${item.id}`);
    if (res.ok) {
      const data = await res.json();
      setSelectedItem(data);
    }
    setModalLoading(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  function FilterBadges({ filters }: { filters: HistoryFilters | null }) {
    if (!filters) return null;
    return (
      <div className="flex flex-wrap gap-1.5">
        {filters.dateFrom && filters.dateTo && (
          <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
            {filters.dateFrom} t/m {filters.dateTo}
          </span>
        )}
        {filters.compareDateFrom && filters.compareDateTo && (
          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
            Vergelijk: {filters.compareDateFrom} t/m {filters.compareDateTo}
          </span>
        )}
        {filters.platforms?.map(p => (
          <span key={p} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
            {platformLabels[p] ?? p}
          </span>
        ))}
        {filters.accountIds?.map(accId => (
          <span key={accId} className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
            {accountNames.get(accId) ?? accId}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <Sidebar userEmail={userEmail} userRole={userRole} onSignOut={handleSignOut} />

      <div className="flex-1 overflow-y-auto bg-gray-50/50">
        <div className="max-w-5xl mx-auto p-8">
          <header className="mb-6">
            <h1 className="text-2xl font-semibold text-gray-900">Chat geschiedenis</h1>
            <p className="text-sm text-gray-500 mt-1">
              {loading ? 'Laden...' : `${items.length} interactie(s)`}
              {userRole === 'admin' && !loading && ' (alle gebruikers)'}
            </p>
          </header>

          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl border border-red-200 mb-4">{error}</div>
          )}

          {!loading && items.length === 0 && !error && (
            <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center text-gray-400 shadow-sm">
              <p className="text-sm">Nog geen chat interacties</p>
            </div>
          )}

          <div className="space-y-2">
            {items.map(item => (
              <button
                key={item.id}
                onClick={() => openItem(item)}
                className="w-full text-left bg-white border border-gray-200 rounded-2xl px-5 py-4 hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <p className="text-sm font-medium text-gray-900 line-clamp-1">{item.question}</p>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                  <span>{formatDate(item.created_at)}</span>
                  {item.user && <span>&middot; {item.user.email}</span>}
                </div>
                <div className="mt-2">
                  <FilterBadges filters={item.filters} />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Detail modal */}
      {selectedItem && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedItem(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-200 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{selectedItem.question}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  <span>{formatDate(selectedItem.created_at)}</span>
                  {selectedItem.user && <span>&middot; {selectedItem.user.email}</span>}
                </div>
                <div className="mt-2">
                  <FilterBadges filters={selectedItem.filters} />
                </div>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-gray-400 hover:text-gray-600 shrink-0"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <ChatMarkdown content={selectedItem.response} />
            </div>
          </div>
        </div>
      )}

      {/* Loading overlay tijdens fetchen van detail */}
      {modalLoading && !selectedItem && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl px-4 py-3 text-sm text-gray-600 shadow-lg">Laden...</div>
        </div>
      )}
    </div>
  );
}
