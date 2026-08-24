import type { ButtonHTMLAttributes, ReactNode } from 'react';

type BusyButtonProps = {
  busy: boolean;
  busyLabel: string;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function BusyButton({
  busy,
  busyLabel,
  children,
  className = '',
  disabled,
  type = 'button',
  ...rest
}: BusyButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      className={`inline-flex items-center justify-center gap-2 ${className}`.trim()}
      disabled={disabled || busy}
      aria-busy={busy}
    >
      {busy ? <span className="app-spinner-sm" aria-hidden="true" /> : null}
      {busy ? busyLabel : children}
    </button>
  );
}
