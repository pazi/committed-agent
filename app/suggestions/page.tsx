'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '../../src/lib/supabase-browser';
import { Sidebar } from '../components/Sidebar';

interface Suggestion {
  id: string;
  campaign_id: string | null;
  type: string;
  current_value: string | null;
  suggested_value: string | null;
  reasoning: string;
  status: string;
  priority: string;
  created_at: string;
  reviewed_at: string | null;
  campaign_name: string | null;
  creative_name: string | null;
}

const priorityColors: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-gray-100 text-gray-600',
};

const statusColors: Record<string, string> = {
  pending: 'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-gray-100 text-gray-500',
  applied: 'bg-purple-100 text-purple-700',
};

const typeLabels: Record<string, string> = {
  headline_change: 'Headline wijzigen',
  description_change: 'Description wijzigen',
  pause_ad: 'Ad pauzeren',
  add_negative_keyword: 'Negatief keyword',
  new_headline: 'Nieuwe headline',
  new_description: 'Nieuwe description',
};

export default function SuggestionsPage() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('pending');
  const [userEmail, setUserEmail] = useState('');
  const [userRole, setUserRole] = useState('');
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? '');
      setUserRole(data.user?.user_metadata?.role ?? '');
    });
  }, [supabase.auth]);

  useEffect(() => {
    setLoading(true);
    const params = filter !== 'all' ? `?status=${filter}` : '';
    fetch(`/api/suggestions${params}`)
      .then(async (r) => {
        if (r.ok) setSuggestions(await r.json());
      })
      .finally(() => setLoading(false));
  }, [filter]);

  async function handleAction(id: string, status: 'accepted' | 'rejected') {
    const res = await fetch('/api/suggestions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status, reviewed_by: userEmail }),
    });
    if (res.ok) {
      setSuggestions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status } : s)),
      );
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const pendingCount = suggestions.filter((s) => s.status === 'pending').length;

  return (
    <div className="flex h-screen">
      <Sidebar userEmail={userEmail} userRole={userRole} onSignOut={handleSignOut} />

      <div className="flex-1 overflow-y-auto bg-gray-50/50">
        <div className="max-w-4xl mx-auto p-8">
          <header className="mb-6">
            <h1 className="text-2xl font-semibold text-gray-900">Suggesties</h1>
            <p className="text-sm text-gray-500 mt-1">
              {loading ? 'Laden...' : `${suggestions.length} suggestie(s)${pendingCount > 0 ? ` — ${pendingCount} openstaand` : ''}`}
            </p>
          </header>

          {/* Filter tabs */}
          <div className="flex gap-2 mb-6">
            {['pending', 'accepted', 'rejected', 'all'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 text-sm rounded-full transition-colors ${
                  filter === f
                    ? 'bg-gray-900 text-white'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                }`}
              >
                {f === 'all' ? 'Alle' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {/* Suggestions list */}
          <div className="space-y-4">
            {suggestions.map((s) => (
              <div
                key={s.id}
                className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm"
              >
                {/* Header row */}
                <div className="flex items-center gap-3 mb-3">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${priorityColors[s.priority] ?? ''}`}>
                    {s.priority}
                  </span>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColors[s.status] ?? ''}`}>
                    {s.status}
                  </span>
                  <span className="text-xs text-gray-400">
                    {typeLabels[s.type] ?? s.type}
                  </span>
                  {s.campaign_name && (
                    <Link
                      href={`/campaigns/${s.campaign_id}`}
                      className="text-xs text-blue-600 hover:underline ml-auto"
                    >
                      {s.campaign_name}
                    </Link>
                  )}
                </div>

                {/* Before / After */}
                {(s.current_value || s.suggested_value) && (
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    {s.current_value && (
                      <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                        <p className="text-xs font-medium text-red-500 mb-1">Huidig</p>
                        <p className="text-sm text-gray-800">{s.current_value}</p>
                      </div>
                    )}
                    {s.suggested_value && (
                      <div className="bg-green-50 border border-green-100 rounded-lg p-3">
                        <p className="text-xs font-medium text-green-600 mb-1">Voorstel</p>
                        <p className="text-sm text-gray-800">{s.suggested_value}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Reasoning */}
                <p className="text-sm text-gray-600 mb-4">{s.reasoning}</p>

                {/* Actions */}
                {s.status === 'pending' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAction(s.id, 'accepted')}
                      className="px-4 py-1.5 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Accepteren
                    </button>
                    <button
                      onClick={() => handleAction(s.id, 'rejected')}
                      className="px-4 py-1.5 text-sm font-medium bg-white text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Afwijzen
                    </button>
                  </div>
                )}

                {/* Timestamp */}
                <p className="text-xs text-gray-400 mt-3">
                  {new Date(s.created_at).toLocaleString('nl-NL')}
                </p>
              </div>
            ))}

            {!loading && suggestions.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <p className="text-sm">Geen suggesties gevonden{filter !== 'all' ? ` met status "${filter}"` : ''}.</p>
                <p className="text-xs mt-1 text-gray-400">
                  Draai <code className="bg-gray-100 px-1.5 py-0.5 rounded">npm run generate-suggestions</code> om suggesties te genereren.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
