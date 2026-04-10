'use client';

import { use, useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '../../../src/lib/supabase-browser';
import { Sidebar } from '../../components/Sidebar';

/* ---------- types ---------- */
interface CreativeAsset {
  id: string;
  asset_type: string;
  content: string | null;
  url: string | null;
  performance_label: string | null;
}

interface Creative {
  id: string;
  headline: string | null;
  body: string | null;
  cta: string | null;
  ad_format: string | null;
  creative_assets: CreativeAsset[];
}

interface Ad {
  id: string;
  name: string | null;
  status: string | null;
  creatives: Creative | null;
}

interface Adset {
  id: string;
  name: string;
  status: string | null;
  ads: Ad[];
}

interface SearchTerm {
  id: string;
  search_term: string;
  match_type: string | null;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
}

interface Campaign {
  id: string;
  name: string;
  status: string;
  objective: string | null;
  budget_daily: number | null;
  platform: string | null;
  account_name: string | null;
  adsets: Adset[];
  search_terms: SearchTerm[];
}

/* ---------- helpers ---------- */
const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  paused: 'bg-yellow-100 text-yellow-700',
  archived: 'bg-gray-100 text-gray-500',
};

const perfColors: Record<string, string> = {
  BEST: 'bg-green-100 text-green-700',
  GOOD: 'bg-blue-100 text-blue-700',
  LOW: 'bg-red-100 text-red-700',
  LEARNING: 'bg-yellow-100 text-yellow-700',
};

type SortKey = 'search_term' | 'match_type' | 'impressions' | 'clicks' | 'spend' | 'conversions';

/* ---------- component ---------- */
export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'ads' | 'assets' | 'search'>('ads');
  const [sortKey, setSortKey] = useState<SortKey>('spend');
  const [sortAsc, setSortAsc] = useState(false);

  const [userEmail, setUserEmail] = useState('');
  const [userRole, setUserRole] = useState('');
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? '');
      setUserRole(data.user?.user_metadata?.role ?? '');
    });

    fetch(`/api/campaigns/${id}`).then(async (r) => {
      if (!r.ok) {
        setError('Kon campagne niet laden');
      } else {
        const data = await r.json();
        if (data.error) setError(data.error);
        else setCampaign(data);
      }
      setLoading(false);
    });
  }, [id, supabase.auth]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  /* collect all assets across adsets > ads > creatives */
  const allAssets = useMemo(() => {
    if (!campaign) return [];
    const assets: (CreativeAsset & { creativeName?: string })[] = [];
    for (const adset of campaign.adsets) {
      for (const ad of adset.ads) {
        if (ad.creatives) {
          for (const asset of ad.creatives.creative_assets ?? []) {
            assets.push({ ...asset, creativeName: ad.creatives.headline ?? ad.name ?? undefined });
          }
        }
      }
    }
    return assets;
  }, [campaign]);

  /* sorted search terms */
  const sortedTerms = useMemo(() => {
    if (!campaign) return [];
    return [...campaign.search_terms].sort((a, b) => {
      const aVal = a[sortKey] ?? '';
      const bVal = b[sortKey] ?? '';
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortAsc ? aVal - bVal : bVal - aVal;
      }
      return sortAsc
        ? String(aVal).localeCompare(String(bVal), 'nl')
        : String(bVal).localeCompare(String(aVal), 'nl');
    });
  }, [campaign, sortKey, sortAsc]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(key === 'search_term' || key === 'match_type');
    }
  }

  const tabs = [
    { key: 'ads' as const, label: 'Ads & Creatives' },
    { key: 'assets' as const, label: 'Assets' },
    { key: 'search' as const, label: 'Zoektermen' },
  ];

  return (
    <div className="flex h-screen">
      <Sidebar userEmail={userEmail} userRole={userRole} onSignOut={handleSignOut} />

      <div className="flex-1 overflow-y-auto bg-gray-50/50">
        <div className="max-w-7xl mx-auto p-8">
          {/* back link */}
          <Link
            href="/campaigns"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Terug naar campagnes
          </Link>

          {loading && <p className="text-sm text-gray-500">Laden...</p>}
          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl border border-red-200 mb-4">
              {error}
            </div>
          )}

          {campaign && (
            <>
              {/* header */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h1 className="text-2xl font-semibold text-gray-900">{campaign.name}</h1>
                    <p className="text-sm text-gray-500 mt-1">
                      {campaign.platform ?? 'Onbekend platform'}
                      {campaign.account_name ? ` — ${campaign.account_name}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {campaign.budget_daily != null && (
                      <span className="text-sm text-gray-700 font-medium">
                        € {Number(campaign.budget_daily).toLocaleString('nl-NL', { minimumFractionDigits: 2 })} / dag
                      </span>
                    )}
                    <span
                      className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColors[campaign.status] ?? 'bg-gray-100 text-gray-500'}`}
                    >
                      {campaign.status}
                    </span>
                  </div>
                </div>
                {campaign.objective && (
                  <p className="text-sm text-gray-600 mt-2">Doel: {campaign.objective}</p>
                )}
              </div>

              {/* tabs */}
              <div className="flex gap-1 mb-6 bg-white rounded-lg border border-gray-200 p-1 w-fit">
                {tabs.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`px-4 py-2 text-sm rounded-md font-medium transition-colors ${
                      tab === t.key
                        ? 'bg-gray-900 text-white'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Ads & Creatives tab */}
              {tab === 'ads' && (
                <div className="space-y-6">
                  {campaign.adsets.length === 0 && (
                    <p className="text-sm text-gray-500">Geen adsets gevonden.</p>
                  )}
                  {campaign.adsets.map((adset) => (
                    <div key={adset.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <h2 className="text-base font-semibold text-gray-900">{adset.name}</h2>
                        {adset.status && (
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[adset.status] ?? 'bg-gray-100 text-gray-500'}`}
                          >
                            {adset.status}
                          </span>
                        )}
                      </div>

                      {adset.ads.length === 0 && (
                        <p className="text-sm text-gray-400">Geen ads in deze adset.</p>
                      )}

                      <div className="space-y-4">
                        {adset.ads.map((ad) => (
                          <div
                            key={ad.id}
                            className="border border-gray-100 rounded-lg p-4 bg-gray-50/50"
                          >
                            <p className="text-sm font-medium text-gray-800 mb-2">
                              {ad.name ?? 'Naamloze ad'}
                              {ad.status && (
                                <span className={`ml-2 text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[ad.status] ?? 'bg-gray-100 text-gray-500'}`}>
                                  {ad.status}
                                </span>
                              )}
                            </p>
                            {ad.creatives ? (() => {
                              const assets = ad.creatives.creative_assets ?? [];
                              const headlines = assets.filter((a) => a.asset_type?.toLowerCase().includes('headline'));
                              const descriptions = assets.filter((a) => a.asset_type?.toLowerCase().includes('description'));
                              const otherAssets = assets.filter((a) =>
                                !a.asset_type?.toLowerCase().includes('headline') &&
                                !a.asset_type?.toLowerCase().includes('description'),
                              );
                              const hasAssets = assets.length > 0;
                              const hasCreativeFields = ad.creatives!.headline || ad.creatives!.body;

                              return (
                                <div className="space-y-3 text-sm">
                                  {/* Headlines uit assets */}
                                  {headlines.length > 0 && (
                                    <div>
                                      <p className="text-xs font-medium text-gray-400 uppercase mb-1">Headlines</p>
                                      <div className="space-y-1">
                                        {headlines.map((h) => (
                                          <div key={h.id} className="flex items-center gap-2">
                                            <span className="text-gray-700">{h.content ?? '-'}</span>
                                            {h.performance_label && !['UNKNOWN','UNSPECIFIED','unknown','unspecified'].includes(h.performance_label) && (
                                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${perfColors[h.performance_label] ?? 'bg-gray-100 text-gray-500'}`}>
                                                {h.performance_label}
                                              </span>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Descriptions uit assets */}
                                  {descriptions.length > 0 && (
                                    <div>
                                      <p className="text-xs font-medium text-gray-400 uppercase mb-1">Descriptions</p>
                                      <div className="space-y-1">
                                        {descriptions.map((d) => (
                                          <div key={d.id} className="flex items-center gap-2">
                                            <span className="text-gray-700">{d.content ?? '-'}</span>
                                            {d.performance_label && !['UNKNOWN','UNSPECIFIED','unknown','unspecified'].includes(d.performance_label) && (
                                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${perfColors[d.performance_label] ?? 'bg-gray-100 text-gray-500'}`}>
                                                {d.performance_label}
                                              </span>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Overige assets (images, videos, etc.) */}
                                  {otherAssets.length > 0 && (
                                    <div>
                                      <p className="text-xs font-medium text-gray-400 uppercase mb-1">Overige assets</p>
                                      <div className="space-y-1">
                                        {otherAssets.map((a) => (
                                          <div key={a.id} className="flex items-center gap-2">
                                            <span className="text-xs text-gray-400">{a.asset_type}</span>
                                            <span className="text-gray-700 truncate max-w-md">{a.content || a.url || '-'}</span>
                                            {a.performance_label && (
                                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${perfColors[a.performance_label] ?? 'bg-gray-100 text-gray-500'}`}>
                                                {a.performance_label}
                                              </span>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Fallback: toon creative headline/body als er geen assets zijn */}
                                  {!hasAssets && hasCreativeFields && (
                                    <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                                      {ad.creatives!.headline && (
                                        <div>
                                          <span className="text-gray-400">Kop:</span>{' '}
                                          <span className="text-gray-700">{ad.creatives!.headline}</span>
                                        </div>
                                      )}
                                      {ad.creatives!.body && (
                                        <div>
                                          <span className="text-gray-400">Tekst:</span>{' '}
                                          <span className="text-gray-700">{ad.creatives!.body}</span>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {!hasAssets && !hasCreativeFields && (
                                    <p className="text-gray-400">Geen content beschikbaar.</p>
                                  )}
                                </div>
                              );
                            })() : (
                              <p className="text-sm text-gray-400">Geen creative gekoppeld.</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Assets tab */}
              {tab === 'assets' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  {allAssets.length === 0 ? (
                    <p className="text-sm text-gray-500 p-6">Geen assets gevonden.</p>
                  ) : (
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Type</th>
                          <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Inhoud / URL</th>
                          <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Prestatie</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allAssets.map((a) => (
                          <tr key={a.id} className="border-t border-gray-100">
                            <td className="px-6 py-4 text-sm text-gray-700">{a.asset_type}</td>
                            <td className="px-6 py-4 text-sm text-gray-700 max-w-md truncate">
                              {a.url ? (
                                <a
                                  href={a.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline"
                                >
                                  {a.url}
                                </a>
                              ) : (
                                a.content ?? '-'
                              )}
                            </td>
                            <td className="px-6 py-4">
                              {a.performance_label ? (
                                <span
                                  className={`text-xs font-medium px-2.5 py-1 rounded-full ${perfColors[a.performance_label] ?? 'bg-gray-100 text-gray-500'}`}
                                >
                                  {a.performance_label}
                                </span>
                              ) : (
                                <span className="text-sm text-gray-400">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* Search Terms tab */}
              {tab === 'search' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  {sortedTerms.length === 0 ? (
                    <p className="text-sm text-gray-500 p-6">Geen zoektermen gevonden.</p>
                  ) : (
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          {([
                            ['search_term', 'Zoekterm'],
                            ['match_type', 'Match type'],
                            ['impressions', 'Impressies'],
                            ['clicks', 'Klikken'],
                            ['spend', 'Kosten'],
                            ['conversions', 'Conversies'],
                          ] as [SortKey, string][]).map(([key, label]) => (
                            <th
                              key={key}
                              onClick={() => toggleSort(key)}
                              className={`px-6 py-3 text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none ${
                                key === 'search_term' || key === 'match_type' ? 'text-left' : 'text-right'
                              }`}
                            >
                              {label}
                              {sortKey === key && (
                                <span className="ml-1">{sortAsc ? '↑' : '↓'}</span>
                              )}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sortedTerms.map((st) => (
                          <tr key={st.id} className="border-t border-gray-100">
                            <td className="px-6 py-3 text-sm text-gray-800">{st.search_term}</td>
                            <td className="px-6 py-3 text-sm text-gray-600">{st.match_type ?? '-'}</td>
                            <td className="px-6 py-3 text-sm text-gray-700 text-right tabular-nums">
                              {st.impressions.toLocaleString('nl-NL')}
                            </td>
                            <td className="px-6 py-3 text-sm text-gray-700 text-right tabular-nums">
                              {st.clicks.toLocaleString('nl-NL')}
                            </td>
                            <td className="px-6 py-3 text-sm text-gray-700 text-right tabular-nums">
                              € {Number(st.spend).toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-6 py-3 text-sm text-gray-700 text-right tabular-nums">
                              {st.conversions.toLocaleString('nl-NL')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
