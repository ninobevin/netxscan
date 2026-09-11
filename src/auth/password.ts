export const MIN_PASSWORD = 8;

export function parsePassword(value: unknown, required: boolean): string | null | { error: string } {
  const password = typeof value === 'string' ? value : '';
  if (!password) {
    return required ? { error: 'Password is required.' } : null;
  }
  if (password.length < MIN_PASSWORD) {
    return { error: `Password must be at least ${MIN_PASSWORD} characters.` };
  }
  return password;
}
