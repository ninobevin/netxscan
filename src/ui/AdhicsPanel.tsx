import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { showSaveSuccess } from './show-save-success';
import { SeverityBadge } from './prototype/SeverityBadge';
import {
  DUMMY_FINDINGS,
  assetById,
  scriptsForControl,
  type ControlStatus,
  type DummyControl,
} from './prototype/dummy-data';

const EMPTY: DummyControl = {
  id: '',
  domain: '',
  description: '',
  status: 'not_assessed',
};

type AdhicsPanelProps = {
  controls: DummyControl[];
  onControlsChange: (next: DummyControl[]) => void;
  onOpenAsset: (id: number) => void;
  onOpenScripts: (controlId: string) => void;
};

export function AdhicsPanel({
  controls,
  onControlsChange,
  onOpenAsset,
  onOpenScripts,
}: AdhicsPanelProps) {
  const [viewId, setViewId] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null);
  const [draft, setDraft] = useState<DummyControl>(EMPTY);
  const [originalId, setOriginalId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const viewControl = controls.find((item) => item.id === viewId) ?? null;
  const linked = DUMMY_FINDINGS.filter((finding) => finding.controlId === viewId);

  const openCreate = () => {
    setDraft({ ...EMPTY });
    setOriginalId(null);
    setFormMode('create');
  };

  const openEdit = (control: DummyControl) => {
    setDraft({ ...control });
    setOriginalId(control.id);
    setViewId(null);
    setFormMode('edit');
  };

  const saveForm = () => {
    const id = draft.id.trim();
    const domain = draft.domain.trim();
    const description = draft.description.trim();
    if (!id || !domain || !description) {
      setMessage('ID, domain, and description are required.');
      return;
    }
    const duplicate = controls.some(
      (control) => control.id === id && control.id !== originalId,
    );
    if (duplicate) {
      setMessage('A control with that ID already exists.');
      return;
    }
    const nextRow: DummyControl = { ...draft, id, domain, description };
    if (formMode === 'create') {
      onControlsChange([...controls, nextRow]);
    } else if (originalId) {
      onControlsChange(
        controls.map((control) => (control.id === originalId ? nextRow : control)),
      );
    }
    setFormMode(null);
    showSaveSuccess();
  };

  const remove = (id: string) => {
    onControlsChange(controls.filter((control) => control.id !== id));
    setViewId(null);
    setFormMode(null);
    showSaveSuccess();
  };

  return (
    <div className="space-y-4">
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      <Button variant="secondary" onClick={openCreate}>
        Add control
      </Button>
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Domain</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Findings</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {controls.map((row) => {
              const count = DUMMY_FINDINGS.filter(
                (finding) => finding.controlId === row.id,
              ).length;
              return (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => setViewId(row.id)}
                >
                  <TableCell className="font-mono">{row.id}</TableCell>
                  <TableCell>{row.domain}</TableCell>
                  <TableCell className="max-w-md">{row.description}</TableCell>
                  <TableCell>{count}</TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <Dialog open={viewControl !== null} onOpenChange={(open) => !open && setViewId(null)}>
        <DialogContent>
          {viewControl ? (
            <>
              <DialogHeader>
                <DialogTitle>{viewControl.id}</DialogTitle>
              </DialogHeader>
              <ControlBody
                control={viewControl}
                findings={linked}
                onOpenAsset={onOpenAsset}
                onOpenScripts={onOpenScripts}
                onEdit={() => openEdit(viewControl)}
                onDelete={() => remove(viewControl.id)}
                onClose={() => setViewId(null)}
              />
            </>
          ) : null}
        </DialogContent>
      </Dialog>
      <Dialog open={formMode !== null} onOpenChange={(open) => !open && setFormMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {formMode === 'edit' ? 'Edit control' : 'Add control'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="ctl-id">Control ID</Label>
              <Input
                id="ctl-id"
                value={draft.id}
                onChange={(event) => setDraft({ ...draft, id: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ctl-domain">Domain</Label>
              <Input
                id="ctl-domain"
                value={draft.domain}
                onChange={(event) => setDraft({ ...draft, domain: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ctl-description">Description</Label>
              <textarea
                id="ctl-description"
                rows={3}
                value={draft.description}
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={draft.status}
                onValueChange={(value) =>
                  setDraft({ ...draft, status: value as ControlStatus })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mapped">mapped</SelectItem>
                  <SelectItem value="gap">gap</SelectItem>
                  <SelectItem value="not_assessed">not assessed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={saveForm}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status: DummyControl['status'] }) {
  if (status === 'gap') {
    return <Badge variant="destructive">gap</Badge>;
  }
  if (status === 'mapped') {
    return <Badge>mapped</Badge>;
  }
  return <Badge variant="secondary">not assessed</Badge>;
}

function ControlBody({
  control,
  findings,
  onOpenAsset,
  onOpenScripts,
  onEdit,
  onDelete,
  onClose,
}: {
  control: DummyControl;
  findings: typeof DUMMY_FINDINGS;
  onOpenAsset: (id: number) => void;
  onOpenScripts: (controlId: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const linkedScripts = scriptsForControl(control.id);
  return (
    <div className="space-y-3 text-sm">
      <p>
        Domain {control.domain} · <StatusBadge status={control.status} />
      </p>
      <p>{control.description}</p>
      <p className="text-muted-foreground">
        {linkedScripts.length === 0
          ? 'No scripts for this control.'
          : linkedScripts.map((script) => script.name).join(', ')}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            onOpenScripts(control.id);
            onClose();
          }}
        >
          Open script
        </Button>
        <Button size="sm" variant="secondary" onClick={onEdit}>
          Edit
        </Button>
        <Button size="sm" variant="destructive" onClick={onDelete}>
          Delete
        </Button>
      </div>
      <div className="space-y-2">
        {findings.length === 0 ? (
          <p className="text-muted-foreground">No dummy findings mapped.</p>
        ) : (
          findings.map((finding) => {
            const asset = assetById(finding.assetId);
            return (
              <button
                key={finding.id}
                type="button"
                className="flex w-full items-start justify-between gap-2 rounded-lg border px-3 py-2 text-left"
                onClick={() => {
                  onOpenAsset(finding.assetId);
                  onClose();
                }}
              >
                <span>
                  <SeverityBadge severity={finding.severity} />
                  <span className="ml-2">{finding.title}</span>
                  <span className="mt-1 block font-mono text-xs text-muted-foreground">
                    {asset?.ipv4}
                  </span>
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
