import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SeverityBadge } from './prototype/SeverityBadge';
import {
  CLINIC,
  DUMMY_ASSETS,
  DUMMY_FINDINGS,
  assetById,
  compliancePercent,
  type DummyControl,
} from './prototype/dummy-data';

const SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

type ReportPanelProps = {
  controls: DummyControl[];
};

export function ReportPanel({ controls }: ReportPanelProps) {
  const open = DUMMY_FINDINGS.filter((finding) => finding.status === 'open');
  const critical = open.filter((finding) => finding.severity === 'critical').length;
  const percent = compliancePercent();
  const gaps = controls.filter((control) => control.status === 'gap');
  const top = [...DUMMY_FINDINGS]
    .filter((finding) => finding.status === 'open')
    .sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity])
    .slice(0, 6);

  return (
    <div className="space-y-4">
      <div className="flex justify-end print:hidden">
        <Button variant="secondary" onClick={() => window.print()}>
          Print preview
        </Button>
      </div>
      <article className="space-y-6 rounded-xl border bg-card p-8 print:border-0">
        <header className="border-b pb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            NetXScan
          </p>
          <h2 className="mt-2 text-2xl font-semibold">Compliance report preview</h2>
          <p className="mt-2 text-sm">{CLINIC.name}</p>
          <p className="text-sm text-muted-foreground">{CLINIC.address}</p>
          <p className="text-sm text-muted-foreground">
            Contact {CLINIC.contact} · {CLINIC.reportDate}
          </p>
        </header>
        <section className="grid gap-3 sm:grid-cols-4">
          <Stat label="Assets" value={String(DUMMY_ASSETS.length)} />
          <Stat label="Open findings" value={String(open.length)} />
          <Stat label="Critical" value={String(critical)} />
          <Stat label="Compliance" value={`${percent}%`} />
        </section>
        <section>
          <h3 className="mb-2 text-sm font-semibold">Top open findings</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sev</TableHead>
                <TableHead>Control</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Asset</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {top.map((finding) => (
                <TableRow key={finding.id}>
                  <TableCell>
                    <SeverityBadge severity={finding.severity} />
                  </TableCell>
                  <TableCell className="font-mono text-xs">{finding.controlId}</TableCell>
                  <TableCell>{finding.title}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {assetById(finding.assetId)?.ipv4}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
        <section>
          <h3 className="mb-2 text-sm font-semibold">ADHICS gaps</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {gaps.map((control) => (
              <li key={control.id}>
                {control.id} — {control.description} ({control.domain})
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h3 className="mb-2 text-sm font-semibold">Inventory excerpt</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>IP</TableHead>
                <TableHead>Hostname</TableHead>
                <TableHead>Device</TableHead>
                <TableHead>Location</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {DUMMY_ASSETS.slice(0, 8).map((asset) => (
                <TableRow key={asset.id}>
                  <TableCell className="font-mono text-xs">{asset.ipv4}</TableCell>
                  <TableCell>{asset.hostname}</TableCell>
                  <TableCell>{asset.device}</TableCell>
                  <TableCell>{asset.location}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      </article>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}
