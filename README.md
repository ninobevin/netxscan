# NetXScan

Dental clinic network-based IT asset inventory.

Current build: Electron Forge, React, Tailwind, secure IPC, login, SQLite or MySQL, asset inventory, authorized Windows `ping -a`, and an audit trail.

Requires Node.js. MySQL is optional.

```bash
nvm use 24.6.0
npm install
npm start
```

On first launch, NetXScan writes `%APPDATA%\NetXScan\database.json` with `"engine": "sqlite"` and creates `%APPDATA%\NetXScan\netxscan.sqlite`. To use MySQL instead, copy [config/database.example.json](config/database.example.json), set `engine` to `mysql`, and fill in host, user, and password.

Bootstrap accounts (password hashes in the database, not plaintext):

- `admin` / `Admin123!` (administrator)
- `support` / `Support123!` (IT support)

Edit `%APPDATA%\NetXScan\authorized-networks.json` so it lists only networks you are allowed to ping (CIDR `/16` to `/32`). Example: [config/authorized-networks.example.json](config/authorized-networks.example.json). Ping uses `ping.exe -a`; if no hostname is returned, the IP is stored as the hostname.

Company name and logo are a profile in `%APPDATA%\NetXScan\company.json`. Administrators can change this on the Settings page.

The Audit page lists recent important actions (sign-in, pings). It does not store passwords.

After main-process IPC changes, type `rs` in the `npm start` terminal.
