import { CheckCircle2, ChevronDown, ChevronRight, Minus, XCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { FindingCell, FindingsMatrix } from '../shared/findings-types';

function StatusIcon({ status }: { status: string | null }) {
  if (status === 'pass') {
    return <CheckCircle2 className="h-4 w-4 shrink-0 text-health-accent" />;
  }
  if (status === 'fail') {
    return <XCircle className="h-4 w-4 shrink-0 text-health-danger" />;
  }
  if (status === 'warn') {
    return <Minus className="h-4 w-4 shrink-0 text-amber-500" />;
  }
  return <Minus className="h-4 w-4 shrink-0 text-health-subtle" />;
}

function statusLabel(status: string | null): string {
  if (status === 'pass') {
    return 'Compliant';
  }
  if (status === 'fail') {
    return 'Not compliant';
  }
  if (status === 'warn') {
    return 'Review';
  }
  if (status === 'skip') {
    return 'Not collected';
  }
  return 'Not collected';
}

function summarizeHost(
  matrix: FindingsMatrix,
  hostId: string,
): { fail: number; warn: number; pass: number } {
  let fail = 0;
  let warn = 0;
  let pass = 0;
  for (const check of matrix.checks) {
    const status = matrix.cells[hostId]?.[check.id]?.status;
    if (status === 'fail') {
      fail += 1;
    } else if (status === 'warn') {
      warn += 1;
    } else if (status === 'pass') {
      pass += 1;
    }
  }
  return { fail, warn, pass };
}

function HostFindings({
  matrix,
  hostId,
  issuesOnly,
}: {
  matrix: FindingsMatrix;
  hostId: string;
  issuesOnly: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const rows = useMemo(() => {
    const list = matrix.checks.map((check) => ({
      check,
      cell: matrix.cells[hostId]?.[check.id] ?? {
        status: null,
        detail: '',
        cveIds: [],
      },
    }));
    const rank = (status: string | null) => {
      if (status === 'fail') {
        return 0;
      }
      if (status === 'warn') {
        return 1;
      }
      if (status === 'skip' || !status) {
        return 2;
      }
      return 3;
    };
    const filtered = issuesOnly
      ? list.filter(
          (row) => row.cell.status === 'fail' || row.cell.status === 'warn',
        )
      : list;
    return [...filtered].sort(
      (left, right) => rank(left.cell.status) - rank(right.cell.status),
    );
  }, [hostId, issuesOnly, matrix]);

  if (rows.length === 0) {
    return (
      <p className="text-sm text-health-subtle">
        {issuesOnly
          ? 'No failed or review items for this host.'
          : 'No baseline has been collected yet.'}
      </p>
    );
  }

  return (
    <ul className="grid gap-1">
      {rows.map(({ check, cell }) => {
        const open = openId === check.id;
        return (
          <li key={check.id}>
            <button
              type="button"
              className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-health-muted"
              onClick={() => setOpenId(open ? null : check.id)}
            >
              <StatusIcon status={cell.status} />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{check.title}</span>
                <span className="text-health-subtle">
                  {statusLabel(cell.status)}
                </span>
              </span>
            </button>
            {open ? (
              <div className="mb-2 ml-6 grid gap-1 rounded-lg border border-health-border p-3 text-sm">
                {cell.detail ? (
                  <p className="text-health-subtle">{cell.detail}</p>
                ) : null}
                {cell.cveIds.length > 0 ? (
                  <p>
                    CVE:{' '}
                    {cell.cveIds.map((id) => (
                      <span key={id} className="mr-2 font-medium">
                        {id}
                      </span>
                    ))}
                  </p>
                ) : (
                  <p className="text-health-subtle">No CVE IDs on this control.</p>
                )}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function FindingsPanel() {
  const [matrix, setMatrix] = useState<FindingsMatrix | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [openHost, setOpenHost] = useState<string | null>(null);
  const [issuesOnly, setIssuesOnly] = useState(true);

  useEffect(() => {
    void window.netxscan.getFindingsMatrix().then((result) => {
      if (!result.ok) {
        setMessage('Could not load findings.');
        return;
      }
      setMatrix(result.matrix);
    });
  }, []);

  if (!matrix) {
    return (
      <section className="app-card">
        <h2 className="text-lg font-semibold">Findings</h2>
        <p className="text-sm text-health-subtle">{message ?? 'Loading…'}</p>
      </section>
    );
  }

  return (
    <div className="grid gap-4">
      <section className="app-card">
        <h2 className="text-lg font-semibold">Findings</h2>
        <p className="mt-1 text-sm text-health-subtle">
          One card per workstation. Open a host to read control titles. Click a
          control for notes and CVE IDs from the software catalog.
        </p>
        <label className="mt-3 inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={issuesOnly}
            onChange={(event) => setIssuesOnly(event.target.checked)}
          />
          Show only failed and review items
        </label>
      </section>
      {matrix.hosts.length === 0 ? (
        <section className="app-card">
          <p className="text-sm text-health-subtle">No assets yet.</p>
        </section>
      ) : (
        matrix.hosts.map((host) => {
          const counts = summarizeHost(matrix, host.id);
          const open = openHost === host.id;
          return (
            <section key={host.id} className="app-card">
              <button
                type="button"
                className="flex w-full items-center gap-3 text-left"
                onClick={() => setOpenHost(open ? null : host.id)}
              >
                {open ? (
                  <ChevronDown className="h-5 w-5 shrink-0 text-health-subtle" />
                ) : (
                  <ChevronRight className="h-5 w-5 shrink-0 text-health-subtle" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{host.hostname}</span>
                  <span className="text-sm text-health-subtle">
                    {host.ipAddress ?? 'No IP'}
                  </span>
                </span>
                <span className="shrink-0 text-sm">
                  {counts.fail > 0 ? (
                    <span className="text-health-danger">{counts.fail} fail</span>
                  ) : (
                    <span className="text-health-subtle">0 fail</span>
                  )}
                  <span className="text-health-subtle"> · </span>
                  <span className="text-amber-500">{counts.warn} review</span>
                  <span className="text-health-subtle"> · </span>
                  <span className="text-health-accent">{counts.pass} ok</span>
                </span>
              </button>
              {open ? (
                <div className="mt-4 border-t border-health-border pt-3">
                  <HostFindings
                    matrix={matrix}
                    hostId={host.id}
                    issuesOnly={issuesOnly}
                  />
                </div>
              ) : null}
            </section>
          );
        })
      )}
    </div>
  );
}
