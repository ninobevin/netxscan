import { FormEvent, useEffect, useState } from 'react';
import type { CveRecord, CveCatalogStatus } from '../shared/cve-types';
import { BusyButton } from './BusyButton';

function errorText(error: string): string {
  if (error === 'forbidden') {
    return 'Only administrators can import or update the CVE catalog.';
  }

  if (error === 'cancelled') {
    return 'File import was cancelled.';
  }

  if (error === 'network_unavailable') {
    return 'Online update is not available. Load the test dataset or import a JSON file.';
  }

  if (error === 'invalid_input') {
    return 'That JSON file is not a valid CVE catalog (id, title, description, severity).';
  }

  if (error === 'database_unavailable') {
    return 'The database is not available.';
  }

  return 'The CVE catalog could not be updated.';
}

function sourceLabel(source: string): string {
  if (source === 'test') {
    return 'test dataset';
  }

  if (source === 'online') {
    return 'online';
  }

  return 'file';
}

type CveCatalogProps = {
  canImport: boolean;
};

export function CveCatalog({ canImport }: CveCatalogProps) {
  const [cves, setCves] = useState<CveRecord[]>([]);
  const [status, setStatus] = useState<CveCatalogStatus | null>(null);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<
    'test' | 'file' | 'online' | null
  >(null);

  const load = async (search = query) => {
    const result = await window.netxscan.listCves(search);
    if (!result.ok) {
      setMessage(errorText(result.error));
      return;
    }

    setCves(result.cves);
    setStatus(result.status);
  };

  useEffect(() => {
    void load('');
  }, []);

  const onSearch = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    await load(query);
  };

  const runImport = async (
    action: 'test' | 'file' | 'online',
    run: () => Promise<Awaited<ReturnType<typeof window.netxscan.importCveTestDataset>>>,
  ) => {
    setBusyAction(action);
    setMessage(null);
    const result = await run();
    setBusyAction(null);

    if (!result.ok) {
      setMessage(errorText(result.error));
      return;
    }

    setStatus(result.status);
    setMessage(`Imported ${result.imported} CVE record(s). This is a catalog, not a finding.`);
    await load(query);
  };

  return (
    <section className="app-card">
      <h2 className="text-lg font-semibold">CVE catalog</h2>
      <p className="text-sm text-health-subtle">
        Module 12 stores CVE records only. Use Correlation to match this catalog
        to collected facts. Start with the built-in test dataset, import a JSON
        file while offline, or refresh a small allowlisted set from the internet
        when the clinic is online.
      </p>
      {status ? (
        <p className="text-sm text-health-subtle">
          {status.count} record(s)
          {status.lastImportedAt
            ? ` · last import ${status.lastImportedAt} (${sourceLabel(status.lastSource ?? '')})`
            : ''}
        </p>
      ) : null}
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
            placeholder="CVE-2021-44228"
          />
        </label>
        <button
          type="submit"
          className="app-btn-secondary"
          disabled={busyAction !== null}
        >
          Search
        </button>
      </form>
      {canImport ? (
        <div className="flex flex-wrap gap-2">
          <BusyButton
            className="app-btn-primary"
            disabled={busyAction !== null && busyAction !== 'test'}
            busy={busyAction === 'test'}
            busyLabel="Loading dataset…"
            onClick={() => {
              void runImport('test', () => window.netxscan.importCveTestDataset());
            }}
          >
            Load test dataset
          </BusyButton>
          <BusyButton
            className="app-btn-secondary"
            disabled={busyAction !== null && busyAction !== 'file'}
            busy={busyAction === 'file'}
            busyLabel="Importing…"
            onClick={() => {
              void runImport('file', () => window.netxscan.importCveFile());
            }}
          >
            Import JSON file
          </BusyButton>
          <BusyButton
            className="app-btn-secondary"
            disabled={busyAction !== null && busyAction !== 'online'}
            busy={busyAction === 'online'}
            busyLabel="Updating…"
            onClick={() => {
              void runImport('online', () => window.netxscan.updateCvesOnline());
            }}
          >
            Update from internet
          </BusyButton>
        </div>
      ) : (
        <p className="text-sm text-health-subtle">
          Sign in as administrator to import or update the catalog.
        </p>
      )}
      {message ? (
        <p
          className={
            message.startsWith('Imported')
              ? 'text-sm text-health-accent'
              : 'text-sm text-health-danger'
          }
        >
          {message}
        </p>
      ) : null}
      {cves.length === 0 ? (
        <p className="text-sm text-health-subtle">No CVE records stored yet.</p>
      ) : (
        <div className="max-h-[32rem] overflow-auto rounded-lg border border-health-border">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-health-muted text-health-subtle">
              <tr>
                <th className="px-3 py-2 font-medium">CVE</th>
                <th className="px-3 py-2 font-medium">Severity</th>
                <th className="px-3 py-2 font-medium">Title</th>
                <th className="px-3 py-2 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {cves.map((item) => (
                <tr key={item.id} className="border-t border-health-border align-top">
                  <td className="px-3 py-2 font-medium">{item.id}</td>
                  <td className="px-3 py-2">{item.severity}</td>
                  <td className="px-3 py-2">
                    <p>{item.title}</p>
                    <p className="text-health-subtle">{item.description}</p>
                  </td>
                  <td className="px-3 py-2 text-health-subtle">
                    {sourceLabel(item.source)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
