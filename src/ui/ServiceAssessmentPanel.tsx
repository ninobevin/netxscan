import { useEffect, useState } from 'react';
import type { ServiceAssessment } from '../shared/assessment-types';
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
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setAssessment(null);
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
  };

  return (
    <section className="app-card mt-6">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold">
          TLS and SMB facts — {assetLabel}
        </h2>
        <button type="button" className="app-btn-secondary" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="text-sm text-health-subtle">
        Controlled check of TCP 443 and 445 only. Results describe what the
        host advertised. They are not CVE matches.
      </p>
      {canAssess ? (
        <BusyButton
          className="app-btn-primary w-fit"
          busy={busy}
          busyLabel="Assessing…"
          onClick={() => {
            void onRun();
          }}
        >
          Run TLS/SMB check
        </BusyButton>
      ) : (
        <p className="text-sm text-health-subtle">
          Sign in as administrator to run this check.
        </p>
      )}
      {message ? <p className="text-sm text-health-danger">{message}</p> : null}
      {assessment ? (
        <div className="grid gap-4 text-sm md:grid-cols-2">
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
              Certificate: {assessment.tls.certificateSubject ?? 'none detected'}
            </p>
            <p>Issuer: {assessment.tls.certificateIssuer ?? '—'}</p>
            <p>Expires: {assessment.tls.certificateExpires ?? '—'}</p>
            <p className="text-health-subtle">
              Ciphers: {assessment.tls.ciphers.slice(0, 8).join(', ') || '—'}
            </p>
          </div>
          <div>
            <h3 className="font-medium">SMB (445)</h3>
            <p>Port open: {assessment.smb.portOpen ? 'yes' : 'no'}</p>
            <p>
              Dialects:{' '}
              {assessment.smb.dialects.length
                ? assessment.smb.dialects.join(', ')
                : 'none detected'}
            </p>
            <p>
              SMBv1 advertised:{' '}
              {assessment.smb.smbv1Advertised === null
                ? 'not determined'
                : assessment.smb.smbv1Advertised
                  ? 'yes'
                  : 'no'}
            </p>
          </div>
          <p className="text-health-subtle md:col-span-2">{assessment.notes}</p>
        </div>
      ) : null}
    </section>
  );
}
