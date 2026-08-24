import { useEffect, useState } from 'react';
import type {
  AssessmentCorrelation,
  AssessmentIssue,
  ServiceAssessment,
} from '../shared/assessment-types';
import { BusyButton } from './BusyButton';

function errorText(error: string): string {
  if (error === 'forbidden') {
    return 'Only administrators can run service assessments.';
  }

  if (error === 'not_authorized_range') {
    return 'This asset IP is outside the authorized network ranges.';
  }

  if (error === 'nmap_missing') {
    return 'Nmap was not found.';
  }

  if (error === 'not_found') {
    return 'No assessment has been saved for this asset yet.';
  }

  if (error === 'scan_in_progress') {
    return 'Another scan is already running.';
  }

  if (error === 'timeout') {
    return 'The assessment timed out.';
  }

  if (error === 'unauthorized') {
    return 'Your session expired. Sign in again.';
  }

  return 'The assessment could not be completed.';
}

function nistClass(severity: AssessmentIssue['severity']): string {
  if (severity === 'critical') {
    return 'bg-health-nist-critical text-white';
  }
  if (severity === 'high') {
    return 'bg-health-nist-high text-white';
  }
  if (severity === 'medium') {
    return 'bg-health-nist-moderate text-health-text';
  }
  if (severity === 'low') {
    return 'bg-health-nist-low text-white';
  }
  return 'bg-health-nist-info text-white';
}

function nistLabel(severity: AssessmentIssue['severity']): string {
  if (severity === 'critical') {
    return 'Very high';
  }
  if (severity === 'high') {
    return 'High';
  }
  if (severity === 'medium') {
    return 'Moderate';
  }
  if (severity === 'low') {
    return 'Low';
  }
  return 'Informational';
}

type ServiceAssessmentPanelProps = {
  assetId: string;
  assetLabel: string;
  canAssess: boolean;
  onClose: () => void;
};

export function ServiceAssessmentPanel({
  assetId,
  assetLabel,
  canAssess,
  onClose,
}: ServiceAssessmentPanelProps) {
  const [assessment, setAssessment] = useState<ServiceAssessment | null>(null);
  const [correlation, setCorrelation] = useState<AssessmentCorrelation | null>(
    null,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setAssessment(null);
    setCorrelation(null);
    setMessage(null);
    void window.netxscan.getLatestAssessment(assetId).then((result) => {
      if (result.ok) {
        setAssessment(result.assessment);
        return;
      }

      if (result.error !== 'not_found') {
        setMessage(errorText(result.error));
      }
    });
  }, [assetId]);

  const onRun = async () => {
    setBusy(true);
    setMessage(null);
    const result = await window.netxscan.runServiceAssessment(assetId);
    setBusy(false);

    if (!result.ok) {
      setMessage(errorText(result.error));
      return;
    }

    setAssessment(result.assessment);
    setCorrelation(result.correlation ?? null);
    const count = result.assessment.issues.length;
    const cveCount = result.correlation?.matches.length ?? 0;
    const catalog = result.correlation
      ? result.correlation.catalogSource === 'online'
        ? `CVE catalog downloaded (${result.correlation.catalogImported} record(s)).`
        : `Online catalog was unavailable; correlated against the local catalog (${result.correlation.catalogImported} record(s)).`
      : '';
    const issuesText = count
      ? `${count} misconfiguration issue(s) were written to Findings.`
      : 'No misconfiguration issues were raised.';
    const cveText = cveCount
      ? `${cveCount} catalog CVE match(es) from this assessment were written to Findings.`
      : 'No catalog CVEs matched this assessment’s TLS, SMB, or software facts.';
    setMessage(`Assessment saved. ${issuesText} ${catalog} ${cveText}`);
  };

  return (
    <section className="app-card mt-6">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold">
          Service security assessment — {assetLabel}
        </h2>
        <button type="button" className="app-btn-secondary" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="text-sm text-health-subtle">
        Fixed Nmap check of common clinic ports (FTP, Telnet, mail, HTTP,
        LDAP, SMB, SQL, RDP, VNC, WinRM HTTP, Redis, MongoDB, printers) plus
        TLS ciphers, certificate expiry, and SMB dialects/signing. Then it
        downloads the CVE catalog (or uses the local catalog if the network
        is down) and correlates those facts plus inventory services and any
        Windows software already collected for this asset. Badges use
        NIST-style colors and qualitative ratings with a 0–10 risk score.
        These are configuration facts, not exploits. Open issues and CVE
        matches are copied to Findings.
      </p>
      {canAssess ? (
        <BusyButton
          className="app-btn-primary w-fit"
          busy={busy}
          busyLabel="Assessing and correlating…"
          onClick={() => {
            void onRun();
          }}
        >
          Assess all
        </BusyButton>
      ) : (
        <p className="text-sm text-health-subtle">
          Sign in as administrator to run this check.
        </p>
      )}
      {message ? (
        <p
          className={
            message.startsWith('Assessment saved')
              ? 'text-sm text-health-accent'
              : 'text-sm text-health-danger'
          }
        >
          {message}
        </p>
      ) : null}
      {assessment ? (
        <div className="grid gap-4 text-sm">
          {assessment.issues.length === 0 ? (
            <p className="rounded-xl bg-health-nist-info/15 px-3 py-2 text-health-nist-info">
              No misconfiguration issues in this assessed set.
            </p>
          ) : (
            <ul className="grid gap-2">
              {assessment.issues.map((issue) => (
                <li
                  key={issue.id}
                  className="rounded-xl border border-health-border p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-md px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${nistClass(issue.severity)}`}
                    >
                      {nistLabel(issue.severity)} · {issue.riskScore.toFixed(1)}
                    </span>
                    <span className="font-medium">{issue.title}</span>
                    <span className="text-health-subtle">{issue.id}</span>
                  </div>
                  <p className="mt-2">{issue.evidence}</p>
                  <p className="mt-1 text-health-subtle">{issue.recommendation}</p>
                </li>
              ))}
            </ul>
          )}
          {correlation ? (
            <div>
              <h3 className="font-medium">CVE catalog correlation</h3>
              <p className="text-health-subtle">
                {correlation.catalogSource === 'online'
                  ? `Downloaded ${correlation.catalogImported} catalog record(s) from the internet.`
                  : `Used ${correlation.catalogImported} local catalog record(s).`}
              </p>
              {correlation.matches.length === 0 ? (
                <p>
                  No catalog CVEs matched this host’s TLS, SMB, service, or
                  Windows software facts.
                </p>
              ) : (
                <ul className="mt-2 grid gap-2">
                  {correlation.matches.map((match) => (
                    <li
                      key={match.cveId}
                      className="rounded-xl border border-health-border p-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-md px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${nistClass(match.severity)}`}
                        >
                          {nistLabel(match.severity)}
                        </span>
                        <span className="font-medium">{match.title}</span>
                        <span className="text-health-subtle">{match.cveId}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="font-medium">HTTPS / TLS (443)</h3>
              <p>Port open: {assessment.tls.portOpen ? 'yes' : 'no'}</p>
              <p>
                TLS versions:{' '}
                {assessment.tls.tlsVersions.length
                  ? assessment.tls.tlsVersions.join(', ')
                  : 'none detected'}
              </p>
              <p>
                Certificate:{' '}
                {assessment.tls.certificateSubject ?? 'none detected'}
              </p>
              <p className="text-health-subtle">
                Ciphers: {assessment.tls.ciphers.slice(0, 8).join(', ') || '—'}
              </p>
            </div>
            <div>
              <h3 className="font-medium">SMB and other ports</h3>
              <p>SMB 445 open: {assessment.smb.portOpen ? 'yes' : 'no'}</p>
              <p>
                SMBv1 advertised:{' '}
                {assessment.smb.smbv1Advertised === null
                  ? 'not determined'
                  : assessment.smb.smbv1Advertised
                    ? 'yes'
                    : 'no'}
              </p>
              <p>
                SMB signing required:{' '}
                {assessment.smb.signingRequired === null ||
                assessment.smb.signingRequired === undefined
                  ? 'not determined'
                  : assessment.smb.signingRequired
                    ? 'yes'
                    : 'no'}
              </p>
              <p>
                Open in this check:{' '}
                {assessment.openPorts.length
                  ? assessment.openPorts.join(', ')
                  : 'none'}
              </p>
            </div>
          </div>
          <p className="text-health-subtle">{assessment.notes}</p>
        </div>
      ) : null}
    </section>
  );
}
