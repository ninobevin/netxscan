import { CheckCircle2, Minus, XCircle } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ASSET_TYPES,
  type Asset,
  type AssetInput,
  type AssetType,
} from '../shared/asset-types';
import type { WinrmAction } from '../shared/winrm-types';
import { BusyButton } from './BusyButton';

const PAGE_SIZE_MIN = 5;
const PAGE_SIZE_MAX = 200;
const PAGE_SIZE_DEFAULT = 25;

function typeLabel(type: AssetType): string {
  if (type === 'virtual_server') {
    return 'Virtual server';
  }

  if (type === 'network_device') {
    return 'Network device';
  }

  return type.charAt(0).toUpperCase() + type.slice(1);
}

function errorText(error: string): string {
  if (error === 'forbidden') {
    return 'Only administrators can scan authorized ranges or change WinRM.';
  }

  if (error === 'not_authorized_range') {
    return 'That range is outside the authorized networks.';
  }

  if (error === 'scan_in_progress') {
    return 'A scan is already running.';
  }

  if (error === 'winrm_in_progress') {
    return 'A WinRM batch is already running.';
  }

  if (error === 'unavailable') {
    return 'WinRM actions are only available on Windows.';
  }

  if (error === 'invalid_input') {
    return 'Enter a CIDR such as 192.168.1.0/24 or a range such as 192.168.1.1 - 192.168.1.50.';
  }

  if (error === 'not_found') {
    return 'That asset was not found.';
  }

  if (error === 'duplicate') {
    return 'An asset with this IP address already exists.';
  }

  if (error === 'unauthorized') {
    return 'Your session expired. Sign in again.';
  }

  return 'The request could not be completed.';
}

function mergeAsset(list: Asset[], asset: Asset): Asset[] {
  const next = list.filter(
    (item) => item.id !== asset.id && item.ipAddress !== asset.ipAddress,
  );
  next.push(asset);
  next.sort((left, right) => left.hostname.localeCompare(right.hostname));
  return next;
}

function clampPageSize(value: number): number {
  if (!Number.isFinite(value)) {
    return PAGE_SIZE_DEFAULT;
  }

  return Math.min(PAGE_SIZE_MAX, Math.max(PAGE_SIZE_MIN, Math.round(value)));
}

function ManageableIcon({ asset }: { asset: Asset }) {
  if (asset.winrmManageable === true) {
    return (
      <CheckCircle2
        className="h-5 w-5 text-health-accent"
        aria-label="Manageable"
      />
    );
  }

  if (asset.winrmManageable === false) {
    return (
      <XCircle className="h-5 w-5 text-health-danger" aria-label="Not manageable" />
    );
  }

  return (
    <Minus className="h-5 w-5 text-health-subtle" aria-label="Not tested" />
  );
}

function isSuccessMessage(message: string): boolean {
  return (
    message.startsWith('Scan finished') ||
    message.startsWith('Deleted') ||
    message.startsWith('WinRM')
  );
}

type DiscoveryAssetsProps = {
  canScan: boolean;
};

export function DiscoveryAssets({ canScan }: DiscoveryAssetsProps) {
  const [ranges, setRanges] = useState<string[]>([]);
  const [target, setTarget] = useState('');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [form, setForm] = useState<AssetInput | null>(null);
  const [newLocation, setNewLocation] = useState('');
  const [newGroup, setNewGroup] = useState('');
  const [groupRename, setGroupRename] = useState('');
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_DEFAULT);
  const [pageSizeField, setPageSizeField] = useState(String(PAGE_SIZE_DEFAULT));
  const [winrmActiveId, setWinrmActiveId] = useState<string | null>(null);
  const [winrmBusy, setWinrmBusy] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const loadAssets = async () => {
    const result = await window.netxscan.listAssets(false);
    if (!result.ok) {
      setMessage(errorText(result.error));
      return;
    }

    setAssets(result.assets);
  };

  const loadLocations = async () => {
    const result = await window.netxscan.listLocations();
    if (result.ok) {
      setLocations(result.locations);
    }
  };

  const loadGroups = async () => {
    const result = await window.netxscan.listGroups();
    if (result.ok) {
      setGroups(result.groups);
    }
  };

  useEffect(() => {
    void window.netxscan.getAuthorizedRanges().then((result) => {
      if (result.ok) {
        setRanges(result.ranges);
        return;
      }

      setMessage(errorText(result.error));
    });
    void loadAssets();
    void loadLocations();
    void loadGroups();
  }, []);

  useEffect(() => {
    return window.netxscan.onScanHostFound((asset) => {
      setAssets((current) => mergeAsset(current, asset));
    });
  }, []);

  useEffect(() => {
    return window.netxscan.onWinrmProgress((progress) => {
      if (progress.type === 'running') {
        setWinrmActiveId(progress.assetId);
        return;
      }

      setWinrmActiveId(null);
      if (progress.type === 'done' && progress.asset) {
        const updated = progress.asset;
        setAssets((current) => mergeAsset(current, updated));
      }
    });
  }, []);

  const pageCount = Math.max(1, Math.ceil(assets.length / pageSize));

  useEffect(() => {
    if (page > pageCount) {
      setPage(pageCount);
    }
  }, [page, pageCount]);

  const pageAssets = useMemo(() => {
    const start = (page - 1) * pageSize;
    return assets.slice(start, start + pageSize);
  }, [assets, page, pageSize]);

  const pageIds = pageAssets.map((asset) => asset.id);
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const somePageSelected = pageIds.some((id) => selected.has(id));
  const selectedCount = selected.size;
  const batchLocked = scanning || winrmBusy || bulkDeleting;

  const applyPageSize = () => {
    const next = clampPageSize(Number(pageSizeField));
    setPageSize(next);
    setPageSizeField(String(next));
    setPage(1);
  };

  const toggleSelected = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectPage = () => {
    setSelected((current) => {
      const next = new Set(current);
      if (allPageSelected) {
        for (const id of pageIds) {
          next.delete(id);
        }
      } else {
        for (const id of pageIds) {
          next.add(id);
        }
      }
      return next;
    });
  };

  const onScan = async (event: FormEvent) => {
    event.preventDefault();
    if (!canScan) {
      return;
    }

    setScanning(true);
    setMessage(null);
    const result = await window.netxscan.runAuthorizedScan(target);
    setScanning(false);

    if (!result.ok) {
      setMessage(errorText(result.error));
      return;
    }

    setMessage(
      `Scan finished. ${result.savedCount ?? 0} live host(s) saved. Hostnames come from ping -a; otherwise the IP is stored.`,
    );
    await loadAssets();
  };

  const onDelete = async (id: string) => {
    setBusyId(id);
    setMessage(null);
    const result = await window.netxscan.deleteAsset(id);
    setBusyId(null);

    if (!result.ok) {
      setMessage(errorText(result.error));
      return;
    }

    setAssets((current) => current.filter((item) => item.id !== id));
    setSelected((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    if (editing?.id === id) {
      setEditing(null);
      setForm(null);
    }
  };

  const onBulkDelete = async () => {
    const ids = [...selected];
    if (ids.length === 0 || batchLocked) {
      return;
    }

    setBulkDeleting(true);
    setMessage(null);
    const result = await window.netxscan.deleteAssets(ids);
    setBulkDeleting(false);

    if (!result.ok) {
      setMessage(errorText(result.error));
      return;
    }

    const removed = new Set(result.deletedIds);
    setAssets((current) => current.filter((item) => !removed.has(item.id)));
    setSelected((current) => {
      const next = new Set(current);
      for (const id of removed) {
        next.delete(id);
      }
      return next;
    });
    if (editing && removed.has(editing.id)) {
      setEditing(null);
      setForm(null);
    }
    setMessage(`Deleted ${result.deletedIds.length} asset(s).`);
  };

  const onWinrm = async (action: WinrmAction) => {
    const ids = [...selected];
    if (!canScan || ids.length === 0 || batchLocked) {
      return;
    }

    setWinrmBusy(true);
    setMessage(null);
    const result = await window.netxscan.runWinrmBatch(action, ids);
    setWinrmBusy(false);
    setWinrmActiveId(null);

    if (!result.ok) {
      setMessage(errorText(result.error));
      return;
    }

    setMessage(
      `WinRM ${action === 'enable' ? 'enable' : 'disable'} finished for ${result.processed} host(s). Manageable hosts are saved for later management and scans.`,
    );
    await loadAssets();
  };

  const openEdit = (asset: Asset) => {
    setEditing(asset);
    setForm({
      hostname: asset.hostname,
      ipAddress: asset.ipAddress,
      macAddress: asset.macAddress,
      assetType: asset.assetType,
      notes: asset.notes,
      location: asset.location,
      assetGroup: asset.assetGroup,
    });
    setNewLocation('');
    setNewGroup('');
    setGroupRename('');
    setMessage(null);
    void loadLocations();
    void loadGroups();
  };

  const onSaveEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing || !form) {
      return;
    }

    setBusyId('edit');
    const result = await window.netxscan.updateAsset(editing.id, form);
    setBusyId(null);

    if (!result.ok) {
      setMessage(errorText(result.error));
      return;
    }

    setAssets((current) => mergeAsset(current, result.asset));
    setEditing(null);
    setForm(null);
  };

  const onAddLocation = async () => {
    const result = await window.netxscan.addLocation(newLocation);
    if (!result.ok) {
      setMessage(errorText(result.error));
      return;
    }

    setLocations(result.locations);
    setForm((current) =>
      current ? { ...current, location: newLocation.trim() } : current,
    );
    setNewLocation('');
  };

  const onDeleteLocation = async () => {
    if (!form?.location) {
      return;
    }
    const result = await window.netxscan.deleteLocation(form.location);
    if (!result.ok) {
      setMessage(errorText(result.error));
      return;
    }
    setLocations(result.locations);
    setForm((current) =>
      current ? { ...current, location: null } : current,
    );
  };

  const onAddGroup = async () => {
    const result = await window.netxscan.addGroup(newGroup);
    if (!result.ok) {
      setMessage(errorText(result.error));
      return;
    }
    setGroups(result.groups);
    setForm((current) =>
      current ? { ...current, assetGroup: newGroup.trim() } : current,
    );
    setNewGroup('');
  };

  const onRenameGroup = async () => {
    if (!form?.assetGroup) {
      return;
    }
    const result = await window.netxscan.renameGroup(form.assetGroup, groupRename);
    if (!result.ok) {
      setMessage(errorText(result.error));
      return;
    }
    setGroups(result.groups);
    setForm((current) =>
      current ? { ...current, assetGroup: groupRename.trim() } : current,
    );
    setGroupRename('');
    await loadAssets();
  };

  const onDeleteGroup = async () => {
    if (!form?.assetGroup) {
      return;
    }
    const result = await window.netxscan.deleteGroup(form.assetGroup);
    if (!result.ok) {
      setMessage(errorText(result.error));
      return;
    }
    setGroups(result.groups);
    setForm((current) =>
      current ? { ...current, assetGroup: null } : current,
    );
    await loadAssets();
  };

  return (
    <div className="grid gap-6">
      <section className="app-card">
        <h2 className="text-lg font-semibold">Discovery and Asset</h2>
        <p className="text-sm text-health-subtle">
          Scan an authorized CIDR (for example 192.168.1.0/24) or an IP range
          (192.168.1.10 - 192.168.1.50). Live hosts from ping -a appear in the
          table as they reply. Assets are added only from the network.
        </p>
        <p className="text-sm text-health-subtle">
          Authorized ranges:{' '}
          {ranges.length ? ranges.join(', ') : 'none configured'}
        </p>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            void onScan(event);
          }}
        >
          <label className="grid min-w-64 flex-1 gap-1 text-sm">
            <span className="font-medium text-health-subtle">IP range</span>
            <input
              value={target}
              placeholder="192.168.1.0/24 or 192.168.1.1 - 192.168.1.50"
              onChange={(event) => setTarget(event.target.value)}
              disabled={!canScan || scanning}
            />
          </label>
          <BusyButton
            type="submit"
            className="app-btn-primary"
            disabled={!canScan}
            busy={scanning}
            busyLabel="Scanning…"
          >
            Scan
          </BusyButton>
        </form>
        {!canScan ? (
          <p className="text-sm text-health-subtle">
            Sign in as administrator to run a scan or enable WinRM.
          </p>
        ) : null}
        {message ? (
          <p
            className={
              isSuccessMessage(message)
                ? 'text-sm text-health-accent'
                : 'text-sm text-health-danger'
            }
          >
            {message}
          </p>
        ) : null}
      </section>

      <section className="app-card overflow-x-auto">
        <h2 className="text-lg font-semibold">Assets</h2>
        {assets.length === 0 ? (
          <p className="text-sm text-health-subtle">
            No assets yet. Run a scan to add hosts from the network.
          </p>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-end gap-2">
              <BusyButton
                className="app-btn-secondary text-health-danger"
                disabled={selectedCount === 0 || batchLocked}
                busy={bulkDeleting}
                busyLabel="Deleting…"
                onClick={() => {
                  void onBulkDelete();
                }}
              >
                Delete
              </BusyButton>
              <BusyButton
                className="app-btn-secondary"
                disabled={!canScan || selectedCount === 0 || batchLocked}
                busy={winrmBusy}
                busyLabel="Working…"
                onClick={() => {
                  void onWinrm('enable');
                }}
              >
                Enable WinRM
              </BusyButton>
              <BusyButton
                className="app-btn-secondary"
                disabled={!canScan || selectedCount === 0 || batchLocked}
                busy={false}
                busyLabel="Working…"
                onClick={() => {
                  void onWinrm('disable');
                }}
              >
                Disable WinRM
              </BusyButton>
              <span className="text-sm text-health-subtle">
                {selectedCount} selected
              </span>
              <label className="ml-auto grid w-28 gap-1 text-sm">
                <span className="font-medium text-health-subtle">Page size</span>
                <input
                  type="number"
                  min={PAGE_SIZE_MIN}
                  max={PAGE_SIZE_MAX}
                  value={pageSizeField}
                  onChange={(event) => setPageSizeField(event.target.value)}
                  onBlur={applyPageSize}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      applyPageSize();
                    }
                  }}
                />
              </label>
            </div>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-health-border text-health-subtle">
                  <th className="py-2 pr-3 font-medium">
                    <input
                      type="checkbox"
                      aria-label="Select all on this page"
                      checked={allPageSelected}
                      ref={(element) => {
                        if (element) {
                          element.indeterminate =
                            somePageSelected && !allPageSelected;
                        }
                      }}
                      onChange={toggleSelectPage}
                    />
                  </th>
                  <th className="py-2 pr-3 font-medium">Hostname</th>
                  <th className="py-2 pr-3 font-medium">IP</th>
                  <th className="py-2 pr-3 font-medium">Location</th>
                  <th className="py-2 pr-3 font-medium">Group</th>
                  <th className="py-2 pr-3 font-medium">Type</th>
                  <th className="py-2 pr-3 font-medium">Manageable</th>
                  <th className="py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageAssets.map((asset) => {
                  const rowBusy = winrmActiveId === asset.id;
                  return (
                    <tr key={asset.id} className="border-b border-health-border">
                      <td className="py-2 pr-3">
                        <input
                          type="checkbox"
                          aria-label={`Select ${asset.hostname}`}
                          checked={selected.has(asset.id)}
                          onChange={() => toggleSelected(asset.id)}
                        />
                      </td>
                      <td className="py-2 pr-3">
                        {rowBusy ? (
                          <span className="inline-flex items-center gap-2">
                            <span className="app-spinner-sm" aria-hidden="true" />
                            {asset.hostname}
                          </span>
                        ) : (
                          asset.hostname
                        )}
                      </td>
                      <td className="py-2 pr-3">{asset.ipAddress ?? '—'}</td>
                      <td className="py-2 pr-3">{asset.location ?? '—'}</td>
                      <td className="py-2 pr-3">{asset.assetGroup ?? '—'}</td>
                      <td className="py-2 pr-3">{typeLabel(asset.assetType)}</td>
                      <td
                        className="py-2 pr-3"
                        title={asset.winrmDetail ?? undefined}
                      >
                        {rowBusy ? (
                          'Checking…'
                        ) : (
                          <ManageableIcon asset={asset} />
                        )}
                      </td>
                      <td className="py-2">
                        <button
                          type="button"
                          className="mr-3 text-health-accent"
                          onClick={() => openEdit(asset)}
                        >
                          Edit
                        </button>
                        <BusyButton
                          className="text-health-danger"
                          disabled={
                            batchLocked ||
                            (busyId !== null && busyId !== asset.id)
                          }
                          busy={busyId === asset.id}
                          busyLabel="Deleting…"
                          onClick={() => {
                            void onDelete(asset.id);
                          }}
                        >
                          Delete
                        </BusyButton>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              <button
                type="button"
                className="app-btn-secondary"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </button>
              <span className="text-health-subtle">
                Page {page} of {pageCount} ({assets.length} assets)
              </span>
              <button
                type="button"
                className="app-btn-secondary"
                disabled={page >= pageCount}
                onClick={() =>
                  setPage((current) => Math.min(pageCount, current + 1))
                }
              >
                Next
              </button>
            </div>
          </>
        )}
      </section>

      {editing && form ? (
        <div
          className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onClick={() => {
            setEditing(null);
            setForm(null);
          }}
        >
          <form
            className="app-card max-h-[90vh] w-full max-w-lg overflow-auto"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              void onSaveEdit(event);
            }}
          >
            <h2 className="text-lg font-semibold">Edit asset</h2>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-health-subtle">Hostname</span>
              <input
                value={form.hostname}
                onChange={(event) =>
                  setForm({ ...form, hostname: event.target.value })
                }
                required
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-health-subtle">IP address</span>
              <input value={form.ipAddress ?? ''} disabled />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-health-subtle">Type</span>
              <select
                value={form.assetType}
                onChange={(event) =>
                  setForm({
                    ...form,
                    assetType: event.target.value as AssetType,
                  })
                }
              >
                {ASSET_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {typeLabel(type)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-health-subtle">Location</span>
              <select
                value={form.location ?? ''}
                onChange={(event) =>
                  setForm({
                    ...form,
                    location: event.target.value || null,
                  })
                }
              >
                <option value="">No location</option>
                {locations.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap items-end gap-2">
              <label className="grid min-w-40 flex-1 gap-1 text-sm">
                <span className="font-medium text-health-subtle">
                  Add location
                </span>
                <input
                  value={newLocation}
                  placeholder="Clinic floor 2"
                  onChange={(event) => setNewLocation(event.target.value)}
                />
              </label>
              <button
                type="button"
                className="app-btn-secondary"
                onClick={() => {
                  void onAddLocation();
                }}
              >
                Add
              </button>
              <button
                type="button"
                className="app-btn-secondary text-health-danger"
                disabled={!form.location}
                onClick={() => {
                  void onDeleteLocation();
                }}
              >
                Delete location
              </button>
            </div>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-health-subtle">Group</span>
              <select
                value={form.assetGroup ?? ''}
                onChange={(event) =>
                  setForm({
                    ...form,
                    assetGroup: event.target.value || null,
                  })
                }
              >
                <option value="">No group</option>
                {groups.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap items-end gap-2">
              <label className="grid min-w-40 flex-1 gap-1 text-sm">
                <span className="font-medium text-health-subtle">Add group</span>
                <input
                  value={newGroup}
                  placeholder="Clinic workstations"
                  onChange={(event) => setNewGroup(event.target.value)}
                />
              </label>
              <button
                type="button"
                className="app-btn-secondary"
                onClick={() => {
                  void onAddGroup();
                }}
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <label className="grid min-w-40 flex-1 gap-1 text-sm">
                <span className="font-medium text-health-subtle">
                  Rename group
                </span>
                <input
                  value={groupRename}
                  placeholder="New group name"
                  onChange={(event) => setGroupRename(event.target.value)}
                />
              </label>
              <button
                type="button"
                className="app-btn-secondary"
                disabled={!form.assetGroup}
                onClick={() => {
                  void onRenameGroup();
                }}
              >
                Rename
              </button>
              <button
                type="button"
                className="app-btn-secondary text-health-danger"
                disabled={!form.assetGroup}
                onClick={() => {
                  void onDeleteGroup();
                }}
              >
                Delete group
              </button>
            </div>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-health-subtle">Notes</span>
              <textarea
                className="min-h-20"
                value={form.notes ?? ''}
                onChange={(event) =>
                  setForm({ ...form, notes: event.target.value || null })
                }
              />
            </label>
            <div className="flex gap-2">
              <BusyButton
                type="submit"
                className="app-btn-primary"
                busy={busyId === 'edit'}
                busyLabel="Saving…"
              >
                Save
              </BusyButton>
              <button
                type="button"
                className="app-btn-secondary"
                onClick={() => {
                  setEditing(null);
                  setForm(null);
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
