'use client';

import { use, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '../../../src/lib/supabase-browser';
import { Sidebar } from '../../components/Sidebar';
import { DetailView } from '../../components/DetailView';

export default function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const accountName = searchParams.get('name') ?? id;
  const platform = searchParams.get('platform') ?? '';

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

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  // Map platform label naar interne id voor de API
  const platformIdMap: Record<string, string> = {
    'Google Ads': 'google_ads',
    'Facebook Ads': 'facebook',
    'LinkedIn Ads': 'linkedin',
    'Reddit Ads': 'reddit',
  };
  const platformId = platformIdMap[platform] ?? '';

  return (
    <div className="flex h-screen">
      <Sidebar userEmail={userEmail} userRole={userRole} onSignOut={handleSignOut} />
      <div className="flex-1 overflow-y-auto bg-gray-50/50">
        <DetailView
          title={accountName}
          subtitle={platform || 'Account detail'}
          backHref="/accounts"
          backLabel="Terug naar accounts"
          apiUrl={`/api/detail-stats?accountId=${encodeURIComponent(id)}${platformId ? `&platform=${platformId}` : ''}`}
        />
      </div>
    </div>
  );
}
