import { useEffect, useState } from 'react';
import type { CorrelationRun } from '../shared/correlation-types';
import { BusyButton } from './BusyButton';

function errorText(error: string): string {
  if (error === 'forbidden') {
    return 'Only administrators can run correlation.';
  }

  if (error === 'database_unavailable') {
    return 'The database is not available.';
  }

  return 'Correlation could not be completed.';
}

type CorrelationPanelProps = {
  canRun: boolean;
};

export function CorrelationPanel({ canRun }: CorrelationPanelProps) {
  const [run, setRun] = useState<CorrelationRun | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const result = await window.netxscan.getLatestCorrelation();
    if (!result.ok) {
      setMessage(errorText(result.error));
      return;
    }

    setRun(result.run);
  };

  useEffect(() => {
    void load();
  }, []);

  const onRun = async () => {
    setBusy(true);
    setMessage(null);
    const result = await window.netxscan.runCorrelation();
    setBusy(false);

    if (!result.ok) {
      setMessage(errorText(result.error));
      return;
    }

    setRun(result.run);
    setMessage(
      `Matched ${result.run.matchCount} catalog CVE(s) to collected facts. Matching findings were created or updated.`,
    );
  };

  return (
    <section className="app-card">
      <h2 className="text-lg font-semibold">Correlation</h2>
      <p className="text-sm text-health-subtle">
        Module 13 compares the CVE catalog with TLS/SMB facts, identified
        service products that include a version, and Windows software names. An
        open port or a service name such as https is not enough. Matching
        records are written to Findings for status and notes.
      </p>
      {canRun ? (
        <BusyButton
          className="app-btn-primary w-fit"
          busy={busy}
          busyLabel="Matching…"
          onClick={() => {
            void onRun();
          }}
        >
          Run correlation
        </BusyButton>
      ) : (
        <p className="text-sm text-health-subtle">
          Sign in as administrator to run correlation. You can still view the
          last run.
        </p>
      )}
      {message ? (
        <p
          className={
            message.startsWith('Matched')
              ? 'text-sm text-health-accent'
              : 'text-sm text-health-danger'
          }
        >
          {message}
        </p>
      ) : null}
      {!run ? (
        <p className="text-sm text-health-subtle">
          No correlation run stored yet. Load the CVE catalog and collect
          TLS/SMB or Windows facts first.
        </p>
      ) : (
        <>
          <p className="text-sm text-health-subtle">
            Last run {run.createdAt} · {run.matchCount} match(es)
          </p>
          {run.matches.length === 0 ? (
            <p className="text-sm text-health-subtle">
              No catalog CVE had enough evidence on current assets.
            </p>
          ) : (
            <div className="max-h-[32rem] overflow-auto rounded-lg border border-health-border">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-health-muted text-health-subtle">
                  <tr>
                    <th className="px-3 py-2 font-medium">Asset</th>
                    <th className="px-3 py-2 font-medium">CVE</th>
                    <th className="px-3 py-2 font-medium">Severity</th>
                    <th className="px-3 py-2 font-medium">Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {run.matches.map((item) => (
                    <tr
                      key={item.id}
                      className="border-t border-health-border align-top"
                    >
                      <td className="px-3 py-2">
                        <p className="font-medium">{item.hostname}</p>
                        <p className="text-health-subtle">
                          {item.ipAddress ?? 'no IP'}
                        </p>
                      </td>
                      <td className="px-3 py-2">
                        <p className="font-medium">{item.cveId}</p>
                        <p className="text-health-subtle">{item.title}</p>
                      </td>
                      <td className="px-3 py-2">{item.severity}</td>
                      <td className="px-3 py-2">
                        <p>{item.evidence}</p>
                        <p className="mt-1 text-health-subtle">
                          {item.recommendation}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
