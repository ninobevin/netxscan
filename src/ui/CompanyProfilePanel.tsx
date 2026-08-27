import { FormEvent, useEffect, useState } from 'react';
import type { CompanyProfile } from '../shared/company-types';
import { BusyButton } from './BusyButton';

function errorText(error: string): string {
  if (error === 'forbidden') {
    return 'Only administrators can edit the company profile.';
  }

  if (error === 'cancelled') {
    return 'Logo upload was cancelled.';
  }

  if (error === 'invalid_input') {
    return 'Enter a company name (1–80 characters). Logos must be PNG, JPEG, or WebP and under 1 MB.';
  }

  return 'The company profile could not be saved.';
}

type CompanyProfilePanelProps = {
  canEdit: boolean;
  profile: CompanyProfile;
  onUpdated: (profile: CompanyProfile) => void;
};

export function CompanyProfilePanel({
  canEdit,
  profile,
  onUpdated,
}: CompanyProfilePanelProps) {
  const [name, setName] = useState(profile.companyName);
  const [message, setMessage] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<
    'name' | 'logo' | 'remove' | null
  >(null);

  const [okMessage, setOkMessage] = useState(false);

  useEffect(() => {
    setName(profile.companyName);
  }, [profile.companyName]);

  const onSaveName = async (event: FormEvent) => {
    event.preventDefault();
    setBusyAction('name');
    setMessage(null);
    const result = await window.netxscan.saveCompanyName(name);
    setBusyAction(null);

    if (!result.ok) {
      setOkMessage(false);
      setMessage(errorText(result.error));
      return;
    }

    setName(result.profile.companyName);
    onUpdated(result.profile);
    setOkMessage(true);
    setMessage('Company name saved.');
  };

  const onUpload = async () => {
    setBusyAction('logo');
    setMessage(null);
    const result = await window.netxscan.uploadCompanyLogo();
    setBusyAction(null);

    if (!result.ok) {
      setOkMessage(false);
      setMessage(errorText(result.error));
      return;
    }

    onUpdated(result.profile);
    setOkMessage(true);
    setMessage('Logo saved to the company profile.');
  };

  const onRemove = async () => {
    setBusyAction('remove');
    setMessage(null);
    const result = await window.netxscan.removeCompanyLogo();
    setBusyAction(null);

    if (!result.ok) {
      setOkMessage(false);
      setMessage(errorText(result.error));
      return;
    }

    onUpdated(result.profile);
    setOkMessage(true);
    setMessage('Logo removed.');
  };

  return (
    <div className="grid gap-6">
    <section className="app-card">
      <h2 className="text-lg font-semibold">Settings</h2>
      <p className="text-sm text-health-subtle">
        The company name and logo appear in the header. Settings are stored in
        company.json under this app’s data folder. Uploaded logos are copied
        into the logo folder there (PNG, JPEG, or WebP, max 1 MB). The renderer
        cannot pick an arbitrary file path.
      </p>
      <div className="flex flex-wrap items-center gap-4">
        {profile.hasLogo && profile.logoDataUrl ? (
          <img
            src={profile.logoDataUrl}
            alt={`${profile.companyName} logo`}
            className="h-20 w-20 rounded-xl border border-health-border object-contain bg-health-muted p-1"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-xl border border-dashed border-health-border bg-health-muted text-center text-xs text-health-subtle">
            Logo
          </div>
        )}
        <p className="text-sm text-health-subtle">
          {profile.hasLogo
            ? 'Custom logo is in use.'
            : 'Placeholder until a logo is uploaded.'}
        </p>
      </div>
      {canEdit ? (
        <>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              void onSaveName(event);
            }}
          >
            <label className="grid min-w-64 flex-1 gap-1 text-sm">
              <span className="font-medium text-health-subtle">Company name</span>
              <input
                value={name}
                maxLength={80}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </label>
            <BusyButton
              type="submit"
              className="app-btn-primary"
              busy={busyAction === 'name'}
              busyLabel="Saving…"
            >
              Save name
            </BusyButton>
          </form>
          <div className="flex flex-wrap gap-2">
            <BusyButton
              className="app-btn-secondary"
              disabled={busyAction !== null && busyAction !== 'logo'}
              busy={busyAction === 'logo'}
              busyLabel="Uploading…"
              onClick={() => {
                void onUpload();
              }}
            >
              Upload logo
            </BusyButton>
            <BusyButton
              className="app-btn-secondary"
              disabled={!profile.hasLogo || (busyAction !== null && busyAction !== 'remove')}
              busy={busyAction === 'remove'}
              busyLabel="Removing…"
              onClick={() => {
                void onRemove();
              }}
            >
              Remove logo
            </BusyButton>
          </div>
        </>
      ) : (
        <p className="text-sm text-health-subtle">
          Sign in as administrator to change the company name or logo.
        </p>
      )}
      {message ? (
        <p className={okMessage ? 'text-sm text-health-accent' : 'text-sm text-health-danger'}>
          {message}
        </p>
      ) : null}
    </section>
    {canEdit ? <NvdCatalogCard /> : null}
    </div>
  );
}

function nvdError(error: string): string {
  if (error === 'forbidden') {
    return 'Only administrators can sync NVD.';
  }
  if (error === 'invalid_input') {
    return 'Enter a valid NVD API key, or leave the field empty to clear it.';
  }
  if (error === 'sync_in_progress') {
    return 'An NVD sync is already running.';
  }
  if (error === 'no_software') {
    return 'Collect installed software on at least one host first.';
  }
  if (error === 'nvd_unavailable') {
    return 'NVD could not be reached. Try again later.';
  }
  return 'The NVD request could not be completed.';
}

function NvdCatalogCard() {
  const [apiKey, setApiKey] = useState('');
  const [statusText, setStatusText] = useState('Loading…');
  const [message, setMessage] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState<'key' | 'sync' | null>(null);

  const loadStatus = async () => {
    const result = await window.netxscan.getNvdStatus();
    if (!result.ok) {
      setStatusText(nvdError(result.error));
      return;
    }
    const s = result.status;
    const key = s.hasApiKey
      ? `API key saved (…${s.apiKeyTail ?? '****'})`
      : 'No API key (slow public rate limit)';
    const sync = s.lastSyncAt
      ? `Last sync ${s.lastSyncAt}${s.lastSyncSummary ? ` · ${s.lastSyncSummary}` : ''}`
      : 'Not synced yet';
    setStatusText(
      `${key}. Catalog: ${s.cpeCount} CPE(s), ${s.cveCount} CVE(s). ${sync}`,
    );
  };

  useEffect(() => {
    void loadStatus();
  }, []);

  const onSaveKey = async (event: FormEvent) => {
    event.preventDefault();
    setBusy('key');
    setMessage(null);
    const result = await window.netxscan.saveNvdApiKey(apiKey);
    setBusy(null);
    if (!result.ok) {
      setOk(false);
      setMessage(nvdError(result.error));
      return;
    }
    setApiKey('');
    setOk(true);
    setMessage(result.status.hasApiKey ? 'NVD API key saved.' : 'NVD API key cleared.');
    await loadStatus();
  };

  const onSync = async () => {
    setBusy('sync');
    setMessage(null);
    const result = await window.netxscan.syncNvdCatalog();
    setBusy(null);
    if (!result.ok) {
      setOk(false);
      setMessage(nvdError(result.error));
      return;
    }
    setOk(true);
    setMessage(
      `Synced ${result.products} product(s), ${result.cpes} CPE(s), ${result.cves} CVE record(s).`,
    );
    await loadStatus();
  };

  return (
    <section className="app-card grid gap-3">
      <h2 className="text-lg font-semibold">NVD software catalog</h2>
      <p className="text-sm text-health-subtle">
        Sync copies CPE identifiers and CVE version ranges from NVD for
        software already inventoried. Assessment matching is offline and only
        marks a package vulnerable when the installed version falls in NVD’s
        affected range. Windows missing KBs stay on the Security updates
        module. An NVD API key is recommended.
      </p>
      <p className="text-sm text-health-subtle">{statusText}</p>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          void onSaveKey(event);
        }}
      >
        <label className="grid min-w-64 flex-1 gap-1 text-sm">
          <span className="font-medium text-health-subtle">NVD API key</span>
          <input
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="Paste key, or empty to clear"
          />
        </label>
        <BusyButton
          type="submit"
          className="app-btn-secondary"
          busy={busy === 'key'}
          busyLabel="Saving…"
        >
          Save key
        </BusyButton>
        <BusyButton
          className="app-btn-primary"
          busy={busy === 'sync'}
          busyLabel="Syncing…"
          onClick={() => {
            void onSync();
          }}
        >
          Sync catalog
        </BusyButton>
      </form>
      {message ? (
        <p className={ok ? 'text-sm text-health-accent' : 'text-sm text-health-danger'}>
          {message}
        </p>
      ) : null}
    </section>
  );
}
