import { useEffect, useRef, useState } from 'react';
import type { PublicSession } from '../shared/auth-types';
import { AdhicsPanel } from './AdhicsPanel';
import { AssetDetailPanel } from './AssetDetailPanel';
import { AssetManagerPanel } from './AssetManagerPanel';
import { DashboardPanel } from './DashboardPanel';
import { FindingsPanel } from './FindingsPanel';
import { FirstLoginSetup } from './FirstLoginSetup';
import { LoginView } from './LoginView';
import { ReportPanel } from './ReportPanel';
import { ScanningPanel } from './ScanningPanel';
import { ScriptsPanel } from './ScriptsPanel';
import { SettingsPanel } from './SettingsPanel';
import { UserMenu } from './UserMenu';
import { Skeleton } from '@/components/ui/skeleton';

type NavId =
  | 'scanning'
  | 'assets'
  | 'dashboard'
  | 'findings'
  | 'adhics'
  | 'scripts'
  | 'report'
  | 'settings';

type AppView = NavId | 'assetDetail';

const MENU_LOAD_MS = 280;

const NAV: Array<{ id: NavId; label: string }> = [
  { id: 'scanning', label: 'Scanning' },
  { id: 'assets', label: 'Inventory' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'findings', label: 'Findings' },
  { id: 'adhics', label: 'ADHICS' },
  { id: 'scripts', label: 'Scripts' },
  { id: 'report', label: 'Report' },
  { id: 'settings', label: 'Settings' },
];

export function App() {
  const [session, setSession] = useState<PublicSession | null>(null);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<AppView>('scanning');
  const [activeNav, setActiveNav] = useState<NavId>('scanning');
  const [menuLoading, setMenuLoading] = useState(false);
  const [assetId, setAssetId] = useState<number | null>(null);
  const [detailOrigin, setDetailOrigin] = useState<NavId>('dashboard');
  const [scriptControlId, setScriptControlId] = useState<string | null>(null);
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

  const go = (next: AppView, nav: NavId) => {
    if (menuLoading) {
      return;
    }
    if (next === view && next !== 'assetDetail' && next !== 'scripts') {
      return;
    }
    setActiveNav(nav);
    if (next === view) {
      return;
    }
    setMenuLoading(true);
    loadTimer.current = window.setTimeout(() => {
      setView(next);
      setMenuLoading(false);
      loadTimer.current = null;
    }, MENU_LOAD_MS);
  };

  const changeNav = (next: NavId) => {
    if (next !== 'scripts') {
      setScriptControlId(null);
    }
    go(next, next);
  };

  const openAsset = (id: number, origin: NavId) => {
    setAssetId(id);
    setDetailOrigin(origin);
    go('assetDetail', origin);
  };

  const openScripts = (controlId: string) => {
    setScriptControlId(controlId);
    go('scripts', 'scripts');
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

  if (session.setupRequired) {
    return (
      <FirstLoginSetup
        session={session}
        onDone={() => {
          void refreshSession();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-health-canvas text-health-text">
      <header className="border-b border-health-border bg-health-surface">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-8 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-health-accent">
              NetXScan
            </p>
            <h1 className="mt-1 text-2xl font-semibold">Network assets</h1>
          </div>
          <UserMenu
            session={session}
            onLoggedOut={() => {
              void refreshSession();
            }}
          />
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-8 py-8">
        <nav className="mb-6 flex flex-wrap gap-1 rounded-xl border border-health-border bg-health-surface p-1">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={menuLoading}
              className={
                activeNav === item.id
                  ? 'app-nav-btn app-nav-btn-active'
                  : 'app-nav-btn'
              }
              onClick={() => changeNav(item.id)}
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
        ) : view === 'assets' ? (
          <AssetManagerPanel session={session} />
        ) : view === 'dashboard' ? (
          <DashboardPanel
            onOpenAsset={(id) => openAsset(id, 'dashboard')}
            onOpenFindings={() => changeNav('findings')}
          />
        ) : view === 'assetDetail' && assetId !== null ? (
          <AssetDetailPanel
            assetId={assetId}
            onBack={() => changeNav(detailOrigin)}
            onOpenScripts={openScripts}
          />
        ) : view === 'findings' ? (
          <FindingsPanel onOpenAsset={(id) => openAsset(id, 'findings')} />
        ) : view === 'adhics' ? (
          <AdhicsPanel
            session={session}
            onOpenScripts={openScripts}
          />
        ) : view === 'scripts' ? (
          <ScriptsPanel focusControlCode={scriptControlId} />
        ) : view === 'report' ? (
          <ReportPanel />
        ) : view === 'settings' ? (
          <SettingsPanel
            session={session}
            onSessionRefresh={() => {
              void refreshSession();
            }}
          />
        ) : (
          <DashboardPanel
            onOpenAsset={(id) => openAsset(id, 'dashboard')}
            onOpenFindings={() => changeNav('findings')}
          />
        )}
      </div>
    </div>
  );
}
