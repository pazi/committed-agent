'use client';

import { useState, useRef, useEffect, type FormEvent } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { createClient } from '../src/lib/supabase-browser';
import { Sidebar } from './components/Sidebar';
import { ChatMarkdown } from './components/ChatMarkdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Account {
  account_id: string;
  account_name: string;
  platform: string;
}

interface Platform {
  id: string;
  label: string;
}

// ============================================
// Multi-select dropdown component
// ============================================

function MultiSelect({
  label,
  options,
  selected,
  onToggle,
  onSelectAll,
  onDeselectAll,
  getLabel,
  getId,
}: {
  label: string;
  options: { id: string; label: string }[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  getLabel?: (o: { id: string; label: string }) => string;
  getId?: (o: { id: string; label: string }) => string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const allSelected = selected.size === options.length && options.length > 0;
  const noneSelected = selected.size === 0;
  const displayLabel = allSelected
    ? `Alle ${label.toLowerCase()}`
    : noneSelected
      ? `Selecteer ${label.toLowerCase()}`
      : `${selected.size}/${options.length} ${label.toLowerCase()}`;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
          noneSelected
            ? 'bg-white border-dashed border-gray-300 text-gray-400 hover:bg-gray-50'
            : allSelected
              ? 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              : 'bg-blue-50 border-blue-200 text-blue-700'
        }`}
      >
        <span>{displayLabel}</span>
        <svg className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 min-w-[200px] py-1">
          <button
            onClick={() => { allSelected ? onDeselectAll() : onSelectAll(); }}
            className="w-full text-left px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50 font-medium"
          >
            {allSelected ? 'Deselecteer alle' : 'Selecteer alle'}
          </button>
          {options.map((opt) => {
            const id = getId ? getId(opt) : opt.id;
            const text = getLabel ? getLabel(opt) : opt.label;
            return (
              <label
                key={id}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-gray-50 ${
                  selected.has(id) ? 'text-gray-900' : 'text-gray-400'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(id)}
                  onChange={() => onToggle(id)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                {text}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================
// Main page
// ============================================

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [canvasContent, setCanvasContent] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [userRole, setUserRole] = useState('');

  // Filter state
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set());
  const [selectedPlatformIds, setSelectedPlatformIds] = useState<Set<string>>(new Set());

  // Datum filters (default: laatste 30 dagen)
  const defaultDateTo = new Date().toISOString().split('T')[0];
  const defaultDateFrom = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const [dateFrom, setDateFrom] = useState(defaultDateFrom);
  const [dateTo, setDateTo] = useState(defaultDateTo);
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [compareDateFrom, setCompareDateFrom] = useState(
    new Date(Date.now() - 60 * 86400000).toISOString().split('T')[0]
  );
  const [compareDateTo, setCompareDateTo] = useState(defaultDateFrom);

  // Resizable chat panel
  const [chatWidth, setChatWidth] = useState(900);
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const stored = localStorage.getItem('chat-width');
    if (stored) setChatWidth(Number(stored));
    const collapsed = localStorage.getItem('chat-collapsed');
    if (collapsed === 'true') setChatCollapsed(true);
  }, []);

  function toggleChatCollapsed() {
    const next = !chatCollapsed;
    setChatCollapsed(next);
    localStorage.setItem('chat-collapsed', String(next));
  }

  useEffect(() => {
    if (!isDragging) return;
    function onMove(e: MouseEvent) {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newWidth = rect.right - e.clientX;
      const clamped = Math.max(500, Math.min(900, newWidth));
      setChatWidth(clamped);
    }
    function onUp() {
      setIsDragging(false);
      localStorage.setItem('chat-width', String(chatWidth));
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [isDragging, chatWidth]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? '');
      setUserRole(data.user?.user_metadata?.role ?? '');
    });
    fetch('/api/accounts').then(r => r.json()).then((data) => {
      if (data.accounts) setAccounts(data.accounts);
      if (data.platforms) setPlatforms(data.platforms);
    });
  }, [supabase.auth]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function toggleInSet(set: Set<string>, id: string): Set<string> {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  }

  function resetChat() {
    setMessages([]);
    setSelectedAccountIds(new Set());
    setSelectedPlatformIds(new Set());
    setDateFrom(defaultDateFrom);
    setDateTo(defaultDateTo);
    setCompareEnabled(false);
  }

  async function sendMessage(text: string) {
    if (!text.trim() || loading || noDataWarning) return;

    const userMessage: Message = { role: 'user', content: text.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const accountIds = selectedAccountIds.size < accounts.length
        ? Array.from(selectedAccountIds)
        : undefined;
      const platformIds = selectedPlatformIds.size < platforms.length
        ? Array.from(selectedPlatformIds)
        : undefined;

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          accountIds,
          platforms: platformIds,
          dateFrom,
          dateTo,
          ...(compareEnabled ? { compareDateFrom, compareDateTo } : {}),
        }),
      });

      const data = await res.json();
      if (data.error) {
        setMessages([...newMessages, { role: 'assistant', content: `Fout: ${data.error}` }]);
      } else {
        setMessages([...newMessages, { role: 'assistant', content: data.content }]);
        setCanvasContent(data.content);
      }
    } catch (err) {
      setMessages([
        ...newMessages,
        { role: 'assistant', content: `Fout: ${err instanceof Error ? err.message : 'Onbekende fout'}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  // Dedup accounts voor de dropdown (zelfde account kan in meerdere platforms voorkomen)
  const uniqueAccounts = Array.from(
    new Map(accounts.map(a => [a.account_id, a])).values()
  ).map(a => ({ id: a.account_id, label: a.account_name }));

  // Check of de geselecteerde combi data heeft
  const platformLabelsToIds: Record<string, string> = {};
  for (const p of platforms) platformLabelsToIds[p.label] = p.id;

  const hasDataForCombi = accounts.some(
    a => selectedAccountIds.has(a.account_id) && selectedPlatformIds.has(platformLabelsToIds[a.platform] ?? '')
  );
  const noDataWarning = accounts.length > 0 && !hasDataForCombi;

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="flex h-screen">
      <Sidebar userEmail={userEmail} userRole={userRole} onSignOut={handleSignOut} />

      <div ref={containerRef} className={`flex flex-1 min-w-0 ${isDragging ? 'select-none cursor-col-resize' : ''}`}>
        {/* Canvas */}
        <div className="flex-1 flex flex-col bg-gray-50/50 min-w-0">
          <div className="flex-1 overflow-y-auto p-6">
            {canvasContent ? (
              <ChatMarkdown content={canvasContent} />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                <div className="text-center">
                  <svg className="mx-auto h-12 w-12 mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm">Adviezen en data verschijnen hier</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Resizer + collapse handle */}
        <div className="relative shrink-0 group">
          {!chatCollapsed && (
            <div
              onMouseDown={() => setIsDragging(true)}
              className="w-1 h-full bg-gray-200 hover:bg-blue-400 cursor-col-resize transition-colors"
            />
          )}
          {chatCollapsed && <div className="w-1 h-full bg-gray-200" />}
          <button
            onClick={toggleChatCollapsed}
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 bg-white border border-gray-200 hover:border-blue-400 hover:text-blue-500 rounded-full w-6 h-6 flex items-center justify-center text-gray-400 shadow-sm transition-colors z-10"
            title={chatCollapsed ? 'Chat tonen' : 'Chat verbergen'}
          >
            <svg className={`h-3.5 w-3.5 transition-transform ${chatCollapsed ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* Chat */}
        {!chatCollapsed && (
        <div style={{ width: chatWidth }} className="flex flex-col bg-white shrink-0">

        {/* Filter bar */}
        <div className="border-b border-gray-200 px-4 py-2 flex flex-wrap items-center gap-2">
          {uniqueAccounts.length > 0 && (
            <MultiSelect
              label="Accounts"
              options={[...uniqueAccounts].sort((a, b) => a.label.localeCompare(b.label))}
              selected={selectedAccountIds}
              onToggle={(id) => setSelectedAccountIds(toggleInSet(selectedAccountIds, id))}
              onSelectAll={() => setSelectedAccountIds(new Set(uniqueAccounts.map(a => a.id)))}
              onDeselectAll={() => setSelectedAccountIds(new Set())}
            />
          )}

          {platforms.length > 0 && (
            <MultiSelect
              label="Platformen"
              options={[...platforms].sort((a, b) => a.label.localeCompare(b.label))}
              selected={selectedPlatformIds}
              onToggle={(id) => setSelectedPlatformIds(toggleInSet(selectedPlatformIds, id))}
              onSelectAll={() => setSelectedPlatformIds(new Set(platforms.map(p => p.id)))}
              onDeselectAll={() => setSelectedPlatformIds(new Set())}
            />
          )}

          {/* Datum filters */}
          <div className="flex items-center gap-1.5 ml-auto">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-xs text-gray-400">—</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => setCompareEnabled(!compareEnabled)}
              className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                compareEnabled
                  ? 'bg-purple-50 border-purple-200 text-purple-700'
                  : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
              title="Vergelijk met andere periode"
            >
              Vergelijk
            </button>
          </div>

          {messages.length > 0 && (
            <button
              onClick={resetChat}
              className="text-xs text-gray-500 hover:text-gray-700 transition-colors ml-1"
            >
              Reset chat
            </button>
          )}
        </div>

        {/* Compare date range */}
        {compareEnabled && (
          <div className="border-b border-gray-200 px-6 py-2 flex items-center gap-2 bg-purple-50/50">
            <span className="text-xs text-purple-600 font-medium shrink-0">Vergelijk met:</span>
            <input
              type="date"
              value={compareDateFrom}
              onChange={(e) => setCompareDateFrom(e.target.value)}
              className="text-xs border border-purple-200 rounded-lg px-2 py-1.5 text-purple-700 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <span className="text-xs text-purple-400">—</span>
            <input
              type="date"
              value={compareDateTo}
              onChange={(e) => setCompareDateTo(e.target.value)}
              className="text-xs border border-purple-200 rounded-lg px-2 py-1.5 text-purple-700 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        )}

        {/* No data warning */}
        {noDataWarning && (
          <div className="mx-6 mt-3 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2">
            <svg className="h-4 w-4 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <p className="text-xs text-amber-800">Geen data beschikbaar voor deze combinatie van accounts en platformen. Pas je filters aan.</p>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-400 mt-24">
              <p className="text-sm mb-4">Probeer een van deze vragen:</p>
              <div className="flex flex-col items-center gap-2">
                {[
                  'Geef me een overzicht van alle campagnes',
                  'Welke campagnes presteren het slechtst?',
                  'Vergelijk de platformen met elkaar',
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => sendMessage(suggestion)}
                    className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors w-fit"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i}>
              {msg.role === 'user' ? (
                <div className="flex justify-end">
                  <div className="max-w-[90%] rounded-2xl px-4 py-2.5 bg-blue-600 text-white">
                    <div className="text-sm leading-relaxed">{msg.content}</div>
                  </div>
                </div>
              ) : (
                (() => {
                  const parts = msg.content.split('---');
                  const hasAnalysis = parts.length > 1;
                  const chatPart = hasAnalysis ? parts[parts.length - 1] : msg.content;
                  const summaryLines = chatPart.split('\n').filter(l => {
                    const t = l.trim();
                    return t
                      && !t.startsWith('- ')
                      && !/^vervolgacties/i.test(t.replace(/\*/g, ''))
                      && !/^(Wil je|Zal ik|Moet ik|Kan ik|Laten we)/i.test(t);
                  });
                  const summary = summaryLines.join(' ').trim() || 'De analyse staat in het canvas.';

                  const cleanLabel = (s: string) =>
                    s.replace(/^\[/, '').replace(/\]$/, '').replace(/\?$/, '').trim();

                  const actions: string[] = [];
                  for (const line of chatPart.split('\n').map(l => l.trim()).filter(Boolean)) {
                    if (line.startsWith('- ')) {
                      actions.push(cleanLabel(line.replace(/^- /, '')));
                    } else if (/^(Wil je|Zal ik|Moet ik|Kan ik|Laten we)/i.test(line)) {
                      actions.push(cleanLabel(line));
                    }
                  }

                  return (
                    <div className="flex justify-start">
                      <div className="max-w-[90%] rounded-2xl px-4 py-3 bg-gray-100 text-gray-900">
                        {hasAnalysis && (
                          <button
                            onClick={() => setCanvasContent(msg.content)}
                            className="text-xs text-blue-600 hover:text-blue-500 font-medium mb-2 flex items-center gap-1 cursor-pointer"
                          >
                            &larr; Bekijk volledige analyse in canvas
                          </button>
                        )}
                        <div className="text-sm leading-relaxed">{summary}</div>
                        {actions.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-3">
                            {actions.map((action) => (
                              <button
                                key={action}
                                onClick={() => sendMessage(action)}
                                className="px-3 py-1.5 text-xs font-medium bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors border border-blue-200"
                              >
                                {action}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()
              )}
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-2xl px-4 py-2.5">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Data ophalen en analyseren...
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="border-t border-gray-200 px-6 py-4">
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Stel een vraag over je campagnes..."
              className="flex-1 bg-gray-100 text-gray-900 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim() || noDataWarning}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl px-5 py-3 text-sm font-medium transition-colors"
            >
              Verstuur
            </button>
          </div>
        </form>
      </div>
        )}
      </div>
    </div>
  );
}
