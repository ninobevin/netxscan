import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { showSaveSuccess } from './show-save-success';
import { CompanyLogo } from './CompanyLogo';
import { UserManagementSection } from './UserManagementSection';
import type { PublicSession } from '../shared/auth-types';
import type { CompanyProfile } from '../shared/company-types';

const EMPTY: CompanyProfile = {
  name: '',
  address: '',
  contact: '',
  notes: '',
  logoDataUrl: null,
};

type SettingsPanelProps = {
  session: PublicSession;
  onSessionRefresh: () => void;
  onCompanyChange?: () => void;
};

export function SettingsPanel({ session, onSessionRefresh, onCompanyChange }: SettingsPanelProps) {
  const isAdmin = session.role === 'administrator';
  const [profile, setProfile] = useState<CompanyProfile>(EMPTY);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const result = await window.netxscan.getCompany();
      if (result.ok) {
        setProfile(result.profile);
      } else {
        setMessage(result.error);
      }
    })();
  }, []);

  const save = async () => {
    setBusy(true);
    setMessage(null);
    const result = await window.netxscan.updateCompany(profile);
    setBusy(false);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    setProfile(result.profile);
    onCompanyChange?.();
    showSaveSuccess();
  };

  const chooseLogo = async () => {
    setBusy(true);
    setMessage(null);
    const result = await window.netxscan.chooseCompanyLogo();
    setBusy(false);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    if (result.cancelled) {
      return;
    }
    setProfile(result.profile);
    onCompanyChange?.();
    showSaveSuccess('Logo saved.');
  };

  const removeLogo = async () => {
    setBusy(true);
    setMessage(null);
    const result = await window.netxscan.clearCompanyLogo();
    setBusy(false);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    setProfile(result.profile);
    onCompanyChange?.();
    showSaveSuccess('Logo removed.');
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Settings</h2>
        <p className="text-sm text-muted-foreground">Company profile and user accounts.</p>
      </div>
      <div className="max-w-xl space-y-4 rounded-xl border bg-card p-6">
        <h3 className="text-base font-semibold">Company profile</h3>
        <div className="space-y-2">
          <Label>Logo</Label>
          <div className="flex flex-wrap items-center gap-4">
            {profile.logoDataUrl ? (
              <CompanyLogo src={profile.logoDataUrl} className="h-16 w-16 rounded-md border bg-background object-contain p-1" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-md border bg-muted text-xs text-muted-foreground">
                None
              </div>
            )}
            {isAdmin ? (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" disabled={busy} onClick={() => void chooseLogo()}>
                  Choose logo
                </Button>
                {profile.logoDataUrl ? (
                  <Button variant="ghost" disabled={busy} onClick={() => void removeLogo()}>
                    Remove
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">PNG or JPEG, up to 2 MB. Shown on login, the header, and reports.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="company-name">Clinic name</Label>
          <Input
            id="company-name"
            disabled={!isAdmin}
            value={profile.name}
            onChange={(event) => setProfile({ ...profile, name: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="company-address">Address</Label>
          <Input
            id="company-address"
            disabled={!isAdmin}
            value={profile.address}
            onChange={(event) => setProfile({ ...profile, address: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="company-contact">Contact</Label>
          <Input
            id="company-contact"
            disabled={!isAdmin}
            value={profile.contact}
            onChange={(event) => setProfile({ ...profile, contact: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="company-notes">Notes</Label>
          <textarea
            id="company-notes"
            disabled={!isAdmin}
            rows={4}
            value={profile.notes}
            onChange={(event) => setProfile({ ...profile, notes: event.target.value })}
            className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
        {message ? <p className="text-sm text-destructive">{message}</p> : null}
        {isAdmin ? (
          <Button disabled={busy} onClick={() => void save()}>
            Save profile
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">Only administrators can edit the company profile.</p>
        )}
      </div>
      {isAdmin ? (
        <div className="max-w-3xl">
          <UserManagementSection session={session} onSessionRefresh={onSessionRefresh} />
        </div>
      ) : null}
    </div>
  );
}
