# NetXScan

Dental clinic network-based IT asset inventory.

Current build: Electron Forge, React, Tailwind, secure IPC, login, SQLite or MySQL, Discovery and Asset (authorized `ping -a`), and an audit trail.

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

Edit `%APPDATA%\NetXScan\authorized-networks.json` so it lists only networks you are allowed to scan (CIDR `/16` to `/32`). Example: [config/authorized-networks.example.json](config/authorized-networks.example.json).

On **Discovery and Asset**, enter a CIDR (`192.168.1.0/24`) or an IP range (`192.168.1.10 - 192.168.1.50`) and click Scan. Live hosts are saved as they reply. Hostnames come from Windows `ping -a`; if none is returned, the IP is stored. Delete removes the row so a later scan can add that host again.

After main-process IPC changes, type `rs` in the `npm start` terminal.
