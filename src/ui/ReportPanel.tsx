import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
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
import { CompanyLogo } from './CompanyLogo';
import type { Category, Location } from '../shared/asset-types';
import type { CompanyProfile } from '../shared/company-types';
import type {
  AssessmentBatch,
  AssetListColumn,
  ReportKind,
  ReportPreview,
  ReportQuery,
} from '../shared/report-types';
import { ASSET_LIST_COLUMNS } from '../shared/report-types';

export function ReportPanel() {
  const [company, setCompany] = useState<CompanyProfile>({
    name: '',
    address: '',
    contact: '',
    notes: '',
    logoDataUrl: null,
  });
  const [kind, setKind] = useState<ReportKind>('assets');
  const [locationId, setLocationId] = useState<string>('all');
  const [categoryId, setCategoryId] = useState<string>('all');
  const [columns, setColumns] = useState<AssetListColumn[]>(
    ASSET_LIST_COLUMNS.map((item) => item.id),
  );
  const [batchId, setBatchId] = useState<string>('');
  const [outcome, setOutcome] = useState<'fail' | 'pass'>('fail');
  const [status, setStatus] = useState<'all' | 'open' | 'acknowledged' | 'closed'>('all');
  const [locations, setLocations] = useState<Location[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [batches, setBatches] = useState<AssessmentBatch[]>([]);
  const [preview, setPreview] = useState<ReportPreview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const query = useMemo((): ReportQuery => {
    return {
      kind,
      locationId: locationId === 'all' ? null : Number(locationId),
      categoryId: categoryId === 'all' ? null : Number(categoryId),
      columns,
      batchId: batchId ? Number(batchId) : null,
      outcome,
      status,
    };
  }, [kind, locationId, categoryId, columns, batchId, outcome, status]);

  useEffect(() => {
    void (async () => {
      const [profile, loc, cat, batchList] = await Promise.all([
        window.netxscan.getCompany(),
        window.netxscan.listLocations(),
        window.netxscan.listCategories(),
        window.netxscan.listReportBatches(),
      ]);
      if (profile.ok) {
        setCompany(profile.profile);
      }
      if (loc.ok) {
        setLocations(loc.locations);
      }
      if (cat.ok) {
        setCategories(cat.categories);
      }
      if (batchList.ok) {
        setBatches(batchList.batches);
        if (!batchId && batchList.batches[0]) {
          setBatchId(String(batchList.batches[0].id));
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void (async () => {
      const result = await window.netxscan.getReportPreview(query);
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setMessage(null);
      setPreview(result.preview);
    })();
  }, [query]);

  const headerSubtitle = useMemo(() => {
    if (!preview || preview.kind === 'assets') {
      return '';
    }
    const extra = preview.subtitle.trim();
    const address = company.address.trim().toLowerCase();
    if (!extra) {
      return '';
    }
    if (address && extra.toLowerCase().includes(address)) {
      return '';
    }
    return extra;
  }, [preview, company.address]);

  const moveColumn = (index: number, dir: -1 | 1) => {
    const next = [...columns];
    const target = index + dir;
    if (target < 0 || target >= next.length) {
      return;
    }
    const current = next[index];
    next[index] = next[target];
    next[target] = current;
    setColumns(next);
  };

  const savePdf = async () => {
    setBusy(true);
    setMessage(null);
    const result = await window.netxscan.saveComplianceReport(query);
    setBusy(false);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    if ('cancelled' in result && result.cancelled) {
      return;
    }
    if ('path' in result) {
      showSaveSuccess();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label>Type of report</Label>
          <Select value={kind} onValueChange={(value) => setKind(value as ReportKind)}>
            <SelectTrigger className="w-[240px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="assets">Asset List</SelectItem>
              <SelectItem value="findings">Findings</SelectItem>
              <SelectItem value="compliance">Compliance monitoring</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {kind === 'assets' ? (
          <>
            <div className="space-y-2">
              <Label>Location</Label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {locations.map((item) => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Device type</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {categories.map((item) => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        ) : null}
        {kind === 'findings' ? (
          <>
            <div className="space-y-2">
              <Label>Batch</Label>
              <Select value={batchId || 'none'} onValueChange={(value) => setBatchId(value === 'none' ? '' : value)}>
                <SelectTrigger className="w-[240px]">
                  <SelectValue placeholder="Select batch" />
                </SelectTrigger>
                <SelectContent>
                  {batches.length === 0 ? (
                    <SelectItem value="none">No batches yet</SelectItem>
                  ) : (
                    batches.map((item) => (
                      <SelectItem key={item.id} value={String(item.id)}>
                        {item.code}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Result</Label>
              <Select value={outcome} onValueChange={(value) => setOutcome(value as 'fail' | 'pass')}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fail">Failed</SelectItem>
                  <SelectItem value="pass">Passed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        ) : null}
        {kind === 'compliance' ? (
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={status}
              onValueChange={(value) =>
                setStatus(value as 'all' | 'open' | 'acknowledged' | 'closed')
              }
            >
              <SelectTrigger className="w-[180px]">
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
        ) : null}
        <div className="ml-auto flex items-center gap-3">
          {message ? <p className="text-sm text-destructive">{message}</p> : null}
          <Button variant="secondary" disabled={busy} onClick={() => void savePdf()}>
            {busy ? 'Saving…' : 'Save PDF'}
          </Button>
        </div>
      </div>
      {kind === 'assets' ? (
        <div className="rounded-xl border bg-card p-3">
          <p className="mb-2 text-xs text-muted-foreground">Column order (move to customize)</p>
          <div className="flex flex-wrap gap-2">
            {columns.map((id, index) => {
              const label = ASSET_LIST_COLUMNS.find((item) => item.id === id)?.label ?? id;
              return (
                <div key={id} className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs">
                  <span>{label}</span>
                  <Button size="sm" variant="ghost" className="h-6 px-1" onClick={() => moveColumn(index, -1)}>
                    ↑
                  </Button>
                  <Button size="sm" variant="ghost" className="h-6 px-1" onClick={() => moveColumn(index, 1)}>
                    ↓
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
      <article className="space-y-6 rounded-xl border bg-card p-8">
        <header className="flex items-start justify-between gap-4 border-b pb-4">
          <div>
            <h2 className="text-2xl font-semibold">{company.name.trim() || 'Company'}</h2>
            {company.address.trim() ? (
              <p className="mt-1 text-sm text-muted-foreground">{company.address}</p>
            ) : null}
            <p className="mt-2 text-sm font-medium">{preview?.title}</p>
            {headerSubtitle ? (
              <p className="text-xs text-muted-foreground whitespace-pre-line">{headerSubtitle}</p>
            ) : null}
          </div>
          <CompanyLogo
            src={company.logoDataUrl}
            className="h-16 w-16 shrink-0 rounded-md border bg-background object-contain p-1"
          />
        </header>
        {!preview || preview.sections.every((section) => section.rows.length === 0) ? (
          <p className="text-sm text-muted-foreground">No rows for this report.</p>
        ) : (
          preview.sections.map((section) => (
            <section key={section.heading || 'rows'} className="space-y-2">
              {section.heading ? <h3 className="text-sm font-semibold">{section.heading}</h3> : null}
              <Table>
                <TableHeader>
                  <TableRow>
                    {section.columns.map((col) => (
                      <TableHead key={col.key}>{col.label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {section.rows.map((row, index) => (
                    <TableRow key={`${section.heading}-${index}`}>
                      {section.columns.map((col) => (
                        <TableCell key={col.key} className={col.key === 'ipv4' || col.key === 'macAddress' ? 'font-mono text-xs' : 'text-sm'}>
                          {row[col.key] || '—'}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>
          ))
        )}
        {preview?.showSignature ? (
          <footer className="space-y-4 border-t pt-6">
            <p className="text-sm font-semibold">
              Prepared by: {preview.preparedBy.fullName || 'IT incharge'}
            </p>
            {preview.preparedBy.position ? (
              <p className="text-sm text-muted-foreground">{preview.preparedBy.position}</p>
            ) : null}
            <div className="grid gap-6 sm:grid-cols-2">
              <p className="border-b border-foreground/40 pb-1 text-sm text-muted-foreground">
                Signature
              </p>
              <p className="border-b border-foreground/40 pb-1 text-sm text-muted-foreground">
                Date
              </p>
            </div>
          </footer>
        ) : null}
      </article>
    </div>
  );
}
