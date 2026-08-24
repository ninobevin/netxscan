import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  parseDnsHostname,
  winRmComputerName,
} from '../src/nmap/hostnames';

describe('hostname helpers for discovery and WinRM', () => {
  it('accepts DNS and NetBIOS-style names and rejects IPv4', () => {
    assert.equal(parseDnsHostname('clinic-pc.ad.local'), 'clinic-pc.ad.local');
    assert.equal(parseDnsHostname('FRONTDESK-PC'), 'FRONTDESK-PC');
    assert.equal(parseDnsHostname(' clinic-pc. '), 'clinic-pc');
    assert.equal(parseDnsHostname('192.168.1.100'), null);
    assert.equal(parseDnsHostname('bad name'), null);
    assert.equal(parseDnsHostname('foo..bar'), null);
    assert.equal(parseDnsHostname('-bad'), null);
  });

  it('uses a real hostname for WinRM and falls back to the authorized IP', () => {
    assert.equal(
      winRmComputerName('clinic-pc.ad.local', '192.168.1.100'),
      'clinic-pc.ad.local',
    );
    assert.equal(winRmComputerName('192.168.1.100', '192.168.1.100'), '192.168.1.100');
    assert.equal(winRmComputerName(null, '10.0.0.5'), '10.0.0.5');
    assert.equal(winRmComputerName('not a host', '10.0.0.5'), '10.0.0.5');
  });
});
