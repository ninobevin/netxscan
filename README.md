# NetXScan

Dental clinic Network-Based IT Asset Inventory and Vulnerability Management System.

Current build (Modules 1–18): Electron Forge, React, Tailwind, secure IPC, login, SQLite or MySQL, asset inventory, authorized Nmap discovery, TLS/SMB checks, local Windows PowerShell collection, authorized remote WinRM, Windows Credential Manager, a CVE catalog, evidence-based catalog correlation, findings with status and notes, a dashboard, an audit trail, HTML reports (inventory, findings, assessments, scans, remediation, audit), and automated tests (`npm test`).

Requires Node.js and Nmap for scans. MySQL is optional.

```bash
nvm use 24.6.0
npm install
npm test
npm start
```

On first launch, NetXScan writes `%APPDATA%\NetXScan\database.json` with `"engine": "sqlite"` and creates `%APPDATA%\NetXScan\netxscan.sqlite`. To use MySQL instead, copy [config/database.example.json](config/database.example.json), set `engine` to `mysql`, and fill in host, user, and password. Do not omit `engine` while leaving a MySQL `host` if you intend to stay on SQLite — a configured MySQL host is never auto-switched to SQLite when the server is down.

The app creates `users`, `assets`, `asset_services`, `asset_assessments`, `windows_assessments`, `cves`, `cve_imports`, `correlation_runs`, `correlation_matches`, `findings`, `scan_history`, and `audit_log` tables. Connection settings stay in that local file, not in source control.

Bootstrap accounts (password hashes in the database, not plaintext):

- `admin` / `Admin123!` (administrator)
- `support` / `Support123!` (IT support)

Edit `%APPDATA%\NetXScan\authorized-networks.json` so it lists only networks you are allowed to assess (CIDR `/16` to `/32`). Example: [config/authorized-networks.example.json](config/authorized-networks.example.json). The UI cannot pass extra Nmap flags.

Company name and logo are a profile in `%APPDATA%\NetXScan\company.json`. Uploaded logos are stored in `%APPDATA%\NetXScan\logo\` (PNG, JPEG, or WebP, max 1 MB). Example config: [config/company.example.json](config/company.example.json). A logo placeholder lives in [logo/](logo/). Administrators can change this on the Settings page.

Remote Windows collection uses WinRM. Leave the credential empty to use the Windows account that launched the app, or save a generic credential on the Credentials page (Windows Credential Manager). Passwords are not stored in SQLite or MySQL.

CVE catalog JSON shape for offline import:

```json
{
  "cves": [
    {
      "id": "CVE-2021-44228",
      "title": "Example",
      "description": "Catalog text only.",
      "severity": "critical",
      "cvss": 10,
      "published": "2021-12-10",
      "products": ["log4j"]
    }
  ]
}
```

Correlation matches catalog `products` to evidence: SMBv1 advertised (not port 445), OpenSSL in a TLS certificate or a versioned Nmap product (not port 443), Windows software names such as Log4j or Exchange Server, and other product tokens of five or more characters that appear in software or a versioned service product. HTTP/2 catalog entries are skipped until HTTP/2 facts exist.

Findings are created from correlation matches (one record per asset and CVE). Status values are Open, Acknowledged, In Progress, Resolved, Accepted Risk, and False Positive. Resolved findings that match again are reopened. Accepted risk and false positive stay closed. First and last detected dates are stored; resolved time is stored when status becomes Resolved.

The dashboard uses the latest stored ping or discovery scan for online/offline. An asset is online only if that scan reported its IP as up. Open finding counts exclude Resolved, Accepted risk, and False positive.

The Audit page lists recent important actions (sign-in, scans, imports, finding updates). It does not store passwords or Credential Manager secrets.

The Reports page previews and saves HTML files for inventory, findings, assessments, scan history, remediation status, and audit activity. Saving a report is itself audited.

## Testing

`npm test` compiles TypeScript and runs Node’s built-in test runner. Coverage includes CIDR authorization, Nmap XML and TLS/SMB fact parsing, CVE catalog parsing, correlation (open-port-is-not-a-CVE), input validation, bcrypt passwords, session roles, SQLite migrations, login, findings reopen/accepted-risk, audit rows, authorized-network files, and a correlation timing check. Tests do not run Nmap, WinRM, or exploits.

Manual checks that stay in the desktop app:

- Sign in as `admin` and as `support`; confirm Settings and credential changes are admin-only.
- Ping/discovery only against CIDRs in `authorized-networks.json`; a target outside those ranges is rejected.
- Menu labels, loading screen, logo in the header, and report preview.
- After main-process IPC changes, type `rs` in the `npm start` terminal.
