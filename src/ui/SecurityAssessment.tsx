import {
  CheckCircle2,
  Globe,
  History,
  Minus,
  Package,
  RefreshCw,
  Shield,
  ShieldCheck,
  User,
  Users,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Asset } from '../shared/asset-types';
import type {
  AssessmentHistoryRow,
  AssessmentModule,
} from '../shared/assess-types';
import { BusyButton } from './BusyButton';

type Finding = {
  id: string;
  title: string;
  status: string;
  detail?: string;
};

type PackageRow = {
  name: string;
  version?: string;
  publisher?: string;
  uninstallKey?: string;
};

function errorText(error: string): string {
  if (error === 'forbidden') {
    return 'Only administrators can run security assessments.';
  }
  if (error === 'not_manageable') {
    return 'Enable WinRM on this host in Discovery and Asset first.';
  }
  if (error === 'in_progress') {
    return 'An assessment is already running.';
  }
  if (error === 'unavailable') {
    return 'Assessments run only on Windows.';
  }
  return 'The request could not be completed.';
}

function payloadData(json: string | null): Record<string, unknown> {
  if (!json) {
    return {};
  }
  try {
    const parsed = JSON.parse(json) as { data?: unknown };
    if (parsed.data && typeof parsed.data === 'object') {
      return parsed.data as Record<string, unknown>;
    }
  } catch {
    return {};
  }
  return {};
}

function StatusMark({ status }: { status: string }) {
  const label = `[${status.toUpperCase()}]`;
  if (status === 'pass') {
    return (
      <span className="inline-flex items-center gap-1 text-health-accent">
        <CheckCircle2 className="h-4 w-4" /> {label}
      </span>
    );
  }
  if (status === 'fail') {
    return (
      <span className="inline-flex items-center gap-1 text-health-danger">
        <XCircle className="h-4 w-4" /> {label}
      </span>
    );
  }
  if (status === 'warn') {
    return (
      <span className="inline-flex items-center gap-1 text-amber-500">
        <Minus className="h-4 w-4" /> {label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-health-subtle">
      <Minus className="h-4 w-4" /> {label}
    </span>
  );
}

type SecurityAssessmentProps = {
  canRun: boolean;
};

export function SecurityAssessment({ canRun }: SecurityAssessmentProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [modules, setModules] = useState<AssessmentModule[]>([]);
  const [selected, setSelected] = useState<Asset | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, string | null>>({});
  const [history, setHistory] = useState<AssessmentHistoryRow[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [customName, setCustomName] = useState('');
  const [customAssess, setCustomAssess] = useState(
    '{ positive = $true; summary = "ok"; data = @{} } | ConvertTo-Json -Compress',
  );
  const [customRemediate, setCustomRemediate] = useState('');
  const [customReverse, setCustomReverse] = useState('');

  const manageable = useMemo(
    () => assets.filter((asset) => asset.winrmManageable === true),
    [assets],
  );

  const bySlug = (slug: string) =>
    modules.find((module) => module.slug === slug);

  const customModules = modules.filter((module) => !module.slug);

  const load = async () => {
    const listed = await window.netxscan.listAssets(false);
    if (listed.ok) {
      setAssets(listed.assets);
    }
    const mods = await window.netxscan.listAssessModules();
    if (mods.ok) {
      setModules(mods.modules);
    } else {
      setMessage(errorText(mods.error));
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const refreshHost = async (asset: Asset, list: AssessmentModule[]) => {
    const next: Record<string, string | null> = {};
    for (const module of list) {
      const result = await window.netxscan.getAssessResult(asset.id, module.id);
      next[module.id] = result.ok ? (result.result?.payloadJson ?? null) : null;
    }
    setResults(next);
    const hist = await window.netxscan.listAssessHistory(asset.id);
    if (hist.ok) {
      setHistory(hist.rows);
    }
  };

  const openHost = async (asset: Asset) => {
    setSelected(asset);
    setMessage(null);
    await refreshHost(asset, modules);
  };

  const run = async (
    module: AssessmentModule,
    kind: 'assess' | 'remediate' = 'assess',
    params?: Record<string, string>,
  ) => {
    if (!selected || !canRun) {
      return;
    }
    setBusy(
      `${module.id}:${kind}:${params?.uninstallKey ?? params?.wingetId ?? ''}`,
    );
    setMessage(null);
    const result = await window.netxscan.runAssessment({
      id: selected.id,
      moduleId: module.id,
      kind,
      params,
    });
    setBusy(null);
    if (!result.ok) {
      setMessage(errorText(result.error));
      return;
    }
    setMessage(result.summary);
    await refreshHost(selected, modules);
  };

  const onReverse = async (row: AssessmentHistoryRow) => {
    const module = modules.find((item) => item.id === row.moduleId);
    if (!module?.reverseScript || !canRun) {
      return;
    }
    if (!window.confirm('Run the reverse script for this history entry?')) {
      return;
    }
    setBusy(`reverse:${row.id}`);
    const result = await window.netxscan.reverseAssessment(row.id);
    setBusy(null);
    if (!result.ok) {
      setMessage(errorText(result.error));
      return;
    }
    setMessage(result.summary);
    if (selected) {
      await refreshHost(selected, modules);
    }
  };

  const saveCustom = async () => {
    const result = await window.netxscan.saveAssessModule({
      name: customName,
      description: null,
      assessScript: customAssess,
      remediationScript: customRemediate || null,
      reverseScript: customReverse || null,
    });
    if (!result.ok) {
      setMessage(errorText(result.error));
      return;
    }
    setCustomName('');
    await load();
  };

  if (!canRun) {
    return (
      <section className="app-card">
        <h2 className="text-lg font-semibold">Security assessment</h2>
        <p className="text-sm text-health-subtle">
          Sign in as administrator to assess manageable workstations.
        </p>
      </section>
    );
  }

  if (!selected) {
    return (
      <section className="app-card overflow-x-auto">
        <h2 className="text-lg font-semibold">Security assessment</h2>
        <p className="text-sm text-health-subtle">
          Click a WinRM-manageable workstation to open its findings, software,
          updates, firewall, users, and domain controller.
        </p>
        {message ? (
          <p className="text-sm text-health-danger">{message}</p>
        ) : null}
        {manageable.length === 0 ? (
          <p className="text-sm text-health-subtle">
            No manageable hosts yet. Enable WinRM from Discovery and Asset.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-health-border text-health-subtle">
                <th className="py-2 pr-3 font-medium">Hostname</th>
                <th className="py-2 pr-3 font-medium">IP</th>
                <th className="py-2 font-medium">Group</th>
              </tr>
            </thead>
            <tbody>
              {manageable.map((asset) => (
                <tr key={asset.id} className="border-b border-health-border">
                  <td className="py-2 pr-3">
                    <button
                      type="button"
                      className="text-health-accent"
                      onClick={() => {
                        void openHost(asset);
                      }}
                    >
                      {asset.hostname}
                    </button>
                  </td>
                  <td className="py-2 pr-3">{asset.ipAddress ?? '—'}</td>
                  <td className="py-2">{asset.assetGroup ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    );
  }

  const baseline = bySlug('security_baseline');
  const software = bySlug('installed_software');
  const updates = bySlug('security_updates');
  const firewall = bySlug('firewall');
  const localUsers = bySlug('local_users');
  const loggedIn = bySlug('logged_in_user');
  const dc = bySlug('domain_controller');

  const baselineFindings = (
    payloadData(baseline ? results[baseline.id] ?? null : null).findings ?? []
  ) as Finding[];
  const packages = (
    payloadData(software ? results[software.id] ?? null : null).packages ?? []
  ) as PackageRow[];
  const missing = (
    payloadData(updates ? results[updates.id] ?? null : null).missing ?? []
  ) as Array<{ title?: string }>;
  const installedKbs = (
    payloadData(updates ? results[updates.id] ?? null : null).installed ?? []
  ) as Array<{ kb?: string }>;
  const profiles = (
    payloadData(firewall ? results[firewall.id] ?? null : null).profiles ?? []
  ) as Array<{
    name: string;
    enabled: boolean;
    defaultInbound?: string;
    defaultOutbound?: string;
  }>;
  const users = (
    payloadData(localUsers ? results[localUsers.id] ?? null : null).users ?? []
  ) as Array<{ name: string; enabled: boolean }>;
  const sessions = (
    payloadData(loggedIn ? results[loggedIn.id] ?? null : null).users ?? []
  ) as Array<{ name: string; session?: string }>;
  const dcData = payloadData(dc ? results[dc.id] ?? null : null);

  return (
    <div className="grid gap-6">
      <section className="app-card">
        <button
          type="button"
          className="mb-2 text-sm text-health-accent"
          onClick={() => setSelected(null)}
        >
          Back to workstations
        </button>
        <h2 className="text-lg font-semibold">
          {selected.hostname}
          {selected.ipAddress ? ` (${selected.ipAddress})` : ''}
        </h2>
        {message ? <p className="text-sm text-health-subtle">{message}</p> : null}
      </section>

      {baseline ? (
        <section className="app-card overflow-x-auto">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="inline-flex items-center gap-2 font-semibold">
              <Shield className="h-5 w-5" /> Baseline findings
            </h3>
            <BusyButton
              className="app-btn-primary"
              busy={busy === `${baseline.id}:assess:`}
              busyLabel="Collecting…"
              onClick={() => {
                void run(baseline);
              }}
            >
              Get
            </BusyButton>
          </div>
          {baselineFindings.length === 0 ? (
            <p className="text-sm text-health-subtle">
              PASS means the required setting is in place. FAIL/WARN means the
              host is not compliant. Run Get to collect findings.
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <tbody>
                {baselineFindings.map((finding) => (
                  <tr key={finding.id} className="border-b border-health-border">
                    <td className="py-1 pr-3">
                      <StatusMark status={finding.status} />
                    </td>
                    <td className="py-1 pr-3">{finding.title}</td>
                    <td className="py-1 text-health-subtle">{finding.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ) : null}

      {software ? (
        <section className="app-card overflow-x-auto">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="inline-flex items-center gap-2 font-semibold">
              <Package className="h-5 w-5" /> Installed software
            </h3>
            <BusyButton
              className="app-btn-secondary"
              busy={busy === `${software.id}:assess:`}
              busyLabel="Loading…"
              onClick={() => {
                void run(software);
              }}
            >
              Get
            </BusyButton>
          </div>
          {packages.length === 0 ? (
            <p className="text-sm text-health-subtle">No inventory yet.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-health-subtle">
                  <th className="py-1 pr-3">Name</th>
                  <th className="py-1 pr-3">Version</th>
                  <th className="py-1">Actions</th>
                </tr>
              </thead>
              <tbody>
                {packages.slice(0, 200).map((pkg) => (
                  <tr
                    key={`${pkg.name}-${pkg.uninstallKey}`}
                    className="border-b border-health-border"
                  >
                    <td className="py-1 pr-3">{pkg.name}</td>
                    <td className="py-1 pr-3">{pkg.version ?? '—'}</td>
                    <td className="py-1">
                      <BusyButton
                        className="mr-3 text-health-danger"
                        busy={
                          busy ===
                          `${software.id}:remediate:${pkg.uninstallKey ?? ''}`
                        }
                        busyLabel="Uninstalling…"
                        disabled={!pkg.uninstallKey}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Uninstall ${pkg.name} on this host? This waits until msiexec finishes.`,
                            ) &&
                            pkg.uninstallKey
                          ) {
                            void run(software, 'remediate', {
                              action: 'uninstall',
                              uninstallKey: pkg.uninstallKey,
                            });
                          }
                        }}
                      >
                        Uninstall
                      </BusyButton>
                      <BusyButton
                        className="text-health-accent"
                        busy={
                          busy ===
                          `${software.id}:remediate:${pkg.name.replace(/[^A-Za-z0-9._+-]/g, '')}`
                        }
                        busyLabel="Updating…"
                        onClick={() => {
                          if (window.confirm(`Update ${pkg.name}?`)) {
                            void run(software, 'remediate', {
                              action: 'update',
                              wingetId: pkg.name.replace(/[^A-Za-z0-9._+-]/g, ''),
                            });
                          }
                        }}
                      >
                        Update
                      </BusyButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ) : null}

      {updates ? (
        <section className="app-card">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="inline-flex items-center gap-2 font-semibold">
              <RefreshCw className="h-5 w-5" /> Security updates
            </h3>
            <div className="flex gap-2">
              <BusyButton
                className="app-btn-secondary"
                busy={busy === `${updates.id}:assess:`}
                busyLabel="Loading…"
                onClick={() => {
                  void run(updates);
                }}
              >
                Get
              </BusyButton>
              <BusyButton
                className="app-btn-primary"
                busy={busy === `${updates.id}:remediate:`}
                busyLabel="Installing…"
                onClick={() => {
                  if (window.confirm('Install missing updates on this host?')) {
                    void run(updates, 'remediate');
                  }
                }}
              >
                Install updates
              </BusyButton>
            </div>
          </div>
          <p className="text-sm text-health-subtle">
            Installed KBs: {installedKbs.length}. Missing: {missing.length}.
          </p>
          <ul className="mt-2 list-disc pl-5 text-sm">
            {missing.slice(0, 30).map((item) => (
              <li key={item.title}>{item.title}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {firewall ? (
        <section className="app-card">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="inline-flex items-center gap-2 font-semibold">
              <ShieldCheck className="h-5 w-5" /> Firewall
            </h3>
            <BusyButton
              className="app-btn-secondary"
              busy={busy === `${firewall.id}:assess:`}
              busyLabel="Loading…"
              onClick={() => {
                void run(firewall);
              }}
            >
              Get
            </BusyButton>
          </div>
          <table className="w-full text-left text-sm">
            <tbody>
              {profiles.map((profile) => (
                <tr key={profile.name} className="border-b border-health-border">
                  <td className="py-1 pr-3">{profile.name}</td>
                  <td className="py-1 pr-3">
                    {profile.enabled ? 'On' : 'Off'}
                  </td>
                  <td className="py-1 text-health-subtle">
                    in {profile.defaultInbound} / out {profile.defaultOutbound}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {localUsers ? (
        <section className="app-card">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="inline-flex items-center gap-2 font-semibold">
              <Users className="h-5 w-5" /> Local users
            </h3>
            <BusyButton
              className="app-btn-secondary"
              busy={busy === `${localUsers.id}:assess:`}
              busyLabel="Loading…"
              onClick={() => {
                void run(localUsers);
              }}
            >
              Get
            </BusyButton>
          </div>
          <table className="w-full text-left text-sm">
            <tbody>
              {users.map((user) => (
                <tr key={user.name} className="border-b border-health-border">
                  <td className="py-1 pr-3">{user.name}</td>
                  <td className="py-1">
                    {user.enabled ? 'Enabled' : 'Disabled'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {loggedIn ? (
        <section className="app-card">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="inline-flex items-center gap-2 font-semibold">
              <User className="h-5 w-5" /> Currently logged in
            </h3>
            <BusyButton
              className="app-btn-secondary"
              busy={busy === `${loggedIn.id}:assess:`}
              busyLabel="Loading…"
              onClick={() => {
                void run(loggedIn);
              }}
            >
              Get
            </BusyButton>
          </div>
          {sessions.length === 0 ? (
            <p className="text-sm text-health-subtle">No interactive logon.</p>
          ) : (
            <ul className="text-sm">
              {sessions.map((session) => (
                <li key={`${session.name}-${session.session}`}>
                  {session.name}
                  {session.session ? ` (${session.session})` : ''}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {dc ? (
        <section className="app-card">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="inline-flex items-center gap-2 font-semibold">
              <Globe className="h-5 w-5" /> Domain controller
            </h3>
            <BusyButton
              className="app-btn-secondary"
              busy={busy === `${dc.id}:assess:`}
              busyLabel="Loading…"
              onClick={() => {
                void run(dc);
              }}
            >
              Get
            </BusyButton>
          </div>
          <p className="text-sm">
            Domain: {String(dcData.domain ?? '—')}
            <br />
            Logon server: {String(dcData.logonServer ?? '—')}
            <br />
            DC: {String(dcData.dcName ?? '—')} {String(dcData.dcAddress ?? '')}
          </p>
        </section>
      ) : null}

      <section className="app-card">
        <h3 className="mb-2 font-semibold">Custom modules</h3>
        {customModules.map((module) => (
          <div key={module.id} className="mb-2 flex gap-2">
            <BusyButton
              className="app-btn-secondary"
              busy={busy === `${module.id}:assess:`}
              busyLabel="Running…"
              onClick={() => {
                void run(module);
              }}
            >
              {module.name}
            </BusyButton>
            <button
              type="button"
              className="text-health-danger text-sm"
              onClick={() => {
                void window.netxscan.deleteAssessModule(module.id).then(() => load());
              }}
            >
              Delete
            </button>
          </div>
        ))}
        <label className="grid gap-1 text-sm">
          Name
          <input
            value={customName}
            onChange={(event) => setCustomName(event.target.value)}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Assess script (JSON stdout)
          <textarea
            className="min-h-24"
            value={customAssess}
            onChange={(event) => setCustomAssess(event.target.value)}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Remediation script
          <textarea
            className="min-h-16"
            value={customRemediate}
            onChange={(event) => setCustomRemediate(event.target.value)}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Reverse script
          <textarea
            className="min-h-16"
            value={customReverse}
            onChange={(event) => setCustomReverse(event.target.value)}
          />
        </label>
        <BusyButton
          className="app-btn-primary mt-2"
          busy={false}
          busyLabel="Saving…"
          onClick={() => {
            void saveCustom();
          }}
        >
          Save module
        </BusyButton>
      </section>

      <section className="app-card overflow-x-auto">
        <h3 className="mb-2 inline-flex items-center gap-2 font-semibold">
          <History className="h-5 w-5" /> Baseline history
        </h3>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-health-subtle">
              <th className="py-1 pr-3">When</th>
              <th className="py-1 pr-3">Kind</th>
              <th className="py-1 pr-3">Module</th>
              <th className="py-1 pr-3">Result</th>
              <th className="py-1">Reverse</th>
            </tr>
          </thead>
          <tbody>
            {history
              .slice((historyPage - 1) * 25, historyPage * 25)
              .map((row) => (
              <tr key={row.id} className="border-b border-health-border">
                <td className="py-1 pr-3">{row.createdAt}</td>
                <td className="py-1 pr-3">{row.kind}</td>
                <td className="py-1 pr-3">{row.moduleName}</td>
                <td className="py-1 pr-3">
                  {row.positive ? 'PASS' : 'FAIL'} · {row.summary}
                </td>
                <td className="py-1">
                  {row.kind === 'remediate' &&
                  modules.find((item) => item.id === row.moduleId)
                    ?.reverseScript ? (
                    <BusyButton
                      className="text-health-accent"
                      busy={busy === `reverse:${row.id}`}
                      busyLabel="Reversing…"
                      onClick={() => {
                        void onReverse(row);
                      }}
                    >
                      Reverse
                    </BusyButton>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <button
            type="button"
            className="app-btn-secondary"
            disabled={historyPage <= 1}
            onClick={() => setHistoryPage((page) => Math.max(1, page - 1))}
          >
            Previous
          </button>
          <span className="text-health-subtle">
            Page {historyPage} of {Math.max(1, Math.ceil(history.length / 25))}{' '}
            ({history.length} entries)
          </span>
          <button
            type="button"
            className="app-btn-secondary"
            disabled={historyPage >= Math.max(1, Math.ceil(history.length / 25))}
            onClick={() =>
              setHistoryPage((page) =>
                Math.min(Math.max(1, Math.ceil(history.length / 25)), page + 1),
              )
            }
          >
            Next
          </button>
        </div>
      </section>
    </div>
  );
}
