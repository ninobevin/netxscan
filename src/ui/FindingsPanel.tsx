import { FormEvent, useEffect, useState } from 'react';
import {
  FINDING_STATUSES,
  type Finding,
  type FindingStatus,
} from '../shared/finding-types';
import { BusyButton } from './BusyButton';

function errorText(error: string): string {
  if (error === 'forbidden') {
    return 'Only administrators can create findings from correlation.';
  }

  if (error === 'not_found') {
    return 'That finding was not found.';
  }

  if (error === 'invalid_input') {
    return 'Choose a valid status. Notes can be up to 2,000 characters.';
  }

  if (error === 'database_unavailable') {
    return 'The database is not available.';
  }

  return 'Findings could not be updated.';
}

function statusLabel(status: FindingStatus): string {
  if (status === 'in_progress') {
    return 'In progress';
  }

  if (status === 'accepted_risk') {
    return 'Accepted risk';
  }

  if (status === 'false_positive') {
    return 'False positive';
  }

  return status.charAt(0).toUpperCase() + status.slice(1);
}

type FindingsPanelProps = {
  canCreate: boolean;
};

export function FindingsPanel({ canCreate }: FindingsPanelProps) {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [filter, setFilter] = useState<FindingStatus | 'all'>('all');
  const [drafts, setDrafts] = useState<
    Record<string, { status: FindingStatus; notes: string }>
  >({});
  const [message, setMessage] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const load = async (status = filter) => {
    const result = await window.netxscan.listFindings(status);
    if (!result.ok) {
      setMessage(errorText(result.error));
      return;
    }

    setFindings(result.findings);
    setDrafts(
      Object.fromEntries(
        result.findings.map((item) => [
          item.id,
          { status: item.status, notes: item.notes },
        ]),
      ),
    );
  };

  useEffect(() => {
    void load('all');
  }, []);

  const onFilter = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    await load(filter);
  };

  const onSync = async () => {
    setBusyAction('sync');
    setMessage(null);
    const result = await window.netxscan.syncFindings();
    setBusyAction(null);

    if (!result.ok) {
      setMessage(errorText(result.error));
      return;
    }

    setFindings(result.findings);
    setFilter('all');
    setDrafts(
      Object.fromEntries(
        result.findings.map((item) => [
          item.id,
          { status: item.status, notes: item.notes },
        ]),
      ),
    );
    setMessage(
      `Created ${result.created} and updated ${result.updated} finding(s) from the last correlation run.`,
    );
  };

  const onSave = async (id: string) => {
    const draft = drafts[id];
    if (!draft) {
      return;
    }

    setBusyAction(id);
    setMessage(null);
    const result = await window.netxscan.updateFinding(
      id,
      draft.status,
      draft.notes,
    );
    setBusyAction(null);

    if (!result.ok) {
      setMessage(errorText(result.error));
      return;
    }

    setFindings((current) =>
      current.map((item) => (item.id === id ? result.finding : item)),
    );
    setDrafts((current) => ({
      ...current,
      [id]: { status: result.finding.status, notes: result.finding.notes },
    }));
  };

  return (
    <section className="app-card">
      <h2 className="text-lg font-semibold">Findings</h2>
      <p className="text-sm text-health-subtle">
        Correlation matches and service assessments both land here. Assessment
        rows use ids such as NX-SMBV1 and NIST-colored severity. An open port
        is still not a CVE. Administrators can also refresh records from the
        last correlation run. Administrators and IT support update status and
        notes. Resolved findings that match again are reopened. Accepted risk
        and false positive stay closed.
      </p>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          void onFilter(event);
        }}
      >
        <label className="grid min-w-48 gap-1 text-sm">
          <span className="font-medium text-health-subtle">Status</span>
          <select
            value={filter}
            onChange={(event) =>
              setFilter(event.target.value as FindingStatus | 'all')
            }
          >
            <option value="all">All</option>
            {FINDING_STATUSES.map((status) => (
              <option key={status} value={status}>
                {statusLabel(status)}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="app-btn-secondary">
          Filter
        </button>
        {canCreate ? (
          <BusyButton
            className="app-btn-primary"
            busy={busyAction === 'sync'}
            busyLabel="Creating findings…"
            onClick={() => {
              void onSync();
            }}
          >
            Create from last correlation
          </BusyButton>
        ) : (
          <p className="text-sm text-health-subtle">
            Sign in as administrator to create findings from correlation.
          </p>
        )}
      </form>
      {message ? (
        <p
          className={
            message.startsWith('Created')
              ? 'text-sm text-health-accent'
              : 'text-sm text-health-danger'
          }
        >
          {message}
        </p>
      ) : null}
      {findings.length === 0 ? (
        <p className="text-sm text-health-subtle">
          No findings yet. Run correlation, then create findings from that run.
        </p>
      ) : (
        <div className="max-h-[40rem] overflow-auto rounded-lg border border-health-border">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-health-muted text-health-subtle">
              <tr>
                <th className="px-3 py-2 font-medium">Asset</th>
                <th className="px-3 py-2 font-medium">Finding</th>
                <th className="px-3 py-2 font-medium">Detected</th>
                <th className="px-3 py-2 font-medium">Status and notes</th>
              </tr>
            </thead>
            <tbody>
              {findings.map((item) => {
                const draft = drafts[item.id] ?? {
                  status: item.status,
                  notes: item.notes,
                };
                return (
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
                      <p className="font-medium">{item.title}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-2">
                        <span
                          className={
                            item.severity === 'critical'
                              ? 'rounded px-2 py-0.5 text-xs font-semibold uppercase text-white bg-health-nist-critical'
                              : item.severity === 'high'
                                ? 'rounded px-2 py-0.5 text-xs font-semibold uppercase text-white bg-health-nist-high'
                                : item.severity === 'medium'
                                  ? 'rounded px-2 py-0.5 text-xs font-semibold uppercase text-health-text bg-health-nist-moderate'
                                  : item.severity === 'low'
                                    ? 'rounded px-2 py-0.5 text-xs font-semibold uppercase text-white bg-health-nist-low'
                                    : 'rounded px-2 py-0.5 text-xs font-semibold uppercase text-white bg-health-nist-info'
                          }
                        >
                          {item.severity === 'medium' ? 'moderate' : item.severity}
                        </span>
                        <span className="text-health-subtle">
                          {item.cveId} · {item.source}
                        </span>
                      </p>
                      <p className="mt-1">{item.evidence}</p>
                      <p className="mt-1 text-health-subtle">
                        {item.recommendation}
                      </p>
                    </td>
                    <td className="px-3 py-2 text-health-subtle">
                      <p>First {item.firstDetected}</p>
                      <p>Last {item.lastDetected}</p>
                      {item.resolvedAt ? <p>Resolved {item.resolvedAt}</p> : null}
                    </td>
                    <td className="px-3 py-2">
                      <label className="grid gap-1">
                        <span className="text-health-subtle">Status</span>
                        <select
                          value={draft.status}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [item.id]: {
                                ...draft,
                                status: event.target.value as FindingStatus,
                              },
                            }))
                          }
                        >
                          {FINDING_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {statusLabel(status)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="mt-2 grid gap-1">
                        <span className="text-health-subtle">Notes</span>
                        <textarea
                          className="min-h-16"
                          value={draft.notes}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [item.id]: {
                                ...draft,
                                notes: event.target.value,
                              },
                            }))
                          }
                        />
                      </label>
                      <BusyButton
                        className="app-btn-secondary mt-2"
                        busy={busyAction === item.id}
                        busyLabel="Saving…"
                        onClick={() => {
                          void onSave(item.id);
                        }}
                      >
                        Save
                      </BusyButton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
