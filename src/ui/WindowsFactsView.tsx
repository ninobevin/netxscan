import { useState } from 'react';
import type { WindowsAssessment } from '../shared/windows-types';
import { BusyButton } from './BusyButton';

function uninstallErrorText(error: string, detail?: string): string {
  if (error === 'forbidden') {
    return 'Only administrators can uninstall software.';
  }

  if (error === 'not_found') {
    return 'Collect facts again, then uninstall from the updated list.';
  }

  if (error === 'credential_missing') {
    return 'That Credential Manager entry was not found. Save it again on the Credentials page.';
  }

  if (error === 'uninstall_failed') {
    const code = detail ? ` Windows exit code ${detail}.` : '';
    return `Silent uninstall did not succeed.${code} Start NetXScan from an Administrator terminal and try again.`;
  }

  if (error === 'uninstall_unsupported') {
    return 'That package has no quiet uninstall command. Remove it from Settings → Apps.';
  }

  if (error === 'scan_in_progress') {
    return 'Another scan or collection is already running.';
  }

  if (error === 'timeout') {
    return 'Uninstall timed out.';
  }

  return 'The uninstall could not be completed.';
}

type WindowsFactsViewProps = {
  assessment: WindowsAssessment;
  canUninstall?: boolean;
  mode?: 'local' | 'remote';
  credentialId?: string;
  onUpdated?: (assessment: WindowsAssessment) => void;
};

export function WindowsFactsView({
  assessment,
  canUninstall = false,
  mode = 'local',
  credentialId,
  onUpdated,
}: WindowsFactsViewProps) {
  const facts = assessment.facts;
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const onUninstall = async (key: string, name: string) => {
    const confirmed = window.confirm(
      mode === 'remote'
        ? `Silently uninstall “${name}” from the remote host? This cannot be undone from NetXScan.`
        : `Silently uninstall “${name}” from this computer? Start NetXScan as administrator first. This cannot be undone from NetXScan.`,
    );

    if (!confirmed) {
      return;
    }

    setBusyKey(key);
    setMessage(null);
    const result = await window.netxscan.uninstallWindowsSoftware(
      assessment.assetId,
      key,
      mode,
      credentialId,
    );
    setBusyKey(null);

    if (!result.ok) {
      setMessage(uninstallErrorText(result.error, result.detail));
      return;
    }

    onUpdated?.(result.assessment);
  };

  return (
    <div className="grid gap-6">
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-health-subtle">Hostname</dt>
          <dd>{facts.hostname ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-health-subtle">Addresses</dt>
          <dd>{facts.ipAddresses.join(', ') || '—'}</dd>
        </div>
        <div>
          <dt className="text-health-subtle">Operating system</dt>
          <dd>{facts.operatingSystem ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-health-subtle">Version</dt>
          <dd>{facts.osVersion ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-health-subtle">Domain</dt>
          <dd>{facts.domain ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-health-subtle">CPU</dt>
          <dd>{facts.cpu ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-health-subtle">RAM</dt>
          <dd>{facts.ramGb != null ? `${facts.ramGb} GB` : '—'}</dd>
        </div>
        <div>
          <dt className="text-health-subtle">Defender</dt>
          <dd>
            enabled={String(facts.defenderEnabled)} realtime=
            {String(facts.defenderRealtime)}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-health-subtle">Firewall</dt>
          <dd>
            {facts.firewall
              .map(
                (profile) =>
                  `${profile.name}=${profile.enabled ? 'on' : 'off'}`,
              )
              .join(', ') || '—'}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-health-subtle">Disks</dt>
          <dd>
            {facts.disks
              .map((disk) => `${disk.device} ${disk.sizeGb ?? '?'} GB`)
              .join(', ') || '—'}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-health-subtle">BitLocker</dt>
          <dd>
            {facts.bitlocker
              .map(
                (volume) =>
                  `${volume.mountPoint} ${volume.protection ?? ''}`.trim(),
              )
              .join(', ') || '—'}
          </dd>
        </div>
      </dl>

      <div>
        <h3 className="mb-2 text-sm font-medium">
          Installed software ({facts.software.length})
        </h3>
        <p className="mb-3 text-sm text-health-subtle">
          Machine-wide Uninstall registry entries, sorted by name. Store apps
          and per-user installs are not included. Uninstall is silent (no vendor
          dialog). MSI uses msiexec /qn; other apps use QuietUninstallString.
          Run NetXScan from an Administrator terminal.
        </p>
        {message ? <p className="mb-3 text-sm text-health-danger">{message}</p> : null}
        {facts.software.length === 0 ? (
          <p className="text-sm text-health-subtle">No software names returned.</p>
        ) : (
          <div className="max-h-[32rem] overflow-auto rounded-lg border border-health-border">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-health-muted text-health-subtle">
                <tr>
                  <th className="px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Version</th>
                  <th className="px-3 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {facts.software.map((item, index) => (
                  <tr
                    key={`${item.key ?? item.name}-${index}`}
                    className="border-t border-health-border"
                  >
                    <td className="px-3 py-2 text-health-subtle">{index + 1}</td>
                    <td className="px-3 py-2">{item.name}</td>
                    <td className="px-3 py-2 text-health-subtle">
                      {item.version ?? '—'}
                    </td>
                    <td className="px-3 py-2">
                      {canUninstall && item.key && item.canUninstall ? (
                        <BusyButton
                          className="text-health-danger"
                          disabled={busyKey !== null && busyKey !== item.key}
                          busy={busyKey === item.key}
                          busyLabel="Uninstalling…"
                          onClick={() => {
                            void onUninstall(item.key as string, item.name);
                          }}
                        >
                          Uninstall
                        </BusyButton>
                      ) : (
                        <span className="text-health-subtle">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium">Hotfixes (sample)</h3>
        {facts.updates.length === 0 ? (
          <p className="text-sm text-health-subtle">No hotfixes returned.</p>
        ) : (
          <ul className="max-h-40 list-disc overflow-auto pl-5 text-sm">
            {facts.updates.map((update, index) => (
              <li key={`${update.id}-${index}`}>
                {update.id}
                {update.installedOn ? ` (${update.installedOn})` : ''}
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-sm text-health-subtle">{assessment.notes}</p>
    </div>
  );
}
