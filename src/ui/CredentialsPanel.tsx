import { FormEvent, useEffect, useState } from 'react';
import type { StoredCredential } from '../shared/credential-types';
import { BusyButton } from './BusyButton';

function errorText(error: string): string {
  if (error === 'forbidden') {
    return 'Only administrators can manage WinRM credentials.';
  }

  if (error === 'invalid_input') {
    return 'Enter a label, a Windows username (DOMAIN\\user or user@domain), and a password.';
  }

  if (error === 'not_found') {
    return 'That credential was not found in Windows Credential Manager.';
  }

  return 'Windows Credential Manager could not complete that request.';
}

type CredentialsPanelProps = {
  canEdit: boolean;
};

export function CredentialsPanel({ canEdit }: CredentialsPanelProps) {
  const [credentials, setCredentials] = useState<StoredCredential[]>([]);
  const [label, setLabel] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const load = async () => {
    const result = await window.netxscan.listCredentials();

    if (!result.ok) {
      setMessage(errorText(result.error));
      return;
    }

    setCredentials(result.credentials);
  };

  useEffect(() => {
    if (canEdit) {
      void load();
    }
  }, [canEdit]);

  const onSave = async (event: FormEvent) => {
    event.preventDefault();
    setBusyAction('save');
    setMessage(null);
    const result = await window.netxscan.saveCredential(label, username, password);
    setBusyAction(null);

    if (!result.ok) {
      setMessage(errorText(result.error));
      return;
    }

    setLabel('');
    setUsername('');
    setPassword('');
    await load();
  };

  const onDelete = async (id: string) => {
    setBusyAction(id);
    const result = await window.netxscan.deleteCredential(id);
    setBusyAction(null);

    if (!result.ok) {
      setMessage(errorText(result.error));
      return;
    }

    await load();
  };

  return (
    <section className="app-card">
      <h2 className="text-lg font-semibold">Windows Credential Manager</h2>
      <p className="text-sm text-health-subtle">
        WinRM passwords are stored as generic Windows credentials on this PC
        (Control Panel → Credential Manager). They are never written to MySQL.
        The renderer cannot read stored passwords back.
      </p>
      {!canEdit ? (
        <p className="text-sm text-health-subtle">
          Sign in as administrator to save WinRM credentials.
        </p>
      ) : (
        <form
          className="grid gap-3 md:grid-cols-2"
          onSubmit={(event) => {
            void onSave(event);
          }}
        >
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-health-subtle">Label</span>
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Clinic domain admin"
              required
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-health-subtle">Username</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="CLINIC\\netxscan"
              required
            />
          </label>
          <label className="grid gap-1 text-sm md:col-span-2">
            <span className="font-medium text-health-subtle">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
          </label>
          <BusyButton
            type="submit"
            className="app-btn-primary w-fit"
            disabled={busyAction !== null && busyAction !== 'save'}
            busy={busyAction === 'save'}
            busyLabel="Saving…"
          >
            Save to Credential Manager
          </BusyButton>
        </form>
      )}
      {message ? <p className="text-sm text-health-danger">{message}</p> : null}
      {canEdit && credentials.length === 0 ? (
        <p className="text-sm text-health-subtle">No NetXScan credentials stored yet.</p>
      ) : null}
      {credentials.length > 0 ? (
        <table className="w-full text-left text-sm">
          <thead className="text-health-subtle">
            <tr>
              <th className="py-2 pr-3 font-medium">Label</th>
              <th className="py-2 pr-3 font-medium">Username</th>
              <th className="py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {credentials.map((item) => (
              <tr key={item.id} className="border-t border-health-border">
                <td className="py-2 pr-3">{item.label}</td>
                <td className="py-2 pr-3">{item.username}</td>
                <td className="py-2">
                  {canEdit ? (
                    <BusyButton
                      className="text-health-danger"
                      disabled={busyAction !== null && busyAction !== item.id}
                      busy={busyAction === item.id}
                      busyLabel="Deleting…"
                      onClick={() => {
                        void onDelete(item.id);
                      }}
                    >
                      Delete
                    </BusyButton>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}
