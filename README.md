# NetXScan

Dental clinic network-based IT asset inventory.

Electron Forge, React, Tailwind, [shadcn/ui](https://ui.shadcn.com), secure IPC, SQLite via sql.js (no C++ Build Tools) in `%APPDATA%\NetXScan\netxscan.sqlite`.

```bash
nvm use 24.6.0
npm install
npm start
```

Bootstrap accounts:

- `admin` / `Admin123!` (administrator)
- `support` / `Support123!` (IT support)

After main-process IPC changes, type `rs` in the `npm start` terminal.

Product scope: [docs/product-context.md](docs/product-context.md).

If you ran the previous NetXScan build, delete `%APPDATA%\NetXScan\netxscan.sqlite` once so the new tables (including `os_version` and category icons) can be created.
