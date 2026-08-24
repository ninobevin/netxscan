export function parseCredentialLabel(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const label = value.trim();

  if (label.length < 1 || label.length > 80) {
    return null;
  }

  if (!/^[A-Za-z0-9 ._\-]+$/.test(label)) {
    return null;
  }

  return label;
}

export function parseCredentialUsername(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const username = value.trim();

  if (username.length < 1 || username.length > 256) {
    return null;
  }

  if (!/^[A-Za-z0-9._\\@\-]+$/.test(username)) {
    return null;
  }

  return username;
}

export function parseCredentialPassword(value: unknown): string | null {
  if (typeof value !== 'string' || value.length < 1 || value.length > 512) {
    return null;
  }

  if (value.includes('\0')) {
    return null;
  }

  return value;
}

export function parseCredentialId(value: unknown): string | null {
  if (typeof value !== 'string' || value.length !== 36) {
    return null;
  }

  if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value)) {
    return null;
  }

  return value.toLowerCase();
}

export function credentialTarget(id: string): string {
  return `NetXScan/${id}`;
}

export function parseCredentialTarget(target: string): string | null {
  if (!target.startsWith('NetXScan/')) {
    return null;
  }

  return parseCredentialId(target.slice('NetXScan/'.length));
}
