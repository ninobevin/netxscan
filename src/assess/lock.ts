let busy = false;

export function tryStartAssess(): boolean {
  if (busy) {
    return false;
  }
  busy = true;
  return true;
}

export function endAssess(): void {
  busy = false;
}
