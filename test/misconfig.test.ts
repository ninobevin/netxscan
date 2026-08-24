import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { evaluateMisconfigurations } from '../src/assess/misconfig';

describe('service misconfiguration rules', () => {
  it('flags SMBv1, legacy TLS, weak ciphers, and cleartext services', () => {
    const issues = evaluateMisconfigurations({
      tls: {
        portOpen: true,
        tlsVersions: ['TLSv1.0', 'TLSv1.2'],
        ciphers: ['TLS_RSA_WITH_RC4_128_SHA', 'TLS_AES_128_GCM_SHA256'],
        certificateSubject: 'CN=clinic',
        certificateIssuer: 'CN=CA',
        certificateExpires: null,
      },
      smb: {
        portOpen: true,
        dialects: ['NT LM 0.12', '2.02'],
        smbv1Advertised: true,
      },
      openPorts: [21, 23, 80, 3389, 443, 445],
      services: [],
    });
    const ids = issues.map((item) => item.id);
    assert.ok(ids.includes('NX-SMBV1'));
    assert.ok(ids.includes('NX-TLS-LEGACY'));
    assert.ok(ids.includes('NX-TLS-CIPHER'));
    assert.ok(ids.includes('NX-TELNET'));
    assert.ok(ids.includes('NX-FTP'));
    assert.ok(ids.includes('NX-RDP'));
    assert.equal(
      issues.find((item) => item.id === 'NX-SMBV1')?.severity,
      'critical',
    );
  });

  it('flags expired certs, optional SMB signing, and extra service ports', () => {
    const issues = evaluateMisconfigurations({
      tls: {
        portOpen: true,
        tlsVersions: ['TLSv1.2'],
        ciphers: ['TLS_AES_128_GCM_SHA256'],
        certificateSubject: 'CN=clinic.local',
        certificateIssuer: 'CN=clinic.local',
        certificateExpires: '2001-01-01T00:00:00.000Z',
      },
      smb: {
        portOpen: true,
        dialects: ['3.1.1'],
        smbv1Advertised: false,
        signingRequired: false,
      },
      openPorts: [110, 143, 389, 1433, 3306, 5985, 6379, 8080, 9100, 27017],
      services: [],
    });
    const ids = issues.map((item) => item.id);
    assert.ok(ids.includes('NX-TLS-EXPIRED'));
    assert.ok(ids.includes('NX-TLS-SELF'));
    assert.ok(ids.includes('NX-SMB-SIGN'));
    assert.ok(ids.includes('NX-LDAP'));
    assert.ok(ids.includes('NX-WINRM'));
    assert.ok(ids.includes('NX-REDIS'));
    assert.ok(ids.includes('NX-MONGO'));
    assert.ok(ids.includes('NX-JETDIRECT'));
  });

  it('does not treat an open 445 port without SMBv1 as a finding', () => {
    const issues = evaluateMisconfigurations({
      tls: {
        portOpen: false,
        tlsVersions: [],
        ciphers: [],
        certificateSubject: null,
        certificateIssuer: null,
        certificateExpires: null,
      },
      smb: { portOpen: true, dialects: ['2.02'], smbv1Advertised: false },
      openPorts: [445],
      services: [],
    });
    assert.deepEqual(issues, []);
  });
});
