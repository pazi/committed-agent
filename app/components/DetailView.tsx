'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChartRenderer } from './ChartRenderer';

interface Stats {
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  conversion_value: number;
  ctr: number;
  cpc: number;
  cpm: number;
  roas: number;
  cost_per_conversion: number;
}

interface Campaign {
  campaign_id: string;
  campaign_name: string;
  platform: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  ctr: number;
  cpc: number;
}

interface TrendPoint {
  date: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
}

const fmtEur = (v: number) => `€${v.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtPct = (v: number) => `${(v * 100).toFixed(2)}%`;
const fmtNum = (v: number) => v.toLocaleString('nl-NL');

export function DetailView({
  title,
  subtitle,
  backHref,
  backLabel,
  apiUrl,
}: {
  title: string;
  subtitle: string;
  backHref: string;
  backLabel: string;
  apiUrl: string;
}) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [days, setDays] = useState(30);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    fetch(`${apiUrl}&days=${days}`).then(async r => {
      if (cancelled) return;
      if (!r.ok) {
        setError('Kon data niet laden');
      } else {
        const data = await r.json();
        if (data.error) {
          setError(data.error);
        } else {
          setStats(data.stats);
          setCampaigns(data.campaigns ?? []);
          setTrend(data.trend ?? []);
        }
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [apiUrl, days]);

  return (
    <div className="max-w-6xl mx-auto p-8">
      {/* Header */}
      <div className="mb-6">
        <Link href={backHref} className="text-xs text-gray-500 hover:text-gray-700 inline-flex items-center gap-1 mb-2">
          &larr; {backLabel}
        </Link>
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
            <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
          </div>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="text-xs border border-gray-200 rounded-lg px-3 py-2 text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={7}>Laatste 7 dagen</option>
            <option value={30}>Laatste 30 dagen</option>
            <option value={90}>Laatste 90 dagen</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl border border-red-200 mb-4">
          {error}
        </div>
      )}

      {loading && !stats && (
        <div className="text-gray-400 text-sm">Laden...</div>
      )}

      {stats && (
        <div className={loading ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
          {/* KPI Cards */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <KpiCard label="Spend" value={fmtEur(stats.cost)} />
            <KpiCard label="Impressions" value={fmtNum(stats.impressions)} />
            <KpiCard label="Clicks" value={fmtNum(stats.clicks)} />
            <KpiCard label="Conversions" value={fmtNum(stats.conversions)} />
            <KpiCard label="CTR" value={fmtPct(stats.ctr)} />
            <KpiCard label="CPC" value={fmtEur(stats.cpc)} />
            <KpiCard label="CPM" value={fmtEur(stats.cpm)} />
            <KpiCard label="ROAS" value={stats.roas.toFixed(2)} />
          </div>

          {/* Trend chart */}
          {trend.length > 0 && (
            <ChartRenderer
              config={{
                type: 'area',
                title: 'Spend & clicks trend',
                xKey: 'date',
                yKeys: ['cost', 'clicks'],
                data: trend.map(t => ({ date: t.date, cost: Number(t.cost.toFixed(2)), clicks: t.clicks })),
              }}
            />
          )}

          {/* Top campaigns */}
          {campaigns.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden mt-6">
              <div className="px-5 py-3 border-b border-gray-200">
                <h2 className="text-sm font-semibold text-gray-900">Top campagnes</h2>
                <p className="text-xs text-gray-500">{campaigns.length} totaal, gesorteerd op spend</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase">Campagne</th>
                      <th className="text-right px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase">Spend</th>
                      <th className="text-right px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase">Imps</th>
                      <th className="text-right px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase">Clicks</th>
                      <th className="text-right px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase">CTR</th>
                      <th className="text-right px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase">CPC</th>
                      <th className="text-right px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase">Conv</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.slice(0, 25).map((c) => (
                      <tr key={`${c.platform}-${c.campaign_id}`} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-5 py-2.5 text-sm text-gray-900">
                          <div className="font-medium truncate max-w-md">{c.campaign_name}</div>
                          <div className="text-xs text-gray-400">{c.platform}</div>
                        </td>
                        <td className="px-5 py-2.5 text-sm text-gray-700 text-right tabular-nums">{fmtEur(c.cost)}</td>
                        <td className="px-5 py-2.5 text-sm text-gray-700 text-right tabular-nums">{fmtNum(c.impressions)}</td>
                        <td className="px-5 py-2.5 text-sm text-gray-700 text-right tabular-nums">{fmtNum(c.clicks)}</td>
                        <td className="px-5 py-2.5 text-sm text-gray-700 text-right tabular-nums">{fmtPct(c.ctr)}</td>
                        <td className="px-5 py-2.5 text-sm text-gray-700 text-right tabular-nums">{fmtEur(c.cpc)}</td>
                        <td className="px-5 py-2.5 text-sm text-gray-700 text-right tabular-nums">{fmtNum(c.conversions)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-xl font-bold text-gray-900 mt-1 tabular-nums">{value}</p>
    </div>
  );
}
