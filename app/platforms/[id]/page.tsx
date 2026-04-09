'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../../src/lib/supabase-browser';
import { Sidebar } from '../../components/Sidebar';
import { DetailView } from '../../components/DetailView';

const platformLabels: Record<string, string> = {
  google_ads: 'Google Ads',
  facebook: 'Facebook Ads',
  linkedin: 'LinkedIn Ads',
  reddit: 'Reddit Ads',
};

export default function PlatformDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const label = platformLabels[id] ?? id;

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

  return (
    <div className="flex h-screen">
      <Sidebar userEmail={userEmail} userRole={userRole} onSignOut={handleSignOut} />
      <div className="flex-1 overflow-y-auto bg-gray-50/50">
        <DetailView
          title={label}
          subtitle="Platform overzicht"
          backHref="/platforms"
          backLabel="Terug naar platforms"
          apiUrl={`/api/detail-stats?platform=${encodeURIComponent(id)}`}
        />
      </div>
    </div>
  );
}
