import { FormEvent, useEffect, useState } from 'react';
import type { AuditEntry } from '../shared/audit-types';

function errorText(error: string): string {
  if (error === 'database_unavailable') {
    return 'The database is not available.';
  }

  return 'The audit trail could not be loaded.';
}

function actionLabel(action: string): string {
  return action.replace(/_/g, ' ');
}

export function AuditPanel() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const load = async (search = query) => {
    const result = await window.netxscan.listAudit(search);
    if (!result.ok) {
      setMessage(errorText(result.error));
      return;
    }

    setEntries(result.entries);
  };

  useEffect(() => {
    void load('');
  }, []);

  const onSearch = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    await load(query);
  };

  return (
    <section className="app-card">
      <h2 className="text-lg font-semibold">Audit trail</h2>
      <p className="text-sm text-health-subtle">
        Module 16 records important actions such as sign-in, scans, and
        assessments. Passwords are never stored in this log.
      </p>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          void onSearch(event);
        }}
      >
        <label className="grid min-w-56 flex-1 gap-1 text-sm">
          <span className="font-medium text-health-subtle">Search</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="login, scan, hostname"
          />
        </label>
        <button type="submit" className="app-btn-secondary">
          Search
        </button>
      </form>
      {message ? <p className="text-sm text-health-danger">{message}</p> : null}
      {entries.length === 0 ? (
        <p className="text-sm text-health-subtle">No audit entries yet.</p>
      ) : (
        <div className="max-h-[32rem] overflow-auto rounded-lg border border-health-border">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-health-muted text-health-subtle">
              <tr>
                <th className="px-3 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">User</th>
                <th className="px-3 py-2 font-medium">Action</th>
                <th className="px-3 py-2 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((item) => (
                <tr key={item.id} className="border-t border-health-border align-top">
                  <td className="px-3 py-2 text-health-subtle">{item.createdAt}</td>
                  <td className="px-3 py-2">{item.username}</td>
                  <td className="px-3 py-2 font-medium">{actionLabel(item.action)}</td>
                  <td className="px-3 py-2">{item.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
