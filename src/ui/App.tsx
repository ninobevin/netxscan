import { useEffect, useRef, useState } from 'react';
import type { CompanyProfile } from '../shared/company-types';
import type { PublicSession } from '../shared/auth-types';
import { DiscoveryAssets } from './DiscoveryAssets';
import { AuditPanel } from './AuditPanel';
import { CompanyProfilePanel } from './CompanyProfilePanel';
import { LoadingScreen } from './LoadingScreen';
import { LoginView } from './LoginView';
import { PageLayout } from './PageLayout';

type AppView = 'discovery' | 'company' | 'audit';

type ShellProps = {
  session: PublicSession;
  onLoggedOut: () => void;
  profile: CompanyProfile | null;
  onProfileUpdated: (profile: CompanyProfile) => void;
};

const MENU_LOAD_MS = 450;

const NAV_ITEMS: Array<{ id: AppView; label: string }> = [
  { id: 'discovery', label: 'Discovery and Asset' },
  { id: 'audit', label: 'Audit' },
  { id: 'company', label: 'Settings' },
];

function Shell({ session, onLoggedOut, profile, onProfileUpdated }: ShellProps) {
  const [view, setView] = useState<AppView>('discovery');
  const [activeNav, setActiveNav] = useState<AppView>('discovery');
  const [menuLoading, setMenuLoading] = useState(false);
  const loadTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (loadTimer.current !== null) {
        window.clearTimeout(loadTimer.current);
      }
    };
  }, []);

  const onLogout = async () => {
    await window.netxscan.logout();
    onLoggedOut();
  };

  const changeView = (next: AppView) => {
    if (next === view || menuLoading) {
      return;
    }

    setActiveNav(next);
    setMenuLoading(true);
    loadTimer.current = window.setTimeout(() => {
      setView(next);
      setMenuLoading(false);
      loadTimer.current = null;
    }, MENU_LOAD_MS);
  };

  return (
    <PageLayout
      profile={profile}
      session={session}
      onSignOut={() => {
        void onLogout();
      }}
    >
      <nav className="mb-8 flex flex-wrap gap-1 rounded-xl border border-health-border bg-health-surface p-1">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={menuLoading}
            className={
              activeNav === item.id
                ? 'app-nav-btn app-nav-btn-active'
                : 'app-nav-btn'
            }
            onClick={() => changeView(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      {menuLoading ? (
        <LoadingScreen />
      ) : view === 'discovery' ? (
        <DiscoveryAssets canScan={session.role === 'administrator'} />
      ) : view === 'company' ? (
        profile ? (
          <CompanyProfilePanel
            canEdit={session.role === 'administrator'}
            profile={profile}
            onUpdated={onProfileUpdated}
          />
        ) : (
          <p className="text-sm text-health-subtle">Loading company profile…</p>
        )
      ) : (
        <AuditPanel />
      )}
    </PageLayout>
  );
}

export function App() {
  const [session, setSession] = useState<PublicSession | null>(null);
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<CompanyProfile | null>(null);

  const refreshSession = async () => {
    const next = await window.netxscan.getSession();
    setSession(next);
    setReady(true);
  };

  const refreshProfile = async () => {
    const result = await window.netxscan.getCompanyProfile();
    if (result.ok) {
      setProfile(result.profile);
    }
  };

  useEffect(() => {
    void refreshSession();
    void refreshProfile();
    const timer = window.setInterval(() => {
      void refreshSession();
    }, 10000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  if (!ready) {
    return (
      <PageLayout profile={profile}>
        <LoadingScreen />
      </PageLayout>
    );
  }

  if (!session) {
    return (
      <LoginView
        profile={profile}
        onLoggedIn={() => {
          void refreshSession();
        }}
      />
    );
  }

  return (
    <Shell
      session={session}
      profile={profile}
      onProfileUpdated={setProfile}
      onLoggedOut={() => {
        void refreshSession();
      }}
    />
  );
}
