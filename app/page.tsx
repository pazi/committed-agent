'use client';

import { useState, useRef, useEffect, type FormEvent, type ReactNode } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { createClient } from '../src/lib/supabase-browser';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

function CanvasMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h2: ({ children }: { children?: ReactNode }) => (
          <h2 className="text-lg font-bold text-gray-900 mt-6 mb-3 pb-2 border-b border-gray-200 first:mt-0">
            {children}
          </h2>
        ),
        h3: ({ children }: { children?: ReactNode }) => (
          <div className="bg-white border border-gray-200 rounded-xl p-4 mt-4 mb-2 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-800">{children}</h3>
          </div>
        ),
        p: ({ children }: { children?: ReactNode }) => (
          <p className="text-sm text-gray-700 leading-relaxed mb-3">{children}</p>
        ),
        ul: ({ children }: { children?: ReactNode }) => (
          <ul className="space-y-1.5 mb-4 ml-1">{children}</ul>
        ),
        ol: ({ children }: { children?: ReactNode }) => (
          <ol className="space-y-1.5 mb-4 ml-1 list-decimal list-inside">{children}</ol>
        ),
        li: ({ children }: { children?: ReactNode }) => (
          <li className="text-sm text-gray-700 flex gap-2">
            <span className="text-blue-500 mt-0.5">&#8226;</span>
            <span>{children}</span>
          </li>
        ),
        strong: ({ children }: { children?: ReactNode }) => (
          <strong className="font-semibold text-gray-900">{children}</strong>
        ),
        table: ({ children }: { children?: ReactNode }) => (
          <div className="overflow-x-auto my-4 border border-gray-200 rounded-xl shadow-sm">
            <table className="w-full text-sm">{children}</table>
          </div>
        ),
        thead: ({ children }: { children?: ReactNode }) => (
          <thead className="bg-gray-50 border-b border-gray-200">{children}</thead>
        ),
        th: ({ children }: { children?: ReactNode }) => (
          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
            {children}
          </th>
        ),
        td: ({ children }: { children?: ReactNode }) => (
          <td className="px-4 py-2.5 text-sm text-gray-700 border-t border-gray-100">
            {children}
          </td>
        ),
        tr: ({ children }: { children?: ReactNode }) => (
          <tr className="hover:bg-gray-50 transition-colors">{children}</tr>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [canvasContent, setCanvasContent] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? '');
      setUserRole(data.user?.user_metadata?.role ?? '');
    });
  }, [supabase.auth]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;

    const userMessage: Message = { role: 'user', content: text.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      });

      const data = await res.json();
      const assistantMessage: Message = { role: 'assistant', content: data.content };
      setMessages([...newMessages, assistantMessage]);
      setCanvasContent(data.content);
    } catch {
      setMessages([
        ...newMessages,
        { role: 'assistant', content: 'Er ging iets mis. Probeer het opnieuw.' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  return (
    <div className="flex h-screen">
      {/* Left: Canvas */}
      <div className="w-1/2 border-r border-gray-200 flex flex-col bg-gray-50/50">
        <header className="border-b border-gray-200 bg-white px-6 py-3 h-16 flex items-center justify-center">
          <Image src="/logo.webp" alt="TCA Logo" width={180} height={40} className="invert" />
        </header>
        <div className="flex-1 overflow-y-auto p-6">
          {canvasContent ? (
            <CanvasMarkdown content={canvasContent} />
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

      {/* Right: Chat */}
      <div className="w-1/2 flex flex-col bg-white">
        <header className="border-b border-gray-200 px-6 py-3 h-16 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Chat</h1>
            <p className="text-xs text-gray-500">Stel vragen over je campagnes</p>
          </div>
          <div className="flex items-center gap-3">
            {userEmail && <span className="text-xs text-gray-400">{userEmail}</span>}
            {userRole === 'admin' && (
              <a href="/admin/users" className="text-xs text-blue-600 hover:text-blue-500 font-medium transition-colors">
                Gebruikers
              </a>
            )}
            <button
              onClick={async () => { await supabase.auth.signOut(); router.push('/login'); router.refresh(); }}
              className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
            >
              Uitloggen
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-400 mt-24">
              <p className="text-sm mb-4">Probeer een van deze vragen:</p>
              <div className="flex flex-col items-center gap-2">
                {[
                  'Geef me een overzicht van alle campagnes',
                  'Welke campagnes presteren het slechtst?',
                  'Analyseer de device performance',
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
                <div className="flex flex-col items-start gap-2">
                  <div
                    className="max-w-[90%] rounded-2xl px-4 py-2.5 bg-gray-100 text-gray-900 cursor-pointer hover:bg-gray-200 transition-colors"
                    onClick={() => setCanvasContent(msg.content)}
                  >
                    <div className="text-sm leading-relaxed">
                      {(() => {
                        const parts = msg.content.split('---');
                        if (parts.length <= 1) return 'De analyse staat in het canvas.';
                        const chatPart = parts[parts.length - 1];
                        const lines = chatPart.split('\n').filter(l => {
                          const t = l.trim();
                          return t && !t.startsWith('- ') && !t.startsWith('VERVOLGACTIES') && !/^(Wil je|Zal ik|Moet ik|Kan ik|Laten we)/i.test(t);
                        });
                        return lines.join(' ').trim() || 'De analyse staat in het canvas.';
                      })()}
                    </div>
                    <p className="text-xs text-blue-600 mt-1.5 font-medium">Volledige analyse in canvas &larr;</p>
                  </div>
                  {/* Vervolgactie knoppen */}
                  {(() => {
                    const parts = msg.content.split('---');
                    if (parts.length <= 1) return null;
                    const chatPart = parts[parts.length - 1];
                    const lines = chatPart.split('\n').map(l => l.trim()).filter(Boolean);
                    const actions: string[] = [];
                    for (const line of lines) {
                      if (line.startsWith('- ')) {
                        actions.push(line.replace(/^- /, ''));
                      } else if (/^(Wil je|Zal ik|Moet ik|Kan ik|Laten we)/i.test(line)) {
                        actions.push(line.replace(/\?$/, ''));
                      }
                    }
                    if (actions.length === 0) return null;
                    return (
                      <div className="flex flex-wrap gap-2 ml-1">
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
                    );
                  })()}
                </div>
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
              disabled={loading || !input.trim()}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl px-5 py-3 text-sm font-medium transition-colors"
            >
              Verstuur
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
