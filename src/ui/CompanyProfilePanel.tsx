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
  );
}
