import { Badge } from '@/components/ui/badge';
import type { Severity } from './dummy-data';

const SEVERITY_CLASS: Record<Severity, string> = {
  critical: 'border-transparent bg-destructive text-destructive-foreground',
  high: 'border-transparent bg-orange-700 text-white',
  medium: 'border-transparent bg-amber-600 text-white',
  low: 'border-transparent bg-slate-500 text-white',
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <Badge className={SEVERITY_CLASS[severity]}>{severity}</Badge>
  );
}
