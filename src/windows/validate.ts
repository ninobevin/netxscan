export function parseUninstallKey(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const key = value.trim();

  if (key.length < 1 || key.length > 128) {
    return null;
  }

  if (!/^[A-Za-z0-9._\-{}]+$/.test(key)) {
    return null;
  }

  return key;
}

export function parseUninstallMode(value: unknown): 'local' | 'remote' | null {
  return value === 'local' || value === 'remote' ? value : null;
}
