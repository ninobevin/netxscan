import { CheckCircle2, XCircle } from 'lucide-react';
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
  assetComplianceTag,
  compliancePercent,
  openFindingCount,
} from './prototype/dummy-data';

type DashboardPanelProps = {
  onOpenAsset: (id: number) => void;
  onOpenFindings: () => void;
};

export function DashboardPanel({ onOpenAsset, onOpenFindings }: DashboardPanelProps) {
  const open = DUMMY_FINDINGS.filter((finding) => finding.status === 'open');
  const critical = open.filter((finding) => finding.severity === 'critical').length;
  const percent = compliancePercent();
  const attention = DUMMY_ASSETS.filter(
    (asset) => assetComplianceTag(asset.id) !== 'OK',
  );
  const recent = [...DUMMY_FINDINGS]
    .filter((finding) => finding.status !== 'closed')
    .slice(0, 5);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {CLINIC.name} · {CLINIC.address}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Assets" value={String(DUMMY_ASSETS.length)} />
        <Kpi label="Open findings" value={String(open.length)} />
        <Kpi label="Critical" value={String(critical)} />
        <Kpi label="Compliance" value={`${percent}%`} />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">Compliance (open vs all findings)</p>
        <div className="h-3 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary" style={{ width: `${percent}%` }} />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="text-sm font-semibold">Recent findings</h2>
            <Button variant="secondary" size="sm" onClick={onOpenFindings}>
              View all
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sev</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Control</TableHead>
                <TableHead>Asset</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.map((finding) => {
                const asset = DUMMY_ASSETS.find((item) => item.id === finding.assetId);
                return (
                  <TableRow
                    key={finding.id}
                    className="cursor-pointer"
                    onClick={() => onOpenAsset(finding.assetId)}
                  >
                    <TableCell>
                      <SeverityBadge severity={finding.severity} />
                    </TableCell>
                    <TableCell>{finding.title}</TableCell>
                    <TableCell className="font-mono text-xs">{finding.controlId}</TableCell>
                    <TableCell className="font-mono text-xs">{asset?.ipv4}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <div className="rounded-xl border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">Assets needing attention</h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Host</TableHead>
                <TableHead>Open</TableHead>
                <TableHead>WinRM</TableHead>
                <TableHead>Tag</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attention.map((asset) => (
                <TableRow
                  key={asset.id}
                  className="cursor-pointer"
                  onClick={() => onOpenAsset(asset.id)}
                >
                  <TableCell>
                    <div className="font-medium">{asset.hostname}</div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {asset.ipv4}
                    </div>
                  </TableCell>
                  <TableCell>{openFindingCount(asset.id)}</TableCell>
                  <TableCell>
                    {asset.winrmOk ? (
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                  </TableCell>
                  <TableCell>{assetComplianceTag(asset.id)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
