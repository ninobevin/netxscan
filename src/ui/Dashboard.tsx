import { useEffect, useState } from 'react';
import type { DashboardSnapshot } from '../shared/dashboard-types';

function errorText(error: string): string {
  if (error === 'database_unavailable') {
    return 'The database is not available.';
  }

  return 'The dashboard could not be loaded.';
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-health-border bg-health-muted p-4">
      <p className="text-sm text-health-subtle">{label}</p>
      <p className="mt-1 text-3xl font-semibold">{value}</p>
      {hint ? <p className="mt-1 text-xs text-health-subtle">{hint}</p> : null}
    </div>
  );
}

export function Dashboard() {
  const [data, setData] = useState<DashboardSnapshot | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void window.netxscan.getDashboard().then((result) => {
      if (!result.ok) {
        setMessage(errorText(result.error));
        return;
      }

      setData(result.dashboard);
    });
  }, []);

  if (message) {
    return (
      <section className="app-card">
        <h2 className="text-lg font-semibold">Dashboard</h2>
        <p className="text-sm text-health-danger">{message}</p>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="app-card">
        <h2 className="text-lg font-semibold">Dashboard</h2>
        <p className="text-sm text-health-subtle">Loading…</p>
      </section>
    );
  }

  return (
    <div className="grid gap-6">
      <section className="app-card">
        <h2 className="text-lg font-semibold">Dashboard</h2>
        <p className="text-sm text-health-subtle">
          Online and offline counts come from the latest authorized ping or
          discovery scan. An asset is online only if that scan saw its IP as up.
          Finding counts include Open, Acknowledged, and In progress only.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Total assets" value={data.totalAssets} />
          <StatCard
            label="Online"
            value={data.onlineAssets}
            hint="Up in the latest scan"
          />
          <StatCard
            label="Offline"
            value={data.offlineAssets}
            hint="Has an IP, not up in the latest scan"
          />
        </div>
        {data.unscannedAssets > 0 ? (
          <p className="text-sm text-health-subtle">
            {data.unscannedAssets} asset(s) with an IP have not been covered by
            a stored scan yet. Run Discovery to populate online/offline.
          </p>
        ) : null}
      </section>

      <section className="app-card">
        <h2 className="text-lg font-semibold">Open findings</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          <StatCard label="Critical" value={data.criticalFindings} />
          <StatCard label="High" value={data.highFindings} />
          <StatCard label="Medium" value={data.mediumFindings} />
          <StatCard label="Low" value={data.lowFindings} />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="app-card">
          <h2 className="text-lg font-semibold">Recent scans</h2>
          {data.recentScans.length === 0 ? (
            <p className="text-sm text-health-subtle">
              No ping or discovery scans stored yet.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {data.recentScans.map((scan) => (
                <li key={scan.id} className="border-t border-health-border pt-2 first:border-t-0 first:pt-0">
                  <p className="font-medium">
                    {scan.kind === 'ping' ? 'Ping' : 'Discovery'} · {scan.target}
                  </p>
                  <p className="text-health-subtle">
                    {scan.upCount} host(s) up · {scan.createdAt}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="app-card">
          <h2 className="text-lg font-semibold">Recent findings</h2>
          {data.recentFindings.length === 0 ? (
            <p className="text-sm text-health-subtle">
              No open findings yet. Run correlation after collecting facts.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {data.recentFindings.map((item) => (
                <li key={item.id} className="border-t border-health-border pt-2 first:border-t-0 first:pt-0">
                  <p className="font-medium">{item.title}</p>
                  <p className="text-health-subtle">
                    {item.hostname} · {item.cveId} · {item.severity} ·{' '}
                    {item.lastDetected}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
