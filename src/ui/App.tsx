import { useEffect, useRef, useState } from 'react';
import type { PublicSession } from '../shared/auth-types';
import { AssetManagerPanel } from './AssetManagerPanel';
import { LoginView } from './LoginView';
import { ScanningPanel } from './ScanningPanel';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

type AppView = 'scanning' | 'assets';

const MENU_LOAD_MS = 280;

export function App() {
  const [session, setSession] = useState<PublicSession | null>(null);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<AppView>('scanning');
  const [activeNav, setActiveNav] = useState<AppView>('scanning');
  const [menuLoading, setMenuLoading] = useState(false);
  const loadTimer = useRef<number | null>(null);

  const refreshSession = async () => {
    const next = await window.netxscan.getSession();
    setSession(next);
    setReady(true);
  };

  useEffect(() => {
    void refreshSession();
    const timer = window.setInterval(() => {
      void refreshSession();
    }, 10000);
    return () => {
      window.clearInterval(timer);
      if (loadTimer.current !== null) {
        window.clearTimeout(loadTimer.current);
      }
    };
  }, []);

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

  if (!ready) {
    return (
      <div className="min-h-screen bg-health-canvas p-8">
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!session) {
    return (
      <LoginView
        onLoggedIn={() => {
          void refreshSession();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-health-canvas text-health-text">
      <header className="border-b border-health-border bg-health-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-8 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-health-accent">
              NetXScan
            </p>
            <h1 className="mt-1 text-2xl font-semibold">Network assets</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-health-border bg-health-muted px-3 py-2 text-right">
              <p className="text-sm font-medium">{session.username}</p>
              <p className="text-xs text-health-subtle">
                {session.role === 'administrator' ? 'Administrator' : 'IT support'}
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                void window.netxscan.logout().then(() => refreshSession());
              }}
            >
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-8 py-8">
        <nav className="mb-6 flex flex-wrap gap-1 rounded-xl border border-health-border bg-health-surface p-1">
          {(
            [
              { id: 'scanning', label: 'Scanning' },
              { id: 'assets', label: 'Asset Manager' },
            ] as const
          ).map((item) => (
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
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : view === 'scanning' ? (
          <ScanningPanel />
        ) : (
          <AssetManagerPanel session={session} />
        )}
      </div>
    </div>
  );
}
