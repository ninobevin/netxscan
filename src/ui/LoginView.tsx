import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type LoginViewProps = {
  onLoggedIn: () => void;
};

export function LoginView({ onLoggedIn }: LoginViewProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await window.netxscan.login(username, password);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onLoggedIn();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-health-canvas p-6">
      <form
        onSubmit={(event) => {
          void onSubmit(event);
        }}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-health-border bg-health-surface p-8 shadow-sm"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-health-accent">
            NetXScan
          </p>
          <h1 className="mt-2 text-2xl font-semibold">Sign in</h1>
          <p className="mt-1 text-sm text-health-subtle">
            Use your local administrator or IT support account.
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
        {error ? <p className="text-sm text-health-danger">{error}</p> : null}
        <Button className="w-full" type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </div>
  );
}
