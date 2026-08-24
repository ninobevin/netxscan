import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { correlateAssets, type FactBundle } from '../src/correlate/engine';
import type { CveRecord } from '../src/shared/cve-types';

function cve(
  id: string,
  products: string[],
  extras?: Partial<CveRecord>,
): CveRecord {
  return {
    id,
    title: id,
    description: 'catalog only',
    severity: 'high',
    cvss: 7.5,
    published: null,
    products,
    source: 'test',
    importedAt: '2026-01-01T00:00:00.000Z',
    ...extras,
  };
}

function asset(partial: Partial<FactBundle>): FactBundle {
  return {
    assetId: 'asset-1',
    hostname: 'clinic-pc',
    ipAddress: '192.168.10.20',
    services: [],
    tls: null,
    smb: null,
    windows: null,
    ...partial,
  };
}

describe('correlation engine', () => {
  it('does not treat an open HTTPS port as an OpenSSL CVE', () => {
    const matches = correlateAssets(
      [cve('CVE-2014-0160', ['openssl'])],
      [
        asset({
          services: [
            {
              port: 443,
              protocol: 'tcp',
              serviceName: 'https',
              product: null,
              version: null,
            },
          ],
          tls: {
            portOpen: true,
            tlsVersions: ['TLSv1.2'],
            ciphers: [],
            certificateSubject: 'CN=clinic.local',
            certificateIssuer: 'CN=Clinic CA',
            certificateExpires: null,
          },
        }),
      ],
    );
    assert.deepEqual(matches, []);
  });

  it('matches OpenSSL from certificate text or a versioned product', () => {
    const fromCert = correlateAssets(
      [cve('CVE-2014-0160', ['openssl'])],
      [
        asset({
          tls: {
            portOpen: true,
            tlsVersions: [],
            ciphers: [],
            certificateSubject: 'CN=openssl-test',
            certificateIssuer: 'CN=CA',
            certificateExpires: null,
          },
        }),
      ],
    );
    assert.equal(fromCert.length, 1);

    const fromProduct = correlateAssets(
      [cve('CVE-2014-0160', ['openssl'])],
      [
        asset({
          services: [
            {
              port: 443,
              protocol: 'tcp',
              serviceName: 'https',
              product: 'OpenSSL',
              version: '1.0.1f',
            },
          ],
        }),
      ],
    );
    assert.equal(fromProduct.length, 1);
    assert.match(fromProduct[0]?.evidence ?? '', /1\.0\.1f/);
  });

  it('matches SMBv1 advertisement, not an open 445 port', () => {
    const openPort = correlateAssets(
      [cve('CVE-2017-0144', ['smb'])],
      [
        asset({
          services: [
            {
              port: 445,
              protocol: 'tcp',
              serviceName: 'microsoft-ds',
              product: null,
              version: null,
            },
          ],
          smb: { portOpen: true, dialects: [], smbv1Advertised: false },
        }),
      ],
    );
    assert.deepEqual(openPort, []);

    const smbv1 = correlateAssets(
      [cve('CVE-2017-0144', ['smb'])],
      [
        asset({
          smb: {
            portOpen: true,
            dialects: ['NT LM 0.12'],
            smbv1Advertised: true,
          },
        }),
      ],
    );
    assert.equal(smbv1.length, 1);
    assert.match(smbv1[0]?.evidence ?? '', /SMBv1/);
  });

  it('matches Log4j from Windows software and skips HTTP/2 catalog entries', () => {
    const log4j = correlateAssets(
      [cve('CVE-2021-44228', ['log4j'])],
      [
        asset({
          windows: {
            hostname: 'clinic-pc',
            ipAddresses: ['192.168.10.20'],
            operatingSystem: 'Windows 10',
            osVersion: null,
            domain: null,
            cpu: null,
            ramGb: null,
            disks: [],
            software: [
              {
                name: 'Apache Log4j',
                version: '2.14.1',
                key: null,
                canUninstall: false,
              },
            ],
            updates: [],
            firewall: [],
            defenderEnabled: null,
            defenderRealtime: null,
            bitlocker: [],
          },
        }),
      ],
    );
    assert.equal(log4j.length, 1);

    const http2 = correlateAssets(
      [cve('CVE-2023-44487', ['http2'])],
      [
        asset({
          services: [
            {
              port: 443,
              protocol: 'tcp',
              serviceName: 'https',
              product: 'nginx',
              version: '1.24.0',
            },
          ],
        }),
      ],
    );
    assert.deepEqual(http2, []);
  });

  it('matches TLS catalog entries from legacy versions or weak ciphers, not an open 443 port', () => {
    const openOnly = correlateAssets(
      [cve('CVE-2014-3566', ['tls'])],
      [
        asset({
          tls: {
            portOpen: true,
            tlsVersions: ['TLSv1.2'],
            ciphers: ['TLS_AES_128_GCM_SHA256'],
            certificateSubject: 'CN=clinic.local',
            certificateIssuer: 'CN=CA',
            certificateExpires: null,
          },
        }),
      ],
    );
    assert.deepEqual(openOnly, []);

    const legacy = correlateAssets(
      [cve('CVE-2014-3566', ['tls'])],
      [
        asset({
          tls: {
            portOpen: true,
            tlsVersions: ['TLSv1.0', 'TLSv1.2'],
            ciphers: [],
            certificateSubject: 'CN=clinic.local',
            certificateIssuer: 'CN=CA',
            certificateExpires: null,
          },
        }),
      ],
    );
    assert.equal(legacy.length, 1);
    assert.match(legacy[0]?.evidence ?? '', /TLSv1\.0/);
  });

  it('matches SMB signing CVEs only when signing is not required', () => {
    const required = correlateAssets(
      [cve('CVE-2016-2118', ['smbsign'])],
      [
        asset({
          smb: {
            portOpen: true,
            dialects: ['3.1.1'],
            smbv1Advertised: false,
            signingRequired: true,
          },
        }),
      ],
    );
    assert.deepEqual(required, []);

    const optional = correlateAssets(
      [cve('CVE-2016-2118', ['smbsign'])],
      [
        asset({
          smb: {
            portOpen: true,
            dialects: ['3.1.1'],
            smbv1Advertised: false,
            signingRequired: false,
          },
        }),
      ],
    );
    assert.equal(optional.length, 1);
  });
});
