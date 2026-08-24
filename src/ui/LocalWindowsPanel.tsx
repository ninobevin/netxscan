import { useState } from 'react';
import type { WindowsAssessment } from '../shared/windows-types';
import { BusyButton } from './BusyButton';
import { WindowsFactsView } from './WindowsFactsView';

function errorText(error: string): string {
  if (error === 'forbidden') {
    return 'Only administrators can collect local Windows facts.';
  }

  if (error === 'not_authorized_range') {
    return 'This computer has no IPv4 address inside authorized-networks.json.';
  }

  if (error === 'powershell_failed') {
    return 'PowerShell collection failed. Some items need a local administrator token.';
  }

  if (error === 'timeout') {
    return 'PowerShell collection timed out.';
  }

  if (error === 'scan_in_progress') {
    return 'Another scan or collection is already running.';
  }

  return 'Local Windows collection could not be completed.';
}

type LocalWindowsPanelProps = {
  canRun: boolean;
  onInventoryChanged: () => void;
};

export function LocalWindowsPanel({
  canRun,
  onInventoryChanged,
}: LocalWindowsPanelProps) {
  const [assessment, setAssessment] = useState<WindowsAssessment | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onRun = async () => {
    setBusy(true);
    setMessage(null);
    const result = await window.netxscan.runLocalWindowsAssessment();
    setBusy(false);

    if (!result.ok) {
      setMessage(errorText(result.error));
      return;
    }

    setAssessment(result.assessment);
    onInventoryChanged();
  };

  return (
    <section className="app-card">
      <h2 className="text-lg font-semibold">This computer</h2>
      <p className="text-sm text-health-subtle">
        Runs a fixed PowerShell script on this PC only. The renderer cannot
        enter commands. This computer must have an address in
        authorized-networks.json.
      </p>
      {canRun ? (
        <BusyButton
          className="app-btn-primary w-fit"
          busy={busy}
          busyLabel="Collecting…"
          onClick={() => {
            void onRun();
          }}
        >
          Collect local Windows facts
        </BusyButton>
      ) : (
        <p className="text-sm text-health-subtle">
          Sign in as administrator to run this collection.
        </p>
      )}
      {message ? <p className="text-sm text-health-danger">{message}</p> : null}
      {assessment ? (
        <WindowsFactsView
          assessment={assessment}
          canUninstall={canRun}
          mode="local"
          onUpdated={setAssessment}
        />
      ) : null}
    </section>
  );
}
