# NetXScan — product context (rebuild)

Source of truth for the current rebuild. Later modules will append here. Stack: Electron Forge, Vite, React, TypeScript, Tailwind, secure IPC (`window.netxscan` only). Renderer has no Node.

**This pass:** Authentication, Scanning, Asset Manager, shadcn UI.  
**Not this pass:** NVD, findings, company profile, audit, PowerShell assessment scripts. Nmap in Scanning is host discovery only (no ports). Nmap is also a MAC fallback on Check accessibility.

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

Administrators can **add** more device types: name plus an icon from the allowlist. Default icon is `Tag`. Device type is optional until an admin assigns one.

Store `categories.icon` as the lucide export name (table name unchanged). Unknown names fall back to `Tag`.

## Locations

Administrators add location names (clinic, floor, room). Each asset may have one `location_id`. IT support can view but not add or assign.

## Roles

| | Administrator | IT support |
|---|---|---|
| Sign in | Yes | Yes |
| Run scan (Quick ping / Deep nmap host discovery) | Yes | Yes |
| Add selected scan rows to Asset Manager | Yes | Yes (create only) |
| View Asset Manager (filter, group, paginate) | Yes | Yes |
| Edit device, location, and other properties | Yes | No |
| Add device types and locations | Yes | No |
| Delete assets | Yes | No |
| Check accessibility on selected assets (may start WinRM) | Yes | No |
| Later: run vulnerability assessment | Yes | Yes (planned) |

Bootstrap users (password hashes in SQLite, never plaintext in git):

- `admin` / `Admin123!` — administrator
- `support` / `Support123!` — IT support

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

IPC: `auth:login`, `auth:logout`, `auth:get-session`.  
Payloads validated in main. Failures: `{ ok: false, error }`. Success login: `{ ok: true, session }` where session is `{ username, role }` only (no hash).

Other feature IPC requires an active session. Mutating asset/category/WinRM handlers require `administrator`.

## Module 2 — Scanning

- User enters a **single IP**, **hostname**, **CIDR**, or **IP range**. **No authorized-network allowlist.**
- **Quick scan:** Main expands IPv4 targets and pings with Windows **`ping -a`** (concurrency cap).
- **Deep scan:** One **nmap** host-discovery process (`-sn`, ARP + TCP ping probes). Finds hosts that do not answer ICMP. No port scan, OS, or MAC. nmap must be on PATH.
- Live hosts are pushed to the UI (`scan:host-found`) with IP and hostname only.
- Hostname: from `ping -a` on Quick; from nmap PTR/name on Deep when present; otherwise show the IP.
- Scan results are **session memory only**. Closing the view or running a new scan replaces the list. **Nothing is written to SQLite until the user adds to Asset Manager.**
- Multi-select + **Add to Asset Manager**. Existing IPv4 rows are skipped. New rows copy ip and hostname; `winrm_ok` is false, `os_version` is null, `category_id` stays null.

IPC: `scan:run` (`target` + `mode`: `ping` | `nmap`), `scan:host-found` (push), `scan:add-to-assets`.

## Module 3 — Asset Manager

List of **saved** assets only.

### Table UX

- **Checkbox** per row. Header **select all** for the current page. Additional **Select all matching filter** so accessibility can run on the full filtered set, not only the visible page.
- **Filter by device** and **location** (including none).
- **Group by subnet** using IPv4 `/24` (first three octets). Groups are collapsible.
- **Pagination** with a **variable page size** (10 / 25 / 50 / 100) so large inventories stay readable. Filter and grouping apply to the full list; the page is a window over that result.

Columns: select, IP, hostname, MAC, device (icon + label), location, OS version, WinRM icon.

- Admin: assign device and location, add device/location, delete, **Check accessibility** (selected ids).
- IT support: browse/filter/group/paginate; no property writes, no accessibility button.

### Check accessibility (admin, selected assets)

IPC payload is an **array of asset ids**. Empty selection does nothing.

For each selected asset:

1. Probe WinRM; if down, try to start the service; probe again.
2. If remoting works: set `winrm_ok`, save OS and MAC from the remote host.
3. If remoting fails: set `winrm_ok` false; keep last OS; run **nmap** (`-sn`) on the IPv4 and save MAC if reported (same LAN typical). nmap must be on PATH.
4. If nmap has no MAC, keep last `mac_address`.

Progress: `assets:winrm-progress`.

IPC: `asset:list`, `asset:update` (admin, device and location), `asset:delete` (admin), `category:list`, `category:add`, `location:list`, `location:add` (admin), `assets:check-accessibility`, `assets:winrm-progress`.

## UI

- **shadcn/ui** + **lucide-react** + loading **skeletons** / short view-switch transition.
- Keep the clinic teal palette via CSS variables (light theme).
- After login: nav **Scanning** | **Asset Manager**, user chip, Sign out.
- Login view if there is no session.

## Architecture rules

```
React  →  window.netxscan  →  preload invoke/on  →  ipcMain  →  SQLite / ping / nmap / PowerShell
```

- `contextIsolation`, `sandbox`, no `nodeIntegration`.
- Channel names in `src/shared/ipc-channels.ts`; types on `NetXScanApi`; handlers in `src/<domain>/register-*-ipc.ts`; register from `src/ipc/register-handlers.ts`.
- Spawn `ping`, PowerShell, and **nmap** (scan discovery + MAC fallback) **only in main**.

## Data (SQLite)

- `users` — username unique, password_hash, role (`administrator` | `it_support`)
- `categories` — name unique, icon (lucide name); six seeds with the icons above (UI label: Device)
- `locations` — name unique (user-defined)
- `assets` — ipv4 unique, hostname nullable, mac_address nullable, category_id nullable FK, location_id nullable FK, winrm_ok, os_version nullable, created_at, updated_at

## Later (do not build now)

Nmap ports/OS module, NVD/findings, company profile, audit trail.
