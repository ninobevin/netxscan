import { useState } from 'react';
import type { ReportKind } from '../shared/report-types';
import { BusyButton } from './BusyButton';

const KINDS: Array<{ id: ReportKind; title: string; summary: string }> = [
  {
    id: 'assets',
    title: 'Asset inventory',
    summary: 'Active hosts, addresses, types, and discovered services.',
  },
  {
    id: 'findings',
    title: 'Vulnerability findings',
    summary: 'Catalog matches with evidence, severity, and status.',
  },
  {
    id: 'assessments',
    title: 'Security assessments',
    summary: 'Latest TLS/SMB facts and Windows collection summary per asset.',
  },
  {
    id: 'scans',
    title: 'Scan history',
    summary: 'Authorized ping and discovery runs stored on this PC.',
  },
  {
    id: 'remediation',
    title: 'Remediation status',
    summary: 'Finding counts by Open, In progress, Resolved, and related statuses.',
  },
  {
    id: 'audit',
    title: 'Audit activity',
    summary: 'Important application actions. Passwords are not included.',
  },
];

function errorText(error: string): string {
  if (error === 'cancelled') {
    return 'Save was cancelled.';
  }

  if (error === 'database_unavailable') {
    return 'The database is not available.';
  }

  return 'The report could not be created.';
}

export function ReportsPanel() {
  const [preview, setPreview] = useState<{ title: string; html: string } | null>(
    null,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [busyKind, setBusyKind] = useState<string | null>(null);

  const onPreview = async (kind: ReportKind) => {
    setBusyKind(`preview-${kind}`);
    setMessage(null);
    const result = await window.netxscan.previewReport(kind);
    setBusyKind(null);

    if (!result.ok) {
      setMessage(errorText(result.error));
      return;
    }

    setPreview({ title: result.title, html: result.html });
  };

  const onExport = async (kind: ReportKind) => {
    setBusyKind(`export-${kind}`);
    setMessage(null);
    const result = await window.netxscan.exportReport(kind);
    setBusyKind(null);

    if (!result.ok) {
      setMessage(errorText(result.error));
      return;
    }

    setMessage(`Saved ${result.path}`);
  };

  return (
    <div className="grid gap-6">
      <section className="app-card">
        <h2 className="text-lg font-semibold">Reports</h2>
        <p className="text-sm text-health-subtle">
          Module 17 builds HTML reports for IT management and technical audit
          preparation. Preview in the app or save a file. Reports do not include
          passwords or Credential Manager secrets.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          {KINDS.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-3 rounded-xl border border-health-border p-4"
            >
              <div>
                <h3 className="font-medium">{item.title}</h3>
                <p className="text-sm text-health-subtle">{item.summary}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <BusyButton
                  className="app-btn-secondary"
                  busy={busyKind === `preview-${item.id}`}
                  busyLabel="Building…"
                  onClick={() => {
                    void onPreview(item.id);
                  }}
                >
                  Preview
                </BusyButton>
                <BusyButton
                  className="app-btn-primary"
                  busy={busyKind === `export-${item.id}`}
                  busyLabel="Saving…"
                  onClick={() => {
                    void onExport(item.id);
                  }}
                >
                  Save HTML
                </BusyButton>
              </div>
            </div>
          ))}
        </div>
        {message ? (
          <p
            className={
              message.startsWith('Saved')
                ? 'text-sm text-health-accent'
                : 'text-sm text-health-danger'
            }
          >
            {message}
          </p>
        ) : null}
      </section>
      {preview ? (
        <section className="app-card">
          <h2 className="text-lg font-semibold">{preview.title}</h2>
          <iframe
            title={preview.title}
            className="h-[32rem] w-full rounded-lg border border-health-border bg-white"
            srcDoc={preview.html}
          />
        </section>
      ) : null}
    </div>
  );
}
