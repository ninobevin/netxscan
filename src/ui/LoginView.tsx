import { FormEvent, useEffect, useState } from 'react';
import type { CompanyProfile } from '../shared/company-types';
import { BusyButton } from './BusyButton';
import { PageLayout } from './PageLayout';
import { databaseStatusMessage } from '../shared/database-status';

type LoginViewProps = {
  onLoggedIn: () => void;
  profile: CompanyProfile | null;
};

function errorText(error: string): string {
  if (error === 'locked') {
    return 'This account is temporarily locked. Try again later.';
  }

  if (error === 'invalid_input') {
    return 'Enter a username and password.';
  }

  if (error === 'database_unavailable') {
    return 'The database is not available. Check the MySQL connection.';
  }

  return 'Invalid username or password.';
}

export function LoginView({ onLoggedIn, profile }: LoginViewProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void window.netxscan.getDatabaseStatus().then((status) => {
      setMessage(databaseStatusMessage(status));
    });
  }, []);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);

    try {
      const result = await window.netxscan.login(username, password);

      if (result.ok) {
        onLoggedIn();
        return;
      }

      setMessage(errorText(result.error));
    } catch {
      setMessage('Login failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageLayout profile={profile}>
      <form
        onSubmit={(event) => {
          void onSubmit(event);
        }}
        className="app-card max-w-md"
      >
        <h2 className="text-xl font-semibold">Sign in to NetXScan</h2>
        <p className="text-sm text-health-subtle">
          Authorized IT staff only. Use this system to manage{' '}
          {profile?.companyName ?? 'your organization'}
          &apos;s network assets and vulnerability findings.
        </p>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-health-subtle">Username</span>
          <input
            value={username}
            autoComplete="username"
            onChange={(event) => setUsername(event.target.value)}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-health-subtle">Password</span>
          <input
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {message ? <p className="text-sm text-health-danger">{message}</p> : null}
        <BusyButton
          type="submit"
          className="app-btn-primary mt-2"
          busy={busy}
          busyLabel="Signing in…"
        >
          Sign in
        </BusyButton>
      </form>
    </PageLayout>
  );
}
