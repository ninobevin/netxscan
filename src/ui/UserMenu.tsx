import { LogOut } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { PublicSession } from '../shared/auth-types';

type UserMenuProps = {
  session: PublicSession;
  onLoggedOut: () => void;
};

function initials(username: string): string {
  const parts = username.trim().split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return username.slice(0, 2).toUpperCase() || '?';
}

function roleLabel(role: PublicSession['role']): string {
  return role === 'administrator' ? 'Administrator' : 'User';
}

export function UserMenu({ session, onLoggedOut }: UserMenuProps) {
  const role = roleLabel(session.role);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-auto gap-2 px-2 py-1.5">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">{initials(session.username)}</AvatarFallback>
          </Avatar>
          <span className="text-left">
            <span className="block text-sm font-medium leading-none">{session.username}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{role}</span>
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="font-normal text-muted-foreground">
          {role}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
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
  );
}
