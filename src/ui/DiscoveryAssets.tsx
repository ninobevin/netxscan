import { FormEvent, useEffect, useState } from 'react';
import {
  ASSET_TYPES,
  type Asset,
  type AssetInput,
  type AssetType,
} from '../shared/asset-types';
import { BusyButton } from './BusyButton';

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
    return 'Only administrators can scan authorized ranges.';
  }

  if (error === 'not_authorized_range') {
    return 'That range is outside the authorized networks.';
  }

  if (error === 'scan_in_progress') {
    return 'A scan is already running.';
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

type DiscoveryAssetsProps = {
  canScan: boolean;
};

export function DiscoveryAssets({ canScan }: DiscoveryAssetsProps) {
  const [ranges, setRanges] = useState<string[]>([]);
  const [target, setTarget] = useState('');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [form, setForm] = useState<AssetInput | null>(null);
  const [newLocation, setNewLocation] = useState('');

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
  }, []);

  useEffect(() => {
    return window.netxscan.onScanHostFound((asset) => {
      setAssets((current) => mergeAsset(current, asset));
    });
  }, []);

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
    if (editing?.id === id) {
      setEditing(null);
      setForm(null);
    }
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
    });
    setNewLocation('');
    setMessage(null);
    void loadLocations();
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
            Sign in as administrator to run a scan.
          </p>
        ) : null}
        {message ? (
          <p
            className={
              message.startsWith('Scan finished')
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
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-health-border text-health-subtle">
                <th className="py-2 pr-3 font-medium">Hostname</th>
                <th className="py-2 pr-3 font-medium">IP</th>
                <th className="py-2 pr-3 font-medium">Location</th>
                <th className="py-2 pr-3 font-medium">Type</th>
                <th className="py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => (
                <tr key={asset.id} className="border-b border-health-border">
                  <td className="py-2 pr-3">{asset.hostname}</td>
                  <td className="py-2 pr-3">{asset.ipAddress ?? '—'}</td>
                  <td className="py-2 pr-3">{asset.location ?? '—'}</td>
                  <td className="py-2 pr-3">{typeLabel(asset.assetType)}</td>
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
                      disabled={busyId !== null && busyId !== asset.id}
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
              ))}
            </tbody>
          </table>
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
