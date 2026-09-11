import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { showSaveSuccess } from './show-save-success';
import type { AppUser, PublicSession, UserRole } from '../shared/auth-types';

function roleLabel(role: UserRole): string {
  return role === 'administrator' ? 'Administrator' : 'User';
}

type UserManagementSectionProps = {
  session: PublicSession;
  onSessionRefresh: () => void;
};

export function UserManagementSection({
  session,
  onSessionRefresh,
}: UserManagementSectionProps) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('user');
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const result = await window.netxscan.listUsers();
    if (result.ok) {
      setUsers(result.users);
    } else {
      setMessage(result.error);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const resetForm = () => {
    setEditId(null);
    setUsername('');
    setPassword('');
    setRole('user');
    setMessage(null);
  };

  const openCreate = () => {
    resetForm();
    setConfirmId(null);
    setOpen(true);
  };

  const openEdit = (user: AppUser) => {
    setEditId(user.id);
    setUsername(user.username);
    setPassword('');
    setRole(user.role);
    setMessage(null);
    setConfirmId(null);
    setOpen(true);
  };

  const save = async () => {
    setBusy(true);
    setMessage(null);
    const result =
      editId === null
        ? await window.netxscan.addUser(username, password, role)
        : await window.netxscan.updateUser(editId, {
            username,
            role,
            ...(password ? { password } : {}),
          });
    setBusy(false);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    setUsers(result.users);
    setOpen(false);
    resetForm();
    onSessionRefresh();
    showSaveSuccess();
  };

  const remove = async (id: number) => {
    setBusy(true);
    const result = await window.netxscan.deleteUser(id);
    setBusy(false);
    if (!result.ok) {
      setMessage(result.error);
      setConfirmId(null);
      return;
    }
    setUsers(result.users);
    setConfirmId(null);
    showSaveSuccess('User deleted.');
  };

  return (
    <div className="space-y-4 rounded-xl border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Users</h3>
          <p className="text-sm text-muted-foreground">
            Administrator can manage inventory and settings. User can sign in and scan, but cannot
            change assignments or users.
          </p>
        </div>
        <Button onClick={openCreate}>Add user</Button>
      </div>
      {message && !open ? <p className="text-sm text-destructive">{message}</p> : null}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Username</TableHead>
              <TableHead>Level</TableHead>
              <TableHead className="w-[200px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.username}</TableCell>
                <TableCell>{roleLabel(user.role)}</TableCell>
                <TableCell className="space-x-2 text-right">
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => openEdit(user)}>
                    Edit
                  </Button>
                  {user.username === session.username ? null : confirmId === user.id ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={busy}
                      onClick={() => void remove(user.id)}
                    >
                      Confirm
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={busy}
                      onClick={() => setConfirmId(user.id)}
                    >
                      Delete
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) {
            resetForm();
          }
          setOpen(next);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId === null ? 'Add user' : 'Edit user'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="user-username">Username</Label>
              <Input
                id="user-username"
                value={username}
                autoComplete="off"
                onChange={(event) => setUsername(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-password">
                {editId === null ? 'Password' : 'Password (leave blank to keep)'}
              </Label>
              <Input
                id="user-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Level</Label>
              <Select value={role} onValueChange={(value) => setRole(value as UserRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="administrator">Administrator</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {open && message ? <p className="text-sm text-destructive">{message}</p> : null}
            <Button disabled={busy} onClick={() => void save()}>
              {editId === null ? 'Add user' : 'Save user'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
