import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ScanHost } from '../shared/asset-types';

export function ScanningPanel() {
  const [target, setTarget] = useState('');
  const [hosts, setHosts] = useState<ScanHost[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    return window.netxscan.onScanHostFound((host) => {
      setHosts((current) => {
        if (current.some((item) => item.ipv4 === host.ipv4)) {
          return current;
        }
        return [...current, host].sort((a, b) => a.ipv4.localeCompare(b.ipv4));
      });
    });
  }, []);

  const toggle = (ipv4: string, on: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      if (on) {
        next.add(ipv4);
      } else {
        next.delete(ipv4);
      }
      return next;
    });
  };

  const allSelected = hosts.length > 0 && selected.size === hosts.length;

  const runScan = async () => {
    setBusy(true);
    setMessage(null);
    setHosts([]);
    setSelected(new Set());
    const result = await window.netxscan.runScan(target);
    setBusy(false);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    setMessage(`Scanned ${result.scanned} target(s); ${result.live} live.`);
  };

  const addSelected = async () => {
    const chosen = hosts.filter((host) => selected.has(host.ipv4));
    if (chosen.length === 0) {
      setMessage('Select at least one live host.');
      return;
    }
    setBusy(true);
    const result = await window.netxscan.addScanToAssets(chosen);
    setBusy(false);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    setMessage(`Added ${result.added}; skipped ${result.skipped} already saved.`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[16rem] flex-1 space-y-2">
          <Label htmlFor="scan-target">Target</Label>
          <Input
            id="scan-target"
            placeholder="192.168.1.0/24 or 192.168.1.10 - 192.168.1.50"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
          />
        </div>
        <Button disabled={busy} onClick={() => void runScan()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Scan
        </Button>
        <Button
          variant="secondary"
          disabled={busy || selected.size === 0}
          onClick={() => void addSelected()}
        >
          Add to Asset Manager
        </Button>
      </div>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(value) => {
                    if (value) {
                      setSelected(new Set(hosts.map((host) => host.ipv4)));
                    } else {
                      setSelected(new Set());
                    }
                  }}
                  aria-label="Select all live hosts"
                />
              </TableHead>
              <TableHead>IP</TableHead>
              <TableHead>Hostname</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {hosts.length === 0 ? (
              <TableRow>
                <TableCell className="py-8 text-center text-muted-foreground" colSpan={3}>
                  {busy ? 'Scanning…' : 'No live hosts yet. Run a scan to populate this list.'}
                </TableCell>
              </TableRow>
            ) : (
              hosts.map((host) => (
                <TableRow key={host.ipv4}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(host.ipv4)}
                      onCheckedChange={(value) => toggle(host.ipv4, Boolean(value))}
                      aria-label={`Select ${host.ipv4}`}
                    />
                  </TableCell>
                  <TableCell className="font-mono">{host.ipv4}</TableCell>
                  <TableCell>{host.hostname ?? host.ipv4}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
