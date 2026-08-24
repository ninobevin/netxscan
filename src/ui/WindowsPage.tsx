import { LocalWindowsPanel } from './LocalWindowsPanel';
import { RemoteWindowsPanel } from './RemoteWindowsPanel';

type WindowsPageProps = {
  canRun: boolean;
  refreshKey: number;
  onInventoryChanged: () => void;
};

export function WindowsPage({
  canRun,
  refreshKey,
  onInventoryChanged,
}: WindowsPageProps) {
  return (
    <div className="grid gap-8">
      <LocalWindowsPanel
        canRun={canRun}
        onInventoryChanged={onInventoryChanged}
      />
      <RemoteWindowsPanel canRun={canRun} refreshKey={refreshKey} />
    </div>
  );
}
