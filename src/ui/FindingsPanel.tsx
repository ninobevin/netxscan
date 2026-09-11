import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { showSaveSuccess } from './show-save-success';
import { SeverityBadge } from './prototype/SeverityBadge';
import {
  DUMMY_FINDINGS,
  assetById,
  complianceByDomain,
  compliancePercent,
  type DummyControl,
  type DummyFinding,
  type FindingStatus,
  type Severity,
} from './prototype/dummy-data';

type FindingsPanelProps = {
  controls: DummyControl[];
  onOpenAsset: (id: number) => void;
};

export function FindingsPanel({ controls, onOpenAsset }: FindingsPanelProps) {
  const [findings, setFindings] = useState<DummyFinding[]>(DUMMY_FINDINGS);
  const [severity, setSeverity] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);

  const selected = findings.find((finding) => finding.id === openId) ?? null;
  const domains = complianceByDomain(findings, controls);
  const percent = compliancePercent(findings);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return findings.filter((finding) => {
      if (severity !== 'all' && finding.severity !== severity) {
        return false;
      }
      if (status !== 'all' && finding.status !== status) {
        return false;
      }
      if (
        q &&
        !finding.controlId.toLowerCase().includes(q) &&
        !finding.title.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [findings, severity, status, query]);

  const setFindingStatus = (id: number, next: FindingStatus) => {
    setFindings((current) =>
      current.map((finding) =>
        finding.id === id ? { ...finding, status: next } : finding,
      ),
    );
    showSaveSuccess();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label>Severity</Label>
          <Select value={severity} onValueChange={setSeverity}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {(['critical', 'high', 'medium', 'low'] as Severity[]).map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="open">open</SelectItem>
              <SelectItem value="acknowledged">acknowledged</SelectItem>
              <SelectItem value="closed">closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[12rem] flex-1 space-y-2">
          <Label htmlFor="finding-q">Control or title</Label>
          <Input
            id="finding-q"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
          />
        </div>
      </div>
      <div className="rounded-xl border bg-card p-4">
        <p className="text-sm font-medium">Compliance {percent}%</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {domains.map((domain) => (
            <div key={domain.controlId}>
              <p className="text-xs text-muted-foreground">{domain.domain}</p>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary" style={{ width: `${domain.percent}%` }} />
              </div>
              <p className="mt-1 text-xs">
                {domain.percent}% · {domain.open} open
              </p>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sev</TableHead>
              <TableHead>Control</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Asset</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((finding) => {
              const asset = assetById(finding.assetId);
              return (
                <TableRow
                  key={finding.id}
                  className="cursor-pointer"
                  onClick={() => setOpenId(finding.id)}
                >
                  <TableCell>
                    <SeverityBadge severity={finding.severity} />
                  </TableCell>
                  <TableCell className="font-mono text-xs">{finding.controlId}</TableCell>
                  <TableCell>{finding.title}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {asset?.hostname ?? finding.assetId}
                  </TableCell>
                  <TableCell>{finding.status}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <Dialog open={selected !== null} onOpenChange={(open) => !open && setOpenId(null)}>
        <DialogContent>
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle>{selected.controlId}</DialogTitle>
              </DialogHeader>
              <div className="space-y-2 text-sm">
                <SeverityBadge severity={selected.severity} />
                <p className="font-medium">{selected.title}</p>
                <p>{selected.description}</p>
                {selected.evidence.map((item) => (
                  <p key={item} className="font-mono text-xs text-muted-foreground">
                    {item}
                  </p>
                ))}
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      onOpenAsset(selected.assetId);
                      setOpenId(null);
                    }}
                  >
                    Open asset
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setFindingStatus(selected.id, 'acknowledged')}
                  >
                    Acknowledge
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setFindingStatus(selected.id, 'closed')}
                  >
                    Close
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
