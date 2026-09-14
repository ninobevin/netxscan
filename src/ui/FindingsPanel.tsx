import { useEffect, useMemo, useState } from 'react';
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
import type { AdhicsFinding, FindingSeverity, FindingStatus } from '../shared/adhics-types';

type FindingsPanelProps = {
  onOpenAsset: (id: number) => void;
};

export function FindingsPanel({ onOpenAsset }: FindingsPanelProps) {
  const [findings, setFindings] = useState<AdhicsFinding[]>([]);
  const [severity, setSeverity] = useState('all');
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    const result = await window.netxscan.listFindings();
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    setFindings(result.findings);
    setMessage(null);
  };

  useEffect(() => {
    void load();
  }, []);

  const selected = findings.find((finding) => finding.id === openId) ?? null;
  const openCount = findings.filter((finding) => finding.status === 'open').length;
  const percent = Math.round((1 - openCount / Math.max(findings.length, 1)) * 100);

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
        !finding.controlCode.toLowerCase().includes(q) &&
        !finding.title.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [findings, severity, status, query]);

  const setFindingStatus = async (id: number, next: FindingStatus) => {
    const result = await window.netxscan.updateFindingStatus(id, next);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    setFindings(result.findings);
    showSaveSuccess();
  };

  return (
    <div className="space-y-4">
      {message ? <p className="text-sm text-destructive">{message}</p> : null}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label>Severity</Label>
          <Select value={severity} onValueChange={setSeverity}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {(['critical', 'high', 'medium', 'low'] as FindingSeverity[]).map((item) => (
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
        <p className="mt-1 text-xs text-muted-foreground">{openCount} open findings</p>
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
            {rows.map((finding) => (
              <TableRow
                key={finding.id}
                className="cursor-pointer"
                onClick={() => setOpenId(finding.id)}
              >
                <TableCell>
                  <SeverityBadge severity={finding.severity} />
                </TableCell>
                <TableCell className="font-mono text-xs">{finding.controlCode}</TableCell>
                <TableCell>{finding.title}</TableCell>
                <TableCell className="font-mono text-xs">
                  {finding.hostname ?? finding.ipv4 ?? '—'}
                </TableCell>
                <TableCell>{finding.status}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Dialog open={selected !== null} onOpenChange={(open) => !open && setOpenId(null)}>
        <DialogContent>
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle>{selected.controlCode}</DialogTitle>
              </DialogHeader>
              <div className="space-y-2 text-sm">
                <SeverityBadge severity={selected.severity} />
                <p className="font-medium">{selected.title}</p>
                <p>{selected.description}</p>
                <p className="text-xs text-muted-foreground">{selected.domainLabel}</p>
                <div className="flex flex-wrap gap-2 pt-2">
                  {selected.assetId ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        onOpenAsset(selected.assetId as number);
                        setOpenId(null);
                      }}
                    >
                      Open asset
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void setFindingStatus(selected.id, 'acknowledged')}
                  >
                    Acknowledge
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void setFindingStatus(selected.id, 'closed')}
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
