type LoadingScreenProps = {
  label?: string;
};

export function LoadingScreen({ label = 'Loading…' }: LoadingScreenProps) {
  return (
    <section
      className="app-card min-h-[20rem] items-center justify-center py-16"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="app-spinner" aria-hidden="true" />
      <p className="text-sm text-health-subtle">{label}</p>
    </section>
  );
}
