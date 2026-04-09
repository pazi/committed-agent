'use client';

import type { ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChartRenderer, type ChartConfig } from './ChartRenderer';

export function ChatMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h2: ({ children }: { children?: ReactNode }) => (
          <h2 className="text-lg font-bold text-gray-900 mt-6 mb-3 pb-2 border-b border-gray-200 first:mt-0">{children}</h2>
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
          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{children}</th>
        ),
        td: ({ children }: { children?: ReactNode }) => (
          <td className="px-4 py-2.5 text-sm text-gray-700 border-t border-gray-100">{children}</td>
        ),
        tr: ({ children }: { children?: ReactNode }) => (
          <tr className="hover:bg-gray-50 transition-colors">{children}</tr>
        ),
        code: ({ className, children }: { className?: string; children?: ReactNode }) => {
          if (className === 'language-chart') {
            try {
              const config: ChartConfig = JSON.parse(String(children).trim());
              return <ChartRenderer config={config} />;
            } catch (err) {
              return (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 my-3">
                  Chart rendering fout: {err instanceof Error ? err.message : 'invalid JSON'}
                </div>
              );
            }
          }
          return (
            <code className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-xs font-mono">
              {children}
            </code>
          );
        },
        pre: ({ children }: { children?: ReactNode }) => <>{children}</>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
