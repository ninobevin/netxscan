import { useState } from 'react';
import { LogOut, UserRound } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { PublicSession, UserProfile } from '../shared/auth-types';
import { showSaveSuccess } from './show-save-success';

type UserMenuProps = {
  session: PublicSession;
  onLoggedOut: () => void;
  onSessionRefresh: () => void;
};

function initials(name: string): string {
  const parts = name.trim().split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || '?';
}

function roleLabel(role: PublicSession['role']): string {
  return role === 'administrator' ? 'Administrator' : 'User';
}

function profileFromSession(session: PublicSession): UserProfile {
  return {
    fullName: session.fullName,
    address: session.address,
    contact: session.contact,
    email: session.email,
    position: session.position,
  };
}

export function UserMenu({ session, onLoggedOut, onSessionRefresh }: UserMenuProps) {
  const role = roleLabel(session.role);
  const displayName = session.fullName.trim() || session.username;
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile>(() => profileFromSession(session));
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const openProfile = () => {
    setProfile(profileFromSession(session));
    setMessage(null);
    setOpen(true);
  };

  const save = async () => {
    setBusy(true);
    setMessage(null);
    const result = await window.netxscan.updateProfile(profile);
    setBusy(false);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    showSaveSuccess();
    setOpen(false);
    onSessionRefresh();
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-auto gap-2 px-2 py-1.5">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">{initials(displayName)}</AvatarFallback>
            </Avatar>
            <span className="text-left">
              <span className="block text-sm font-medium leading-none">{displayName}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{role}</span>
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="font-normal text-muted-foreground">
            {role}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={openProfile}>
            <UserRound />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              void window.netxscan.logout().then(() => onLoggedOut());
            }}
          >
            <LogOut />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Profile</DialogTitle>
            <DialogDescription>
              Full name and position appear as Prepared by on every report.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="profile-fullname">Full name</Label>
              <Input
                id="profile-fullname"
                value={profile.fullName}
                onChange={(event) => setProfile({ ...profile, fullName: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-position">Position</Label>
              <Input
                id="profile-position"
                value={profile.position}
                onChange={(event) => setProfile({ ...profile, position: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-email">Email</Label>
              <Input
                id="profile-email"
                type="email"
                value={profile.email}
                onChange={(event) => setProfile({ ...profile, email: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-contact">Contact</Label>
              <Input
                id="profile-contact"
                value={profile.contact}
                onChange={(event) => setProfile({ ...profile, contact: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-address">Address</Label>
              <Input
                id="profile-address"
                value={profile.address}
                onChange={(event) => setProfile({ ...profile, address: event.target.value })}
              />
            </div>
            {message ? <p className="text-sm text-destructive">{message}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={busy} onClick={() => void save()}>
              Save profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
