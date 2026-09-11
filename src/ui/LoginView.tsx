import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type LoginViewProps = {
  onLoggedIn: () => void;
};

export function LoginView({ onLoggedIn }: LoginViewProps) {
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    const result = await window.netxscan.login(username, password);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onLoggedIn();
  };

  const onForgot = async (event: FormEvent) => {
    event.preventDefault();
    if (nextPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    const result = await window.netxscan.forgotPassword(username, code, nextPassword);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setPassword('');
    setCode('');
    setNextPassword('');
    setConfirmPassword('');
    setMode('login');
    setMessage('Password updated. Sign in with your new password.');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-health-canvas p-6">
      <form
        onSubmit={(event) => {
          void (mode === 'login' ? onSubmit(event) : onForgot(event));
        }}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-health-border bg-health-surface p-8 shadow-sm"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-health-accent">
            NetXScan
          </p>
          <h1 className="mt-2 text-2xl font-semibold">
            {mode === 'login' ? 'Sign in' : 'Forgot password'}
          </h1>
          <p className="mt-1 text-sm text-health-subtle">
            {mode === 'login'
              ? 'First-time setup requires the default administrator account.'
              : 'Enter your username, Google Authenticator code, and a new password.'}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </div>
        {mode === 'login' ? (
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="totp">Authenticator code</Label>
              <Input
                id="totp"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={nextPassword}
                onChange={(event) => setNextPassword(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-new-password">Confirm new password</Label>
              <Input
                id="confirm-new-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </div>
          </>
        )}
        {error ? <p className="text-sm text-health-danger">{error}</p> : null}
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        <Button className="w-full" type="submit" disabled={busy}>
          {busy
            ? mode === 'login'
              ? 'Signing in…'
              : 'Saving…'
            : mode === 'login'
              ? 'Sign in'
              : 'Set new password'}
        </Button>
        <button
          type="button"
          className="w-full text-sm text-health-accent underline-offset-4 hover:underline"
          onClick={() => {
            setError(null);
            setMessage(null);
            setMode(mode === 'login' ? 'forgot' : 'login');
          }}
        >
          {mode === 'login' ? 'Forgot password' : 'Back to sign in'}
        </button>
      </form>
    </div>
  );
}
