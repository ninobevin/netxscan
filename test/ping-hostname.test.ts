import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parsePingAHostname } from '../src/nmap/ping-hostname';

describe('ping -a hostname parsing', () => {
  it('reads the name from English Windows ping -a output', () => {
    const output = `Pinging server.clinic.local [192.168.1.100] with 32 bytes of data:
Reply from 192.168.1.100: bytes=32 time=1ms TTL=128`;
    assert.equal(
      parsePingAHostname(output, '192.168.1.100'),
      'server.clinic.local',
    );
  });

  it('returns null when ping did not resolve a hostname', () => {
    const output = `Pinging 192.168.1.100 with 32 bytes of data:
Reply from 192.168.1.100: bytes=32 time=1ms TTL=128`;
    assert.equal(parsePingAHostname(output, '192.168.1.100'), null);
    assert.equal(
      parsePingAHostname(
        'Pinging other.local [10.0.0.1] with 32 bytes of data:',
        '192.168.1.100',
      ),
      null,
    );
  });
});
