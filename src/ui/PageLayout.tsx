import type { ReactNode } from 'react';
import type { CompanyProfile } from '../shared/company-types';
import type { PublicSession } from '../shared/auth-types';

type PageLayoutProps = {
  children: ReactNode;
  profile?: CompanyProfile | null;
  session?: PublicSession | null;
  onSignOut?: () => void;
};

function roleLabel(role: string): string {
  if (role === 'it_support') {
    return 'IT support';
  }

  return 'Administrator';
}

export function PageLayout({
  children,
  profile,
  session,
  onSignOut,
}: PageLayoutProps) {
  const companyName = profile?.companyName ?? 'Your organization';

  return (
    <div className="min-h-screen bg-health-canvas text-health-text">
      <header className="border-b border-health-border bg-health-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-8 py-5">
          <div className="flex min-w-0 items-center gap-4">
            {profile?.hasLogo && profile.logoDataUrl ? (
              <img
                src={profile.logoDataUrl}
                alt=""
                className="h-14 w-14 shrink-0 rounded-xl border border-health-border bg-health-muted object-contain p-1"
              />
            ) : (
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-dashed border-health-border bg-health-muted text-[10px] font-medium uppercase tracking-wide text-health-subtle"
                aria-hidden="true"
              >
                Logo
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-health-accent">
                {companyName}
              </p>
              <h1 className="mt-1 text-2xl font-semibold">NetXScan</h1>
              <p className="mt-1 max-w-xl text-sm text-health-subtle">
                Network-Based IT Asset Inventory and Vulnerability Management
                System
              </p>
            </div>
          </div>
          {session && onSignOut ? (
            <div className="flex shrink-0 items-center gap-3">
              <div className="flex items-center gap-3 rounded-xl border border-health-border bg-health-muted px-3 py-2">
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-health-accent text-sm font-semibold text-white"
                  aria-hidden="true"
                >
                  {session.username.slice(0, 1).toUpperCase()}
                </span>
                <div className="text-right">
                  <p className="text-sm font-medium leading-tight">
                    {session.username}
                  </p>
                  <p className="text-xs text-health-subtle">
                    {roleLabel(session.role)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="app-btn-secondary"
                onClick={onSignOut}
              >
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-8 py-8">{children}</div>
    </div>
  );
}
