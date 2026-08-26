let winrmInProgress = false;

export function tryStartWinrm(): boolean {
  if (winrmInProgress) {
    return false;
  }

  winrmInProgress = true;
  return true;
}

export function endWinrm(): void {
  winrmInProgress = false;
}
