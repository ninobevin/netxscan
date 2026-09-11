import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { PublicSession } from '../shared/auth-types';

type FirstLoginSetupProps = {
  session: PublicSession;
  onDone: () => void;
};

export function FirstLoginSetup({ session, onDone }: FirstLoginSetupProps) {
  const [step, setStep] = useState<'password' | 'totp'>(
    session.mustChangePassword ? 'password' : 'totp',
  );
  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (step !== 'totp') {
      return;
    }
    void (async () => {
      setBusy(true);
      const result = await window.netxscan.beginTotpSetup();
      setBusy(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setQrDataUrl(result.qrDataUrl);
    })();
  }, [step]);

  const savePassword = async (event: FormEvent) => {
    event.preventDefault();
    if (nextPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    setBusy(true);
    setError(null);
    const result = await window.netxscan.changePassword(currentPassword, nextPassword);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setCurrentPassword('');
    setNextPassword('');
    setConfirmPassword('');
    if (result.session.setupRequired) {
      setStep('totp');
      return;
    }
    onDone();
  };

  const saveTotp = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await window.netxscan.confirmTotpSetup(code);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onDone();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-health-canvas p-6">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-health-border bg-health-surface p-8 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-health-accent">
            NetXScan
          </p>
          <h1 className="mt-2 text-2xl font-semibold">
            {step === 'password' ? 'Change password' : 'Set up authenticator'}
          </h1>
          <p className="mt-1 text-sm text-health-subtle">
            Signed in as {session.username}. Complete setup before using the app.
          </p>
        </div>
        {step === 'password' ? (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              void savePassword(event);
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="current-password">Current password</Label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="next-password">New password</Label>
              <Input
                id="next-password"
                type="password"
                autoComplete="new-password"
                value={nextPassword}
                onChange={(event) => setNextPassword(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </div>
            {error ? <p className="text-sm text-health-danger">{error}</p> : null}
            <Button className="w-full" type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save password'}
            </Button>
          </form>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              void saveTotp(event);
            }}
          >
            <p className="text-sm text-muted-foreground">
              Scan this QR code with Google Authenticator, then enter the 6-digit code.
            </p>
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="Authenticator QR code"
                className="mx-auto rounded-md border bg-white p-2"
              />
            ) : (
              <p className="text-sm text-muted-foreground">Preparing QR code…</p>
            )}
            <div className="space-y-2">
              <Label htmlFor="totp-code">Authenticator code</Label>
              <Input
                id="totp-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
            </div>
            {error ? <p className="text-sm text-health-danger">{error}</p> : null}
            <Button className="w-full" type="submit" disabled={busy || !qrDataUrl}>
              {busy ? 'Verifying…' : 'Save authenticator'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
