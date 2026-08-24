import { FormEvent, useEffect, useState } from 'react';
import {
  ASSET_TYPES,
  type Asset,
  type AssetInput,
  type AssetType,
} from '../shared/asset-types';
import { ServiceAssessmentPanel } from './ServiceAssessmentPanel';
import { BusyButton } from './BusyButton';

const emptyForm: AssetInput = {
  hostname: '',
  ipAddress: null,
  macAddress: null,
  assetType: 'workstation',
  notes: null,
};

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
  if (error === 'invalid_input') {
    return 'Check hostname, IPv4 address, and MAC address format.';
  }

  if (error === 'duplicate') {
    return 'An asset with this IP address already exists.';
  }

  if (error === 'not_found') {
    return 'That asset was not found or is already archived.';
  }

  if (error === 'unauthorized') {
    return 'Your session expired. Sign in again.';
  }

  return 'The database is not available.';
}

export function AssetInventory({
  refreshKey = 0,
  canAssess = false,
}: {
  refreshKey?: number;
  canAssess?: boolean;
}) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [form, setForm] = useState<AssetInput>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadAssets = async () => {
    const result = await window.netxscan.listAssets(false);

    if (!result.ok) {
      setMessage(errorText(result.error));
      return;
    }

    setAssets(result.assets);
  };

  useEffect(() => {
    void loadAssets();
  }, [refreshKey]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusyId('form');
    setMessage(null);

    const payload: AssetInput = {
      hostname: form.hostname,
      ipAddress: form.ipAddress,
      macAddress: form.macAddress,
      assetType: form.assetType,
      notes: form.notes,
    };

    const result = editingId
      ? await window.netxscan.updateAsset(editingId, payload)
      : await window.netxscan.createAsset(payload);

    setBusyId(null);

    if (!result.ok) {
      setMessage(errorText(result.error));
      return;
    }

    setForm(emptyForm);
    setEditingId(null);
    await loadAssets();
  };

  const onArchive = async (id: string) => {
    setBusyId(id);
    const result = await window.netxscan.archiveAsset(id);
    setBusyId(null);

    if (!result.ok) {
      setMessage(errorText(result.error));
      return;
    }

    if (editingId === id) {
      setEditingId(null);
      setForm(emptyForm);
    }

    await loadAssets();
  };

  const onEdit = (asset: Asset) => {
    setEditingId(asset.id);
    setForm({
      hostname: asset.hostname,
      ipAddress: asset.ipAddress,
      macAddress: asset.macAddress,
      assetType: asset.assetType,
      notes: asset.notes,
    });
  };

  return (
    <>
    <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
      <form
        className="app-card h-fit"
        onSubmit={(event) => {
          void onSubmit(event);
        }}
      >
        <h2 className="text-lg font-semibold">
          {editingId ? 'Edit asset' : 'Add asset'}
        </h2>
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
          <input
            value={form.ipAddress ?? ''}
            onChange={(event) =>
              setForm({
                ...form,
                ipAddress: event.target.value.trim() || null,
              })
            }
            placeholder="192.168.1.10"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-health-subtle">MAC address</span>
          <input
            value={form.macAddress ?? ''}
            onChange={(event) =>
              setForm({
                ...form,
                macAddress: event.target.value.trim() || null,
              })
            }
            placeholder="AA:BB:CC:DD:EE:FF"
          />
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
          <span className="font-medium text-health-subtle">Notes</span>
          <textarea
            className="min-h-20"
            value={form.notes ?? ''}
            onChange={(event) =>
              setForm({ ...form, notes: event.target.value || null })
            }
          />
        </label>
        {message ? <p className="text-sm text-health-danger">{message}</p> : null}
        <div className="flex gap-2">
          <BusyButton
            type="submit"
            className="app-btn-primary"
            disabled={busyId !== null && busyId !== 'form'}
            busy={busyId === 'form'}
            busyLabel={editingId ? 'Saving…' : 'Creating…'}
          >
            {editingId ? 'Save' : 'Create'}
          </BusyButton>
          {editingId ? (
            <button
              type="button"
              className="app-btn-secondary"
              onClick={() => {
                setEditingId(null);
                setForm(emptyForm);
              }}
            >
              Cancel
            </button>
          ) : null}
        </div>
      </form>

      <section className="app-card overflow-x-auto">
        <h2 className="text-lg font-semibold">Asset inventory</h2>
        <p className="text-sm text-health-subtle">
          Archive hides an asset. Records are not deleted.
        </p>
        {assets.length === 0 ? (
          <p className="text-sm text-health-subtle">No active assets yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-health-border text-health-subtle">
                <th className="py-2 pr-3 font-medium">Hostname</th>
                <th className="py-2 pr-3 font-medium">IP</th>
                <th className="py-2 pr-3 font-medium">Type</th>
                <th className="py-2 pr-3 font-medium">Services</th>
                <th className="py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => (
                <tr key={asset.id} className="border-b border-health-border">
                  <td className="py-2 pr-3">{asset.hostname}</td>
                  <td className="py-2 pr-3">{asset.ipAddress ?? '—'}</td>
                  <td className="py-2 pr-3">{typeLabel(asset.assetType)}</td>
                  <td className="max-w-xs py-2 pr-3 text-health-subtle">
                    {asset.services.length
                      ? asset.services
                          .map((service) =>
                            service.serviceName
                              ? `${service.port}/${service.serviceName}`
                              : String(service.port),
                          )
                          .join(', ')
                      : '—'}
                  </td>
                  <td className="py-2">
                    <button
                      type="button"
                      className="mr-3 text-health-accent"
                      onClick={() => setSelectedAsset(asset)}
                    >
                      Assess
                    </button>
                    <button
                      type="button"
                      className="mr-3 text-health-accent"
                      onClick={() => onEdit(asset)}
                    >
                      Edit
                    </button>
                    <BusyButton
                      className="text-health-danger"
                      disabled={busyId !== null && busyId !== asset.id}
                      busy={busyId === asset.id}
                      busyLabel="Archiving…"
                      onClick={() => {
                        void onArchive(asset.id);
                      }}
                    >
                      Archive
                    </BusyButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
    {selectedAsset ? (
      <ServiceAssessmentPanel
        assetId={selectedAsset.id}
        assetLabel={
          selectedAsset.ipAddress
            ? `${selectedAsset.hostname} (${selectedAsset.ipAddress})`
            : selectedAsset.hostname
        }
        canAssess={canAssess}
        onClose={() => setSelectedAsset(null)}
      />
    ) : null}
    </>
  );
}
