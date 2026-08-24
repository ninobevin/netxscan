import type { AssetService } from '../shared/asset-types';
import type {
  AssessmentIssue,
  SmbFacts,
  TlsFacts,
} from '../shared/assessment-types';

const WEAK_CIPHER = /NULL|EXPORT|DES|RC4|MD5|ANON|NULL_SHA/i;
const OLD_TLS = /SSLv2|SSLv3|TLSv1(\.0)?$|TLSv1\.1/i;

function push(
  issues: AssessmentIssue[],
  issue: AssessmentIssue,
): void {
  issues.push(issue);
}

function certExpired(expires: string | null): boolean {
  if (!expires) {
    return false;
  }

  const ms = Date.parse(expires);
  return Number.isFinite(ms) && ms < Date.now();
}

function looksSelfSigned(tls: TlsFacts): boolean {
  const subject = tls.certificateSubject?.trim().toLowerCase();
  const issuer = tls.certificateIssuer?.trim().toLowerCase();
  return Boolean(subject && issuer && subject === issuer);
}

export function evaluateMisconfigurations(input: {
  tls: TlsFacts;
  smb: SmbFacts;
  openPorts: number[];
  services: AssetService[];
}): AssessmentIssue[] {
  const ports = new Set([
    ...input.openPorts,
    ...input.services
      .filter((item) => item.protocol.toLowerCase() === 'tcp')
      .map((item) => item.port),
  ]);
  const issues: AssessmentIssue[] = [];

  if (input.smb.smbv1Advertised === true) {
    push(issues, {
      id: 'NX-SMBV1',
      title: 'SMBv1 protocol advertised',
      description:
        'SMBv1 is obsolete and is treated as a high-risk misconfiguration (NIST SP 800-53 SC-8 / SC-13). This is not an exploit.',
      evidence: `SMBv1 or NT LM 0.12 advertised. Dialects: ${input.smb.dialects.join(', ') || 'SMBv1'}.`,
      recommendation:
        'Disable SMBv1 on the host and prefer SMB 2.02 or later. Re-assess after the change.',
      severity: 'critical',
      riskScore: 9.8,
    });
  }

  if (input.smb.signingRequired === false) {
    push(issues, {
      id: 'NX-SMB-SIGN',
      title: 'SMB signing not required',
      description:
        'SMB message signing is disabled or optional. Relays and tampering are easier on the LAN (NIST SP 800-53 SC-8).',
      evidence: 'smb2-security-mode reported signing disabled or not required.',
      recommendation:
        'Require SMB signing (and encryption where supported) on servers and domain members.',
      severity: 'high',
      riskScore: 7.3,
    });
  }

  const oldTls = input.tls.tlsVersions.filter((item) => OLD_TLS.test(item));
  if (oldTls.length > 0) {
    const critical = oldTls.some((item) => /SSLv/i.test(item));
    push(issues, {
      id: 'NX-TLS-LEGACY',
      title: 'Legacy SSL/TLS versions enabled',
      description:
        'TLS 1.0, TLS 1.1, and SSL are withdrawn or discouraged (NIST SP 800-52). Handshake facts only; NetXScan does not exploit the service.',
      evidence: `Advertised versions: ${oldTls.join(', ')}.`,
      recommendation:
        'Disable SSL 2/3 and TLS 1.0/1.1. Allow TLS 1.2 and TLS 1.3 only.',
      severity: critical ? 'critical' : 'high',
      riskScore: critical ? 9.0 : 7.5,
    });
  }

  const weakCiphers = input.tls.ciphers.filter((item) => WEAK_CIPHER.test(item));
  if (weakCiphers.length > 0) {
    push(issues, {
      id: 'NX-TLS-CIPHER',
      title: 'Weak TLS cipher suites',
      description:
        'NULL, EXPORT, DES, RC4, MD5, or anonymous suites do not meet current encryption guidance (NIST SP 800-52 / 800-175B).',
      evidence: `Weak suites: ${weakCiphers.slice(0, 8).join(', ')}.`,
      recommendation:
        'Remove weak cipher suites from the TLS configuration. Prefer AEAD suites (AES-GCM, ChaCha20-Poly1305).',
      severity: 'high',
      riskScore: 7.4,
    });
  }

  if (certExpired(input.tls.certificateExpires)) {
    push(issues, {
      id: 'NX-TLS-EXPIRED',
      title: 'TLS certificate expired',
      description:
        'An expired certificate breaks trust and often forces users onto unsafe workarounds (NIST SP 800-52).',
      evidence: `Not valid after: ${input.tls.certificateExpires}.`,
      recommendation: 'Replace the certificate and automate renewal.',
      severity: 'high',
      riskScore: 7.1,
    });
  }

  if (looksSelfSigned(input.tls)) {
    push(issues, {
      id: 'NX-TLS-SELF',
      title: 'Self-signed TLS certificate',
      description:
        'Subject and issuer match. Browsers and clients cannot validate the clinic CA chain.',
      evidence: `Subject=${input.tls.certificateSubject}; Issuer=${input.tls.certificateIssuer}.`,
      recommendation:
        'Use a certificate from your internal CA or a public CA. Do not ask staff to ignore browser warnings.',
      severity: 'medium',
      riskScore: 5.6,
    });
  }

  if (ports.has(23)) {
    push(issues, {
      id: 'NX-TELNET',
      title: 'Telnet service exposed',
      description:
        'Telnet sends credentials in cleartext. This is a configuration finding from an open port in the assessed set.',
      evidence: 'TCP 23 is open.',
      recommendation: 'Disable Telnet. Use SSH (TCP 22) with key-based auth.',
      severity: 'critical',
      riskScore: 9.1,
    });
  }

  if (ports.has(21)) {
    push(issues, {
      id: 'NX-FTP',
      title: 'FTP service exposed',
      description:
        'FTP is typically unencrypted. Confirm whether FTPS/SFTP is required instead.',
      evidence: 'TCP 21 is open.',
      recommendation: 'Replace FTP with SFTP or FTPS and restrict access.',
      severity: 'high',
      riskScore: 7.0,
    });
  }

  if (ports.has(80) && !input.tls.portOpen && !ports.has(443)) {
    push(issues, {
      id: 'NX-HTTP-CLEAR',
      title: 'HTTP without HTTPS',
      description:
        'Cleartext HTTP was seen and TCP 443 was not open in this check.',
      evidence: 'TCP 80 is open; TCP 443 is not open.',
      recommendation:
        'Offer HTTPS, redirect HTTP to HTTPS, and disable plaintext admin pages.',
      severity: 'medium',
      riskScore: 5.4,
    });
  }

  if (ports.has(8080) && !ports.has(8443) && !ports.has(443)) {
    push(issues, {
      id: 'NX-HTTP-8080',
      title: 'Alternate HTTP port without TLS',
      description:
        'TCP 8080 is often a management UI. No HTTPS listener was seen on 443 or 8443 in this check.',
      evidence: 'TCP 8080 is open; 443 and 8443 are not.',
      recommendation: 'Put the UI behind TLS or restrict it to management networks.',
      severity: 'medium',
      riskScore: 5.5,
    });
  }

  if (ports.has(110)) {
    push(issues, {
      id: 'NX-POP3',
      title: 'POP3 service exposed',
      description: 'POP3 is usually cleartext. Prefer POP3S or IMAPS.',
      evidence: 'TCP 110 is open.',
      recommendation: 'Disable POP3 or require TLS on 995.',
      severity: 'high',
      riskScore: 6.9,
    });
  }

  if (ports.has(143)) {
    push(issues, {
      id: 'NX-IMAP',
      title: 'IMAP service exposed',
      description: 'IMAP without TLS exposes mailbox credentials.',
      evidence: 'TCP 143 is open.',
      recommendation: 'Use IMAPS (993) or STARTTLS and disable plaintext IMAP.',
      severity: 'high',
      riskScore: 6.8,
    });
  }

  if (ports.has(25)) {
    push(issues, {
      id: 'NX-SMTP',
      title: 'SMTP listener exposed',
      description:
        'An open SMTP port is a mail-relay and phishing risk if not tightly controlled.',
      evidence: 'TCP 25 is open.',
      recommendation:
        'Restrict SMTP to mail servers, require authentication/TLS, and disable open relay.',
      severity: 'medium',
      riskScore: 5.8,
    });
  }

  if (ports.has(139)) {
    push(issues, {
      id: 'NX-NETBIOS',
      title: 'NetBIOS session service exposed',
      description:
        'TCP 139 is legacy Windows file sharing. Prefer SMB over 445 with signing, or disable NetBIOS.',
      evidence: 'TCP 139 is open.',
      recommendation: 'Disable NetBIOS over TCP/IP if SMBv2/3 over 445 is enough.',
      severity: 'medium',
      riskScore: 5.7,
    });
  }

  if (ports.has(389) && !ports.has(636)) {
    push(issues, {
      id: 'NX-LDAP',
      title: 'LDAP without LDAPS',
      description:
        'Cleartext LDAP can expose directory binds (NIST SP 800-53 IA-5 / SC-8).',
      evidence: 'TCP 389 is open; TCP 636 is not open in this check.',
      recommendation: 'Require LDAPS (636) or StartTLS and block plaintext binds.',
      severity: 'high',
      riskScore: 7.0,
    });
  }

  if (ports.has(5900)) {
    push(issues, {
      id: 'NX-VNC',
      title: 'VNC remote desktop exposed',
      description:
        'VNC is often weakly authenticated. Treat an open 5900 as a remote-access risk, not a CVE by itself.',
      evidence: 'TCP 5900 is open.',
      recommendation:
        'Disable VNC or tunnel it over VPN/SSH and require strong auth.',
      severity: 'high',
      riskScore: 7.2,
    });
  }

  if (ports.has(3389)) {
    push(issues, {
      id: 'NX-RDP',
      title: 'RDP listener exposed',
      description:
        'TCP 3389 is reachable from the scanner. Restrict RDP to management networks and require NLA.',
      evidence: 'TCP 3389 is open.',
      recommendation:
        'Limit RDP with firewall/VPN, enable Network Level Authentication, and keep the host patched.',
      severity: 'medium',
      riskScore: 6.5,
    });
  }

  if (ports.has(5985)) {
    push(issues, {
      id: 'NX-WINRM',
      title: 'WinRM over HTTP exposed',
      description:
        'WinRM on 5985 is unencrypted unless you force HTTPS/5986.',
      evidence: 'TCP 5985 is open.',
      recommendation:
        'Prefer WinRM HTTPS (5986), restrict source IPs, and avoid exposing WinRM on workstations.',
      severity: 'high',
      riskScore: 7.2,
    });
  }

  if (ports.has(1433)) {
    push(issues, {
      id: 'NX-MSSQL',
      title: 'SQL Server listener exposed',
      description:
        'Database ports should not be reachable from general clinic LAN segments.',
      evidence: 'TCP 1433 is open.',
      recommendation:
        'Bind SQL Server to management networks, require encryption, and use strong logins.',
      severity: 'high',
      riskScore: 7.6,
    });
  }

  if (ports.has(3306)) {
    push(issues, {
      id: 'NX-MYSQL',
      title: 'MySQL/MariaDB listener exposed',
      description: 'Database ports belong on a restricted segment, not the front desk LAN.',
      evidence: 'TCP 3306 is open.',
      recommendation: 'Firewall 3306, require TLS, and disable anonymous accounts.',
      severity: 'high',
      riskScore: 7.5,
    });
  }

  if (ports.has(5432)) {
    push(issues, {
      id: 'NX-PG',
      title: 'PostgreSQL listener exposed',
      description: 'PostgreSQL should not be open to the scanned clinic range.',
      evidence: 'TCP 5432 is open.',
      recommendation: 'Restrict 5432 and require SSL in pg_hba.conf.',
      severity: 'high',
      riskScore: 7.5,
    });
  }

  if (ports.has(6379)) {
    push(issues, {
      id: 'NX-REDIS',
      title: 'Redis listener exposed',
      description:
        'Redis is often deployed without authentication. Treat an open 6379 as a misconfiguration.',
      evidence: 'TCP 6379 is open.',
      recommendation: 'Bind Redis to localhost/VPN, require AUTH, and enable TLS.',
      severity: 'critical',
      riskScore: 9.0,
    });
  }

  if (ports.has(27017)) {
    push(issues, {
      id: 'NX-MONGO',
      title: 'MongoDB listener exposed',
      description: 'MongoDB on 27017 is a common unauthenticated data store.',
      evidence: 'TCP 27017 is open.',
      recommendation: 'Require auth/TLS and do not expose MongoDB to the clinic LAN.',
      severity: 'critical',
      riskScore: 9.0,
    });
  }

  if (ports.has(9100)) {
    push(issues, {
      id: 'NX-JETDIRECT',
      title: 'Raw printer port exposed',
      description:
        'TCP 9100 can accept print jobs from any host that can reach the printer.',
      evidence: 'TCP 9100 is open.',
      recommendation:
        'Segment printers, disable unused protocols, and set an admin password.',
      severity: 'low',
      riskScore: 3.8,
    });
  }

  return issues.sort((left, right) => right.riskScore - left.riskScore);
}

export function nistQualitative(severity: AssessmentIssue['severity']): string {
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
