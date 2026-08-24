let scanInProgress = false;

export function tryStartScan(): boolean {
  if (scanInProgress) {
    return false;
  }

  scanInProgress = true;
  return true;
}

export function endScan(): void {
  scanInProgress = false;
}
