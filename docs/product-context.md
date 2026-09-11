# NetXScan — product context (rebuild)

Source of truth for the current rebuild. Later modules will append here. Stack: Electron Forge, Vite, React, TypeScript, Tailwind, secure IPC (`window.netxscan` only). Renderer has no Node.

**This pass:** Authentication, Scanning, Inventory, company Settings, shadcn UI.  
**Not this pass:** NVD, findings as live data, audit, PowerShell assessment scripts. Nmap in Scanning is host discovery only (no ports). Nmap is also a MAC fallback on Check accessibility.

## Background

The app is a clinic network inventory. It runs on a **domain-administrator** Windows workstation, so domain-joined PCs can be reached with PowerShell remoting (`Enter-PSSession -ComputerName …`) using the logged-on account.

- **Domain-joined** assets: WinRM / PowerShell remoting for accessibility (and later, uniform assessment scripts).
- **Not domain-joined** (cameras, NVR, switches, firewalls, workgroup PCs): this pass only stores them and shows WinRM as not OK. **Nmap** (ports/services) comes later.
- Assessment scripts will share a **uniform return shape**. That module is specified later; do not invent script runners now.

## Device types

Each **device** type has a **lucide-react** icon shown next to the name (filter, table, dialogs). No device uses `CircleDashed`.

Built-in (seeded, not deleted by the app):

| Device | Lucide icon |
|---|---|
| Workstation (PC) | `Monitor` |
| Workstation (Laptop) | `Laptop` |
| CCTV Camera | `Cctv` |
| NVR | `HardDrive` |
| Managed Switch | `Network` |
| Firewall | `Shield` |

Administrators can **add, edit, and delete** device types from an Inventory dialog (name plus an icon from the allowlist). Default icon is `Tag`. Built-in types cannot be deleted. Deleting a custom type clears `category_id` on assets that used it. Device type is optional until an admin assigns one.

Store `categories.icon` as the lucide export name (table name unchanged). Unknown names fall back to `Tag`.

## Locations

Administrators add, edit, and delete location names (clinic, floor, room) from an Inventory dialog. Each asset may have one `location_id`. Deleting a location clears it on assigned assets. User-level accounts can view but not add, edit, delete, or assign.

## Roles

| | Administrator | User |
|---|---|---|
| Sign in | Yes | Yes |
| Run scan (Quick ping / Deep nmap host discovery) | Yes | Yes |
| Add selected scan rows to Asset Manager | Yes | Yes (create only) |
| View Asset Manager (filter, group, paginate) | Yes | Yes |
| Edit device, location, and other properties | Yes | No |
| Add / edit / delete device types and locations | Yes | No |
| View Settings (company profile) | Yes | Yes |
| Edit company profile | Yes | No |
| Manage users (add / edit / delete, set level) | Yes | No |
| Delete assets | Yes | No |
| Check accessibility on selected assets (may start WinRM) | Yes | No |
| Later: run vulnerability assessment | Yes | Yes (planned) |

Bootstrap users (password hashes in SQLite, never plaintext in git):

- `admin` / `Admin123!` — administrator
- `support` / `Support123!` — user

Session lives **in memory** in the main process. Renderer uses `getSession` (and a light poll). No session cookie in Chromium storage as the source of truth.

## Asset properties (WinRM, OS, MAC)

- **WinRM** (`winrm_ok`): remoting answers.
- **OS version** (`os_version`): when WinRM works.
- **MAC** (`mac_address`): from WinRM when remoting works; if not, from **nmap** on that IP (nmap must be on PATH; MAC usually only on the same LAN). Keep last known values if both fail.

**Scan vs Asset Manager**

- **Scan:** Quick = `ping -a`; Deep = nmap host discovery (`-sn`) for ICMP-silent hosts. New Asset Manager rows: `winrm_ok` false, OS/MAC/location/device null.
- **Asset Manager (admin) Check accessibility:** probe WinRM (may start the service); save OS and MAC if remoting works. If not, run nmap for MAC only.

## Module 1 — Authentication

SQLite file: `%APPDATA%\NetXScan\netxscan.sqlite` (sql.js WASM; no Visual Studio / node-gyp).

IPC: `auth:login`, `auth:logout`, `auth:get-session`, `auth:change-password`, `auth:totp-begin`, `auth:totp-confirm`, `auth:forgot-password`.  
Payloads validated in main. Failures: `{ ok: false, error }`. Success login: `{ ok: true, session }` where session is `{ username, role, setupRequired, mustChangePassword, totpEnabled }` (no hash, no TOTP secret).

First launch: only the default administrator (`admin` / `Admin123!`) can sign in until authenticator enrollment exists. After that login the app requires a new password, then a Google Authenticator QR scan and code confirmation. Feature IPC requires a completed setup (`setupRequired` false).

Forgot password on the login screen: username + authenticator code + new password. No session is created until the user signs in again.

Other feature IPC requires an active session with setup complete. Mutating asset/category/WinRM handlers require `administrator`.

## Module 2 — Scanning

- User enters a **single IP**, **hostname**, **CIDR**, or **IP range**. **No authorized-network allowlist.**
- **Quick scan:** Main expands IPv4 targets and pings with Windows **`ping -a`** (concurrency cap).
- **Deep scan:** One **nmap** host-discovery process (`-sn`, ICMP echo plus TCP probes on 80/443/445/3389). Finds hosts that do not answer ICMP when those ports answer. No port scan, OS, or MAC. Uses `nmap.exe` from PATH or `C:\Program Files (x86)\Nmap`.
- Live hosts are pushed to the UI (`scan:host-found`) with IP and hostname only.
- Hostname: from `ping -a` on Quick; from nmap PTR/name on Deep when present; otherwise show the IP.
- Scan results are **session memory only**. Closing the view or running a new scan replaces the list. **Nothing is written to SQLite until the user adds to Asset Manager.**
- Multi-select + **Add to Asset Manager**. Existing IPv4 rows are skipped. New rows copy ip and hostname; `winrm_ok` is false, `os_version` is null, `category_id` stays null.

IPC: `scan:run` (`target` + `mode`: `ping` | `nmap`), `scan:host-found` (push), `scan:add-to-assets`.

## Module 3 — Inventory (saved assets)

UI label **Inventory**. Same SQLite `assets` table and `asset:*` IPC. Administrators assign device (category) and location here.

### Table UX

- **Checkbox** per row. Header **select all** for the current page. Additional **Select all matching filter** so accessibility can run on the full filtered set, not only the visible page.
- **Filter by device** and **location** (including none).
- **Group by subnet** using IPv4 `/24` (first three octets). Groups are collapsible.
- **Pagination** with a **variable page size** (10 / 25 / 50 / 100) so large inventories stay readable. Filter and grouping apply to the full list; the page is a window over that result.

Columns: select, IP, hostname, MAC, device (icon + label), location, OS version, WinRM icon.

- Admin: assign device and location, manage device types and locations in dialogs (add/edit/delete), delete assets, **Check accessibility** (selected ids).
- User: browse/filter/group/paginate; no property writes, no accessibility button.

### Check accessibility (admin, selected assets)

IPC payload is an **array of asset ids**. Empty selection does nothing.

For each selected asset:

1. Probe WinRM; if down, try to start the service; probe again.
2. If remoting works: set `winrm_ok`, save OS and MAC from the remote host.
3. If remoting fails: set `winrm_ok` false; keep last OS; run **nmap** (`-sn`) on the IPv4 and save MAC if reported (same LAN typical). nmap must be on PATH.
4. If nmap has no MAC, keep last `mac_address`.

Progress: `assets:winrm-progress`.

IPC: `asset:list`, `asset:update` (admin, device and location), `asset:delete` (admin), `category:list`, `category:add`, `category:update`, `category:delete`, `location:list`, `location:add`, `location:update`, `location:delete` (admin), `assets:check-accessibility`, `assets:winrm-progress`.

## Module 4 — Settings (company profile and users)

Single-row SQLite `company_profile`. Both roles can view. Administrator saves name, address, contact, and notes.

Administrator manages local accounts: username, password, and level (`administrator` or `user`). Hashes are stored; passwords are never returned to the renderer. Cannot delete your own account or remove the last administrator.

IPC: `company:get`, `company:update` (admin), `user:list`, `user:add`, `user:update`, `user:delete` (admin).

## UI

- **shadcn/ui** + **lucide-react** + loading **skeletons** / short view-switch transition.
- Keep the clinic teal palette via CSS variables (light theme).
- After login: nav **Scanning** | **Inventory** (live device/location assignment) | prototype tabs (Dashboard, Findings, ADHICS, Scripts, Report) | **Settings** (live company profile; admin user management). User menu (avatar) for log out.
- Login view if there is no session.

## Architecture rules

```
React  →  window.netxscan  →  preload invoke/on  →  ipcMain  →  SQLite / ping / nmap / PowerShell
```

- `contextIsolation`, `sandbox`, no `nodeIntegration`.
- Channel names in `src/shared/ipc-channels.ts`; types on `NetXScanApi`; handlers in `src/<domain>/register-*-ipc.ts`; register from `src/ipc/register-handlers.ts`.
- Spawn `ping`, PowerShell, and **nmap** (scan discovery + MAC fallback) **only in main**.

## Data (SQLite)

- `users` — username unique, password_hash, role (`administrator` | `user`), must_change_password, totp_secret, totp_enabled
- `categories` — name unique, icon (lucide name); six seeds with the icons above (UI label: Device)
- `locations` — name unique (user-defined)
- `assets` — ipv4 unique, hostname nullable, mac_address nullable, category_id nullable FK, location_id nullable FK, winrm_ok, os_version nullable, created_at, updated_at
- `company_profile` — single row (`id = 1`): name, address, contact, notes, updated_at

## Later (do not build now)

Nmap ports/OS as a live module, NVD/CVE placement, audit trail, PowerShell script runner. Report/Dashboard still use dummy clinic copy until wired to `company_profile`.

## Prototype GUI (dummy data only)

Renderer-only screens for layout. No new IPC, no SQLite, no NVD, no PowerShell spawn.

- **Inventory** (live): former Asset Manager — assign device and location, Check accessibility. Scanning **Add to Inventory**.
- **Dashboard** — KPI cards, recent ADHICS findings, assets needing attention.
- **Asset detail** (dummy drill-in from Dashboard / Findings / ADHICS): identity, dummy ports, ADHICS findings, script links.
- **Findings** — ADHICS gaps (control ID, title, asset, status). No CVE/CVSS. CVE later.
- **ADHICS** — catalog CRUD (id, domain, description, status) in local state; links to script and findings.
- **Scripts** — multiple stubs per ADHICS control. Add is a dialog. **Control ID** from the catalog. **Run via** WinRM or Nmap. WinRM body uses `Invoke-Command -ComputerName {{ComputerName}}`; the runner replaces `{{ComputerName}}` with each host. Uniform JSON. Local only; not executed. Success save shows a toast.
- **Report** — print-like preview (clinic header, KPIs, top ADHICS findings, gaps, inventory excerpt). No PDF file.

Live later: scripts stored in main (`%APPDATA%\NetXScan\scripts\` + SQLite metadata); WinRM runs them. Do not add that until asked.
