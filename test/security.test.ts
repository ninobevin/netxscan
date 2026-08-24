import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isTargetAuthorized, parseAuthorizedTarget } from '../src/nmap/authorize';
import { parseCredentialPassword } from '../src/credentials/validate';
import { parseCveDocument } from '../src/cve/parse-cve';

describe('security controls', () => {
  it('does not accept hostnames, URLs, or extra Nmap-style flags as scan targets', () => {
    assert.equal(parseAuthorizedTarget('scanme.nmap.org'), null);
    assert.equal(parseAuthorizedTarget('-sV -A 192.168.1.1'), null);
    assert.equal(parseAuthorizedTarget('192.168.1.1; whoami'), null);
    assert.equal(isTargetAuthorized('127.0.0.1', ['192.168.1.0/24']), false);
  });

  it('does not treat a password as valid when it contains a NUL byte', () => {
    assert.equal(parseCredentialPassword('plain-secret'), 'plain-secret');
    assert.equal(parseCredentialPassword('\0hidden'), null);
  });

  it('rejects a CVE document that is not a catalog object', () => {
    assert.equal(parseCveDocument('<script>alert(1)</script>').ok, false);
    assert.equal(
      parseCveDocument({
        cves: [{ id: 'CVE-2021-44228', title: 'x', severity: 'high' }],
      }).ok,
      false,
    );
  });
});
