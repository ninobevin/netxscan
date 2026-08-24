import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isTargetAuthorized,
  ipv4ToInt,
  parseAuthorizedTarget,
  parseCidr,
  parseRangeList,
} from '../src/nmap/authorize';

const RANGES = ['192.168.10.0/24', '10.0.0.0/16'];

describe('authorized network parsing', () => {
  it('accepts CIDR prefixes from /16 to /32', () => {
    assert.ok(parseCidr('192.168.10.0/24'));
    assert.ok(parseCidr('10.0.0.0/16'));
    assert.ok(parseCidr('192.168.10.5/32'));
    assert.equal(parseCidr('10.0.0.0/15'), null);
    assert.equal(parseCidr('10.0.0.0/8'), null);
    assert.equal(parseCidr('not-an-ip/24'), null);
  });

  it('authorizes hosts inside listed ranges only', () => {
    assert.equal(isTargetAuthorized('192.168.10.20', RANGES), true);
    assert.equal(isTargetAuthorized('192.168.11.1', RANGES), false);
    assert.equal(isTargetAuthorized('8.8.8.8', RANGES), false);
    assert.equal(isTargetAuthorized('10.0.255.1', RANGES), true);
    assert.equal(isTargetAuthorized('10.1.0.1', RANGES), false);
  });

  it('authorizes a CIDR only when it sits fully inside an allowed range', () => {
    assert.equal(isTargetAuthorized('192.168.10.0/25', RANGES), true);
    assert.equal(isTargetAuthorized('192.168.10.0/23', RANGES), false);
    assert.equal(isTargetAuthorized('0.0.0.0/16', RANGES), false);
  });

  it('rejects empty range lists and malformed targets', () => {
    assert.equal(isTargetAuthorized('192.168.10.1', []), false);
    assert.equal(parseAuthorizedTarget('192.168.10.1'), '192.168.10.1');
    assert.equal(parseAuthorizedTarget(' 10.0.0.0/16 '), '10.0.0.0/16');
    assert.equal(parseAuthorizedTarget('example.com'), null);
    assert.equal(ipv4ToInt('256.0.0.1'), null);
  });

  it('parses authorized-networks.json shape', () => {
    assert.deepEqual(parseRangeList({ ranges: ['192.168.1.0/24'] }), [
      '192.168.1.0/24',
    ]);
    assert.equal(parseRangeList({ ranges: ['10.0.0.0/8'] }), null);
    assert.equal(parseRangeList({ ranges: '192.168.1.0/24' }), null);
  });
});
