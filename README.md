# NetXScan

Dental clinic network-based IT asset inventory.

Current build: Electron Forge, React, Tailwind, secure IPC, login, SQLite or MySQL, asset inventory, authorized Nmap ping and discovery, TLS/SMB service assessment, and an audit trail.

Requires Node.js and Nmap for scans. MySQL is optional.

```bash
nvm use 24.6.0
npm install
npm start
```

On first launch, NetXScan writes `%APPDATA%\NetXScan\database.json` with `"engine": "sqlite"` and creates `%APPDATA%\NetXScan\netxscan.sqlite`. To use MySQL instead, copy [config/database.example.json](config/database.example.json), set `engine` to `mysql`, and fill in host, user, and password. Do not omit `engine` while leaving a MySQL `host` if you intend to stay on SQLite — a configured MySQL host is never auto-switched to SQLite when the server is down.

The app creates inventory, assessment, scan history, and audit tables. Unused tables from earlier modules may still exist after migration. Connection settings stay in that local file, not in source control.

Bootstrap accounts (password hashes in the database, not plaintext):

- `admin` / `Admin123!` (administrator)
- `support` / `Support123!` (IT support)

Edit `%APPDATA%\NetXScan\authorized-networks.json` so it lists only networks you are allowed to assess (CIDR `/16` to `/32`). Example: [config/authorized-networks.example.json](config/authorized-networks.example.json). The UI cannot pass extra Nmap flags.

Company name and logo are a profile in `%APPDATA%\NetXScan\company.json`. Uploaded logos are stored in `%APPDATA%\NetXScan\logo\` (PNG, JPEG, or WebP, max 1 MB). Example config: [config/company.example.json](config/company.example.json). A logo placeholder lives in [logo/](logo/). Administrators can change this on the Settings page.

The Audit page lists recent important actions (sign-in, scans, assessments). It does not store passwords.

After main-process IPC changes, type `rs` in the `npm start` terminal.
