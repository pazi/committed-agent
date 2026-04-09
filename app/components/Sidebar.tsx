'use client';

import { useState, useEffect, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '../../src/lib/supabase-browser';

interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  {
    label: 'Chat',
    href: '/',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
  {
    label: 'Chat geschiedenis',
    href: '/history',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: 'Accounts',
    href: '/accounts',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    label: 'Platforms',
    href: '/platforms',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
  },
  {
    label: 'Gebruikers',
    href: '/admin/users',
    adminOnly: true,
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
];

export function Sidebar({
  userEmail,
  userRole,
  onSignOut,
}: {
  userEmail: string;
  userRole: string;
  onSignOut: () => void;
}) {
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed');
    if (stored !== null) setCollapsed(stored === 'true');
    setMounted(true);
  }, []);

  // 2FA enforcement: als user geen verified factor heeft → forceer setup
  // Wordt overgeslagen als NEXT_PUBLIC_DISABLE_MFA=true
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DISABLE_MFA === 'true') return;
    supabase.auth.mfa.listFactors().then(({ data }) => {
      const verified = data?.totp?.find(f => f.status === 'verified');
      if (!verified) {
        router.replace('/setup-2fa');
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('sidebar-collapsed', String(next));
  }

  if (!mounted) {
    return <div className="w-16 border-r border-gray-200 bg-gray-900 shrink-0" />;
  }

  const visibleItems = navItems.filter(item => !item.adminOnly || userRole === 'admin');

  return (
    <aside
      className={`${
        collapsed ? 'w-16' : 'w-56'
      } bg-gray-900 text-gray-300 flex flex-col shrink-0 transition-all duration-200 border-r border-gray-800`}
    >
      {/* Logo */}
      <div className={`h-16 flex items-center border-b border-gray-800 ${collapsed ? 'justify-center px-2' : 'px-5'}`}>
        <Image
          src="/logo.webp"
          alt="TCA"
          width={collapsed ? 32 : 130}
          height={collapsed ? 32 : 28}
          className={collapsed ? 'object-contain' : ''}
        />
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-3">
        {visibleItems.map(item => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-5 py-2.5 text-sm transition-colors ${
                active
                  ? 'bg-gray-800 text-white border-l-2 border-blue-500'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white border-l-2 border-transparent'
              } ${collapsed ? 'justify-center px-2' : ''}`}
              title={collapsed ? item.label : undefined}
            >
              <span className="shrink-0">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User + collapse */}
      <div className="border-t border-gray-800 py-3">
        {!collapsed && userEmail && (
          <div className="px-5 pb-2">
            <p className="text-xs text-gray-500 truncate" title={userEmail}>{userEmail}</p>
            <p className="text-xs text-gray-600 capitalize">{userRole}</p>
          </div>
        )}
        <button
          onClick={onSignOut}
          className={`w-full flex items-center gap-3 px-5 py-2 text-xs text-gray-400 hover:bg-gray-800 hover:text-white transition-colors ${
            collapsed ? 'justify-center px-2' : ''
          }`}
          title={collapsed ? 'Uitloggen' : undefined}
        >
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          {!collapsed && <span>Uitloggen</span>}
        </button>
        <button
          onClick={toggleCollapsed}
          className={`w-full flex items-center gap-3 px-5 py-2 text-xs text-gray-500 hover:bg-gray-800 hover:text-white transition-colors mt-1 ${
            collapsed ? 'justify-center px-2' : ''
          }`}
          title={collapsed ? 'Uitklappen' : 'Inklappen'}
        >
          <svg className={`h-4 w-4 shrink-0 transition-transform ${collapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
          {!collapsed && <span>Inklappen</span>}
        </button>
      </div>
    </aside>
  );
}
