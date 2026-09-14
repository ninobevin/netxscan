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
  DUMMY_CONTROLS,
  DUMMY_FINDINGS,
  assetById,
  findingsForAsset,
  scriptsForControl,
} from './prototype/dummy-data';

type AssetDetailPanelProps = {
  assetId: number;
  onBack: () => void;
  onOpenScripts: (controlId: string) => void;
};

export function AssetDetailPanel({
  assetId,
  onBack,
  onOpenScripts,
}: AssetDetailPanelProps) {
  const asset = assetById(assetId);
  if (!asset) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Asset not found.</p>
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
      </div>
    );
  }

  const findings = findingsForAsset(asset.id);
  const controlIds = [...new Set(findings.map((finding) => finding.controlId))];

  return (
    <div className="space-y-4">
      <Button variant="secondary" size="sm" onClick={onBack}>
        Back
      </Button>
      <div className="rounded-xl border bg-card p-4">
        <h2 className="text-lg font-semibold">{asset.hostname}</h2>
        <p className="font-mono text-sm text-muted-foreground">{asset.ipv4}</p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
          <Field label="MAC" value={asset.macAddress} />
          <Field label="OS" value={asset.osVersion} />
          <Field label="Device" value={asset.device} />
          <Field label="Location" value={asset.location} />
          <div>
            <dt className="text-xs text-muted-foreground">WinRM</dt>
            <dd className="mt-1">
              {asset.winrmOk ? (
                <CheckCircle2 className="h-4 w-4 text-primary" />
              ) : (
                <XCircle className="h-4 w-4 text-muted-foreground" />
              )}
            </dd>
          </div>
        </dl>
      </div>
      <div className="rounded-xl border bg-card">
        <h3 className="border-b px-4 py-3 text-sm font-semibold">Ports (dummy)</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Port</TableHead>
              <TableHead>Proto</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Product</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {asset.ports.map((port) => (
              <TableRow key={`${port.protocol}-${port.port}`}>
                <TableCell className="font-mono">{port.port}</TableCell>
                <TableCell>{port.protocol}</TableCell>
                <TableCell>{port.service}</TableCell>
                <TableCell>{port.product}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="rounded-xl border bg-card">
        <h3 className="border-b px-4 py-3 text-sm font-semibold">Findings</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sev</TableHead>
              <TableHead>Control</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {findings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">
                  No dummy findings on this asset.
                </TableCell>
              </TableRow>
            ) : (
              findings.map((finding) => (
                <TableRow key={finding.id}>
                  <TableCell>
                    <SeverityBadge severity={finding.severity} />
                  </TableCell>
                  <TableCell className="font-mono text-xs">{finding.controlId}</TableCell>
                  <TableCell>{finding.title}</TableCell>
                  <TableCell>{finding.status}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <h3 className="text-sm font-semibold">ADHICS / scripts</h3>
        {controlIds.length === 0 ? (
          <p className="text-sm text-muted-foreground">No mapped controls.</p>
        ) : (
          controlIds.map((controlId) => {
            const control = DUMMY_CONTROLS.find((item) => item.id === controlId);
            const linkedScripts = scriptsForControl(controlId);
            return (
              <div
                key={controlId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {controlId} · {control?.description}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {linkedScripts.length === 0
                      ? 'No scripts'
                      : linkedScripts.map((script) => script.name).join(', ')}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onOpenScripts(controlId)}
                >
                  Open script
                </Button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1">{value}</dd>
    </div>
  );
}
