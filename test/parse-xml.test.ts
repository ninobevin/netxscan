import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseNmapXml } from '../src/nmap/parse-xml';
import { parseSmbFacts, parseTlsFacts } from '../src/assess/parse-assessment';

const DISCOVERY_XML = `<?xml version="1.0"?>
<nmaprun>
  <host>
    <status state="up" reason="echo-reply"/>
    <address addr="192.168.10.20" addrtype="ipv4"/>
    <address addr="AA:BB:CC:DD:EE:FF" addrtype="mac"/>
    <hostnames><hostname name="clinic-pc" type="PTR"/></hostnames>
    <ports>
      <port protocol="tcp" portid="443">
        <state state="open"/>
        <service name="https" product="nginx" version="1.24.0"/>
      </port>
      <port protocol="tcp" portid="80">
        <state state="closed"/>
        <service name="http"/>
      </port>
    </ports>
  </host>
</nmaprun>`;

const TLS_XML = `<?xml version="1.0"?>
<nmaprun>
  <host>
    <status state="up"/>
    <address addr="192.168.10.20" addrtype="ipv4"/>
    <ports>
      <port protocol="tcp" portid="443">
        <state state="open"/>
        <script id="ssl-enum-ciphers" output="TLSv1.2: TLS_AES_128_GCM_SHA256&#xa;TLSv1.3"/>
        <script id="ssl-cert" output="Subject: CN=clinic.local&#xa;Issuer: CN=OpenSSL Test CA&#xa;Not valid after: 2027-01-01"/>
      </port>
    </ports>
  </host>
</nmaprun>`;

const SMB_XML = `<?xml version="1.0"?>
<nmaprun>
  <host>
    <status state="up"/>
    <address addr="192.168.10.20" addrtype="ipv4"/>
    <ports>
      <port protocol="tcp" portid="445">
        <state state="open"/>
        <script id="smb-protocols" output="NT LM 0.12 (SMBv1)&#xa;2.02"/>
      </port>
    </ports>
  </host>
</nmaprun>`;

describe('Nmap XML parsing', () => {
  it('reads live hosts, MAC, hostname, and open ports only', () => {
    const hosts = parseNmapXml(DISCOVERY_XML);
    assert.equal(hosts.length, 1);
    assert.equal(hosts[0]?.ipAddress, '192.168.10.20');
    assert.equal(hosts[0]?.status, 'up');
    assert.equal(hosts[0]?.hostname, 'clinic-pc');
    assert.equal(hosts[0]?.macAddress, 'AA:BB:CC:DD:EE:FF');
    assert.equal(hosts[0]?.ports.length, 1);
    assert.equal(hosts[0]?.ports[0]?.port, 443);
    assert.equal(hosts[0]?.ports[0]?.product, 'nginx');
    assert.equal(hosts[0]?.ports[0]?.version, '1.24.0');
  });

  it('returns no hosts for empty or host-less XML', () => {
    assert.deepEqual(parseNmapXml(''), []);
    assert.deepEqual(parseNmapXml('<nmaprun></nmaprun>'), []);
  });
});

describe('TLS and SMB fact parsing', () => {
  it('extracts TLS versions, ciphers, and certificate text', () => {
    const tls = parseTlsFacts(TLS_XML);
    assert.equal(tls.portOpen, true);
    assert.ok(tls.tlsVersions.includes('TLSv1.2'));
    assert.ok(tls.ciphers.includes('TLS_AES_128_GCM_SHA256'));
    assert.match(tls.certificateSubject ?? '', /clinic\.local/);
    assert.match(tls.certificateIssuer ?? '', /OpenSSL/);
  });

  it('detects SMBv1 from smb-protocols output, not from the port number alone', () => {
    const smb = parseSmbFacts(SMB_XML);
    assert.equal(smb.portOpen, true);
    assert.equal(smb.smbv1Advertised, true);
    assert.ok(smb.dialects.length > 0);

    const openOnly = parseSmbFacts(
      `<nmaprun><host><ports><port protocol="tcp" portid="445"><state state="open"/></port></ports></host></nmaprun>`,
    );
    assert.equal(openOnly.portOpen, true);
    assert.equal(openOnly.smbv1Advertised, false);
  });
});
