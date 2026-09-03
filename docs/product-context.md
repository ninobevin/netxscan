# NetXScan — product context (rebuild)

Source of truth for the current rebuild. Later modules will append here. Stack: Electron Forge, Vite, React, TypeScript, Tailwind, secure IPC (`window.netxscan` only). Renderer has no Node.

**This pass:** Authentication, Scanning, Asset Manager, shadcn UI.  
**Not this pass:** nmap, NVD, findings, company profile, audit, PowerShell assessment scripts.

## Background

The app is a clinic network inventory. It runs on a **domain-administrator** Windows workstation, so domain-joined PCs can be reached with PowerShell remoting (`Enter-PSSession -ComputerName …`) using the logged-on account.

- **Domain-joined** assets: WinRM / PowerShell remoting for accessibility (and later, uniform assessment scripts).
- **Not domain-joined** (cameras, NVR, switches, firewalls, workgroup PCs): this pass only stores them and shows WinRM as not OK. **Nmap** (ports/services) comes later.
- Assessment scripts will share a **uniform return shape**. That module is specified later; do not invent script runners now.

## Asset categories

Each category has a **lucide-react** icon shown next to the name (filter, table, group headers, add/edit dialogs). Uncategorized uses `CircleDashed`.

Built-in (seeded, not deleted by the app):

| Category | Lucide icon |
|---|---|
| Workstation (PC) | `Monitor` |
| Workstation (Laptop) | `Laptop` |
| CCTV Camera | `Cctv` |
| NVR | `HardDrive` |
| Managed Switch | `Network` |
| Firewall | `Shield` |

Administrators can **add** more categories: name plus an icon chosen from a small allowlist (`Monitor`, `Laptop`, `Cctv`, `HardDrive`, `Network`, `Shield`, `Printer`, `Server`, `Router`, `Smartphone`, `Radio`, `Tag`). Default for a custom category is `Tag`. Category is optional until an admin assigns one.

Store `categories.icon` as the lucide export name string. Renderer maps that name to a component; unknown names fall back to `Tag`.

## Roles

| | Administrator | IT support |
|---|---|---|
| Sign in | Yes | Yes |
| Run scan (`ping -a` + WinRM/OS probe) | Yes | Yes |
| Add selected scan rows to Asset Manager | Yes | Yes (create only) |
| View Asset Manager (filter, group, paginate) | Yes | Yes |
| Edit category and other asset properties | Yes | No |
| Add categories | Yes | No |
| Delete assets | Yes | No |
| Check accessibility on selected assets (may start WinRM) | Yes | No |
| Later: run vulnerability assessment | Yes | Yes (planned) |

Bootstrap users (password hashes in SQLite, never plaintext in git):

- `admin` / `Admin123!` — administrator
- `support` / `Support123!` — IT support

Session lives **in memory** in the main process. Renderer uses `getSession` (and a light poll). No session cookie in Chromium storage as the source of truth.

## Asset properties (WinRM and OS)

Every live host (scan) and every accessibility run (Asset Manager) should record:

- **WinRM / remoting accessible** (`winrm_ok`): whether PowerShell remoting answers.
- **OS version** (`os_version`): Windows caption/version string when remoting works (for example from `Win32_OperatingSystem`). Null/empty when remoting fails or the device is not Windows.

These fields are part of the saved asset row, not a separate module.

**Scan vs Asset Manager**

- **Scan:** after `ping -a` finds a live host, **probe only** (do not start the WinRM service). Push `winrm_ok` and `os_version` on the in-memory row. Persist them when the user adds the row to Asset Manager.
- **Asset Manager (admin):** for **checked** assets, probe; if remoting is down, **try to start WinRM** (`sc.exe \\ComputerName start WinRM` or equivalent); probe again; write `winrm_ok` and `os_version`.

## Module 1 — Authentication

SQLite file: `%APPDATA%\NetXScan\netxscan.sqlite` (sql.js WASM; no Visual Studio / node-gyp).

IPC: `auth:login`, `auth:logout`, `auth:get-session`.  
Payloads validated in main. Failures: `{ ok: false, error }`. Success login: `{ ok: true, session }` where session is `{ username, role }` only (no hash).

Other feature IPC requires an active session. Mutating asset/category/WinRM handlers require `administrator`.

## Module 2 — Scanning

- User enters a **single IP**, **hostname**, **CIDR**, or **IP range**. **No authorized-network allowlist.**
- Main expands IPv4 targets and pings with Windows **`ping -a`** (concurrency cap). Live hosts are pushed to the UI (`scan:host-found`) including hostname, WinRM probe result, and OS version when known.
- Hostname: NetBIOS/DNS name from `ping -a` when present; otherwise show the IP.
- Scan results are **session memory only**. Closing the view or running a new scan replaces the list. **Nothing is written to SQLite until the user adds to Asset Manager.**
- Multi-select + **Add to Asset Manager**. Existing IPv4 rows are skipped. New rows copy ip, hostname, `winrm_ok`, `os_version`; `category_id` stays null.

IPC: `scan:run`, `scan:host-found` (push), `scan:add-to-assets`.

## Module 3 — Asset Manager

List of **saved** assets only.

### Table UX

- **Checkbox** per row. Header **select all** for the current page. Additional **Select all matching filter** so accessibility can run on the full filtered set, not only the visible page.
- **Filter by category** (including Uncategorized).
- **Group by subnet** using IPv4 `/24` (first three octets). Groups are collapsible.
- **Pagination** with a **variable page size** (10 / 25 / 50 / 100) so large inventories stay readable. Filter and grouping apply to the full list; the page is a window over that result.

Columns: select, IP, hostname, category (icon + label), OS version, WinRM icon, timestamps as needed.

- Admin: change category, add category (name + icon picker), delete, **Check accessibility** (runs only on selected ids).
- IT support: same browse/filter/group/paginate; no property writes, no accessibility button.

### Check accessibility (admin, selected assets)

IPC payload is an **array of asset ids** (from checkboxes / select all). Empty selection does nothing.

For each selected asset, using the domain-admin desktop session:

1. Probe whether WinRM / remoting answers.
2. If not, try to start the WinRM service on that computer.
3. Probe again. If remoting works, set `winrm_ok`, read **OS version**, save both on the asset.
4. If remoting still fails, set `winrm_ok` false; leave `os_version` unchanged or clear it only if you never had a successful read this run (prefer keep last known OS if the host is merely offline).

Progress: `assets:winrm-progress` push events (per-row loading). Non-domain or unreachable hosts stay not-OK. Do not add nmap here.

IPC: `asset:list`, `asset:update` (admin), `asset:delete` (admin), `category:list`, `category:add` (admin, name + icon), `assets:check-accessibility` (admin, selected ids), `assets:winrm-progress` (push).

## UI

- **shadcn/ui** + **lucide-react** + loading **skeletons** / short view-switch transition.
- Keep the clinic teal palette via CSS variables (light theme).
- After login: nav **Scanning** | **Asset Manager**, user chip, Sign out.
- Login view if there is no session.

## Architecture rules

```
React  →  window.netxscan  →  preload invoke/on  →  ipcMain  →  SQLite / ping / PowerShell
```

- `contextIsolation`, `sandbox`, no `nodeIntegration`.
- Channel names in `src/shared/ipc-channels.ts`; types on `NetXScanApi`; handlers in `src/<domain>/register-*-ipc.ts`; register from `src/ipc/register-handlers.ts`.
- Spawn `ping` and PowerShell **only in main**.

## Data (SQLite)

- `users` — username unique, password_hash, role (`administrator` | `it_support`)
- `categories` — name unique, icon (lucide name); six seeds with the icons above
- `assets` — ipv4 unique, hostname nullable, category_id nullable FK, winrm_ok, os_version nullable, created_at, updated_at

## Later (do not build now)

Nmap for non-domain devices, uniform PowerShell assessment return, NVD/findings, company profile, audit trail.
