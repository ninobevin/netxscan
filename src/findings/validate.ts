import { FINDING_STATUSES, type FindingStatus } from '../shared/finding-types';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseFindingStatus(value: unknown): FindingStatus | null {
  return typeof value === 'string' &&
    FINDING_STATUSES.includes(value as FindingStatus)
    ? (value as FindingStatus)
    : null;
}

export function parseFindingId(value: unknown): string | null {
  return typeof value === 'string' && UUID.test(value.trim())
    ? value.trim()
    : null;
}

export function parseFindingNotes(value: unknown): string | null {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value !== 'string') {
    return null;
  }

  return value.trim().slice(0, 2000);
}

export function parseFindingFilter(value: unknown): FindingStatus | 'all' {
  if (value === undefined || value === null || value === '' || value === 'all') {
    return 'all';
  }

  return parseFindingStatus(value) ?? 'all';
}
