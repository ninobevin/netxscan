import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { showSaveSuccess } from './show-save-success';
import type { CompanyProfile } from '../shared/company-types';
import type { ReportDomainSection } from '../shared/report-types';

export function ReportPanel() {
  const [company, setCompany] = useState<CompanyProfile>({
    name: '',
    address: '',
    contact: '',
    notes: '',
  });
  const [domains, setDomains] = useState<ReportDomainSection[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const [profile, report] = await Promise.all([
        window.netxscan.getCompany(),
        window.netxscan.getComplianceReport(),
      ]);
      if (profile.ok) {
        setCompany(profile.profile);
      } else {
        setMessage(profile.error);
      }
      if (report.ok) {
        setDomains(report.domains);
      } else {
        setMessage(report.error);
      }
    })();
  }, []);

  const savePdf = async () => {
    setBusy(true);
    setMessage(null);
    const result = await window.netxscan.saveComplianceReport();
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
      <div className="flex items-center justify-end gap-3">
        {message ? <p className="text-sm text-destructive">{message}</p> : null}
        <Button variant="secondary" disabled={busy} onClick={() => void savePdf()}>
          {busy ? 'Saving…' : 'Save PDF'}
        </Button>
      </div>
      <article className="space-y-6 rounded-xl border bg-card p-8">
        <header className="border-b pb-4">
          <h2 className="text-2xl font-semibold">{company.name.trim() || 'Company'}</h2>
          {company.address.trim() ? (
            <p className="mt-1 text-sm text-muted-foreground">{company.address}</p>
          ) : null}
        </header>
        {domains.length === 0 ? (
          <p className="text-sm text-muted-foreground">No units with findings.</p>
        ) : (
          domains.map((section) => (
            <section key={section.domain} className="space-y-4">
              <h3 className="text-base font-semibold">{section.domain}</h3>
              {section.controls.map((control) => (
                <div key={control.controlId} className="space-y-2">
                  <h4 className="text-sm font-semibold">
                    {control.controlId} {control.title}
                  </h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Unit</TableHead>
                        <TableHead>IP</TableHead>
                        <TableHead>Device</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Findings</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {control.units.map((unit) => (
                        <TableRow key={`${section.domain}-${control.controlId}-${unit.ipv4}-${unit.hostname}`}>
                          <TableCell>{unit.hostname}</TableCell>
                          <TableCell className="font-mono text-xs">{unit.ipv4 || '—'}</TableCell>
                          <TableCell>{unit.device}</TableCell>
                          <TableCell>{unit.location}</TableCell>
                          <TableCell className="text-sm">{unit.findings}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </section>
          ))
        )}
        <footer className="space-y-4 border-t pt-6">
          <p className="text-sm font-semibold">IT assigned</p>
          <div className="grid gap-6 sm:grid-cols-2">
            <p className="border-b border-foreground/40 pb-1 text-sm text-muted-foreground">
              Signature
            </p>
            <p className="border-b border-foreground/40 pb-1 text-sm text-muted-foreground">
              Date
            </p>
          </div>
        </footer>
      </article>
    </div>
  );
}
