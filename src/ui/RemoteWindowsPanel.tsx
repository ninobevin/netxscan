import { useEffect, useState } from 'react';
import type { Asset } from '../shared/asset-types';
import type { StoredCredential } from '../shared/credential-types';
import type { WindowsAssessment } from '../shared/windows-types';
import { BusyButton } from './BusyButton';
import { WindowsFactsView } from './WindowsFactsView';

function errorText(error: string): string {
  if (error === 'forbidden') {
    return 'Only administrators can collect remote Windows facts.';
  }

  if (error === 'not_authorized_range') {
    return 'That asset IP is outside authorized-networks.json.';
  }

  if (error === 'winrm_failed') {
    return 'WinRM did not return facts. Check remoting, the selected credential, and authorized ranges.';
  }

  if (error === 'credential_missing') {
    return 'The selected credential is not in Windows Credential Manager.';
  }

  if (error === 'timeout') {
    return 'Remote collection timed out.';
  }

  if (error === 'scan_in_progress') {
    return 'Another scan or collection is already running.';
  }

  if (error === 'not_found') {
    return 'That asset was not found.';
  }

  return 'Remote Windows collection could not be completed.';
}

type RemoteWindowsPanelProps = {
  canRun: boolean;
  refreshKey: number;
};

export function RemoteWindowsPanel({
  canRun,
  refreshKey,
}: RemoteWindowsPanelProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [credentials, setCredentials] = useState<StoredCredential[]>([]);
  const [assetId, setAssetId] = useState('');
  const [credentialId, setCredentialId] = useState('');
  const [assessment, setAssessment] = useState<WindowsAssessment | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const hosts = assets.filter((asset) => asset.ipAddress);

  useEffect(() => {
    void window.netxscan.listAssets(false).then((result) => {
      if (result.ok) {
        setAssets(result.assets);
      }
    });
  }, [refreshKey]);

  useEffect(() => {
    if (!canRun) {
      return;
    }

    void window.netxscan.listCredentials().then((result) => {
      if (result.ok) {
        setCredentials(result.credentials);
      }
    });
  }, [canRun, refreshKey]);

  useEffect(() => {
    if (!assetId) {
      setAssessment(null);
      return;
    }

    void window.netxscan.getLatestWindowsAssessment(assetId).then((result) => {
      if (result.ok) {
        setAssessment(result.assessment);
        return;
      }

      setAssessment(null);
    });
  }, [assetId]);

  const onRun = async () => {
    if (!assetId) {
      setMessage('Select an inventory host with an IPv4 address.');
      return;
    }

    setBusy(true);
    setMessage(null);
    const result = await window.netxscan.runRemoteWindowsAssessment(
      assetId,
      credentialId || undefined,
    );
    setBusy(false);

    if (!result.ok) {
      setMessage(errorText(result.error));
      return;
    }

    setAssessment(result.assessment);
  };

  return (
    <section className="app-card">
      <h2 className="text-lg font-semibold">Remote host (WinRM)</h2>
      <p className="text-sm text-health-subtle">
        Uses the same fixed script over WinRM against an inventory IPv4 address
        inside authorized ranges. Leave credential empty to use the Windows
        account that started this app, or pick a Credential Manager entry.
        Passwords never go to MySQL.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid min-w-64 flex-1 gap-1 text-sm">
          <span className="font-medium text-health-subtle">Inventory host</span>
          <select
            value={assetId}
            disabled={!canRun || busy}
            onChange={(event) => {
              setAssetId(event.target.value);
              setMessage(null);
            }}
          >
            <option value="">Select a host</option>
            {hosts.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.hostname} ({asset.ipAddress})
              </option>
            ))}
          </select>
        </label>
        <label className="grid min-w-64 flex-1 gap-1 text-sm">
          <span className="font-medium text-health-subtle">Credential</span>
          <select
            value={credentialId}
            disabled={!canRun || busy}
            onChange={(event) => setCredentialId(event.target.value)}
          >
            <option value="">Current Windows account</option>
            {credentials.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label} ({item.username})
              </option>
            ))}
          </select>
        </label>
        {canRun ? (
          <BusyButton
            className="app-btn-primary w-fit"
            disabled={!assetId}
            busy={busy}
            busyLabel="Collecting…"
            onClick={() => {
              void onRun();
            }}
          >
            Collect remote Windows facts
          </BusyButton>
        ) : (
          <p className="text-sm text-health-subtle">
            Sign in as administrator to run this collection.
          </p>
        )}
      </div>
      {message ? <p className="text-sm text-health-danger">{message}</p> : null}
      {assessment ? (
        <WindowsFactsView
          assessment={assessment}
          canUninstall={canRun}
          mode="remote"
          credentialId={credentialId || undefined}
          onUpdated={setAssessment}
        />
      ) : null}
    </section>
  );
}
