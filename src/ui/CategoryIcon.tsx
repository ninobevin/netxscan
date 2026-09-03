import type { LucideIcon } from 'lucide-react';
import {
  Cctv,
  CircleDashed,
  HardDrive,
  Laptop,
  Monitor,
  Network,
  Printer,
  Radio,
  Router,
  Server,
  Shield,
  Smartphone,
  Tag,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const ICONS: Record<string, LucideIcon> = {
  Monitor,
  Laptop,
  Cctv,
  HardDrive,
  Network,
  Shield,
  Printer,
  Server,
  Router,
  Smartphone,
  Radio,
  Tag,
  CircleDashed,
};

type CategoryIconProps = {
  name?: string | null;
  className?: string;
};

export function CategoryIcon({ name, className }: CategoryIconProps) {
  const Icon = (name && ICONS[name]) || Tag;
  return <Icon className={cn('h-4 w-4 shrink-0', className)} />;
}
