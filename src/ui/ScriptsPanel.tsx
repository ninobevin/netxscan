import { useEffect, useState } from 'react';
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
import { showSaveSuccess } from './show-save-success';
import {
  DUMMY_SCRIPTS,
  applyComputerName,
  defaultNmapBody,
  defaultWinrmBody,
  type DummyControl,
  type DummyScript,
  type ScriptRunner,
} from './prototype/dummy-data';

type ScriptsPanelProps = {
  controls: DummyControl[];
  focusControlId?: string | null;
};

type ScriptFieldsProps = {
  prefix: string;
  value: DummyScript;
  controls: DummyControl[];
  onChange: (next: DummyScript) => void;
};

function controlLabel(controls: DummyControl[], id: string): string {
  const control = controls.find((item) => item.id === id);
  return control ? `${control.id} · ${control.domain} · ${control.description}` : id;
}

function ScriptFields({ prefix, value, controls, onChange }: ScriptFieldsProps) {
  const previewHost = 'RCPT-PC-01';
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Control ID</Label>
          <Select
            value={value.controlId}
            onValueChange={(next) => onChange({ ...value, controlId: next })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select ADHICS control" />
            </SelectTrigger>
            <SelectContent>
              {controls.map((control) => (
                <SelectItem key={control.id} value={control.id}>
                  {controlLabel(controls, control.id)}
                </SelectItem>
              ))}
              {controls.some((control) => control.id === value.controlId)
                ? null
                : value.controlId
                  ? (
                      <SelectItem value={value.controlId}>
                        {value.controlId} (removed from catalog)
                      </SelectItem>
                    )
                  : null}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${prefix}-to`}>Timeout (sec)</Label>
          <Input
            id={`${prefix}-to`}
            type="number"
            value={value.timeoutSec}
            onChange={(event) =>
              onChange({ ...value, timeoutSec: Number(event.target.value) || 0 })
            }
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${prefix}-name`}>Name</Label>
        <Input
          id={`${prefix}-name`}
          value={value.name}
          onChange={(event) => onChange({ ...value, name: event.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>Run via</Label>
        <Select
          value={value.runner}
          onValueChange={(next) =>
            onChange({ ...value, runner: next as ScriptRunner })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="winrm">WinRM (domain-joined)</SelectItem>
            <SelectItem value="nmap">Via Nmap (not domain-joined)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          type="button"
          onClick={() => onChange({ ...value, enabled: !value.enabled })}
        >
          {value.enabled ? 'Disable' : 'Enable'}
        </Button>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${prefix}-body`}>Script body</Label>
        <textarea
          id={`${prefix}-body`}
          className="min-h-[14rem] w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs"
          value={value.body}
          onChange={(event) => onChange({ ...value, body: event.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Use <code>{'{{ComputerName}}'}</code> for the target. WinRM becomes{' '}
          <code>Invoke-Command -ComputerName RCPT-PC-01</code> when run against that host.
        </p>
        {value.body.includes('{{ComputerName}}') ? (
          <p className="font-mono text-[11px] text-muted-foreground">
            Preview: {applyComputerName('{{ComputerName}}', previewHost)}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function ScriptsPanel({ controls, focusControlId }: ScriptsPanelProps) {
  const [scripts, setScripts] = useState<DummyScript[]>(DUMMY_SCRIPTS);
  const [selectedId, setSelectedId] = useState(scripts[0]?.id ?? 0);
  const [draft, setDraft] = useState<DummyScript | null>(
    scripts[0] ? { ...scripts[0] } : null,
  );
  const [addOpen, setAddOpen] = useState(false);
  const [addDraft, setAddDraft] = useState<DummyScript | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!focusControlId) {
      return;
    }
    const next = scripts.find((script) => script.controlId === focusControlId);
    if (next) {
      setSelectedId(next.id);
      setDraft({ ...next });
    }
  }, [focusControlId, scripts]);

  const show = draft;

  const select = (id: number) => {
    const next = scripts.find((script) => script.id === id) ?? null;
    setSelectedId(id);
    setDraft(next ? { ...next } : null);
    setMessage(null);
  };

  const onSave = () => {
    if (!draft) {
      return;
    }
    setScripts((current) =>
      current.map((script) => (script.id === draft.id ? draft : script)),
    );
    showSaveSuccess();
  };

  const openAdd = () => {
    if (controls.length === 0) {
      setMessage('Add an ADHICS control first.');
      return;
    }
    const controlId = draft?.controlId ?? controls[0].id;
    setAddDraft({
      id: 0,
      controlId,
      name: '',
      runner: 'winrm',
      enabled: true,
      timeoutSec: 30,
      body: defaultWinrmBody(controlId),
    });
    setAddOpen(true);
    setMessage(null);
  };

  const saveAdd = () => {
    if (!addDraft) {
      return;
    }
    if (!addDraft.name.trim()) {
      setMessage('Script name is required.');
      return;
    }
    const nextId = Math.max(0, ...scripts.map((script) => script.id)) + 1;
    const created: DummyScript = {
      ...addDraft,
      id: nextId,
      name: addDraft.name.trim(),
    };
    setScripts((current) => [...current, created]);
    setSelectedId(created.id);
    setDraft(created);
    setAddOpen(false);
    setAddDraft(null);
    showSaveSuccess();
  };

  const listed = [...scripts].sort((a, b) => {
    const byControl = a.controlId.localeCompare(b.controlId);
    if (byControl !== 0) {
      return byControl;
    }
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        A control can have multiple scripts. WinRM scripts use{' '}
        <code className="text-xs">Invoke-Command -ComputerName {'{{ComputerName}}'}</code>
        ; the app replaces the placeholder with each inventory hostname. Nmap scripts
        use the same placeholder for IP/hostname.
      </p>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      <div className="flex gap-2">
        <Button variant="secondary" onClick={openAdd} disabled={controls.length === 0}>
          New
        </Button>
        <Button onClick={onSave} disabled={!draft}>
          Save
        </Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
        <div className="max-h-[32rem] divide-y overflow-auto rounded-xl border bg-card">
          {listed.map((script) => (
            <button
              key={script.id}
              type="button"
              className={
                script.id === selectedId
                  ? 'block w-full bg-muted px-3 py-3 text-left'
                  : 'block w-full px-3 py-3 text-left hover:bg-muted/60'
              }
              onClick={() => select(script.id)}
            >
              <p className="font-mono text-xs">{script.controlId}</p>
              <p className="text-sm font-medium">{script.name}</p>
              <p className="text-xs text-muted-foreground">
                {script.runner === 'nmap' ? 'Via Nmap' : 'WinRM'}
              </p>
              {script.enabled ? (
                <Badge className="mt-1">enabled</Badge>
              ) : (
                <Badge variant="secondary" className="mt-1">
                  disabled
                </Badge>
              )}
            </button>
          ))}
        </div>
        {show ? (
          <div className="rounded-xl border bg-card p-4">
            <ScriptFields
              prefix="edit"
              value={show}
              controls={controls}
              onChange={setDraft}
            />
          </div>
        ) : null}
      </div>
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add script</DialogTitle>
          </DialogHeader>
          {addDraft ? (
            <div className="space-y-3">
              <ScriptFields
                prefix="add"
                value={addDraft}
                controls={controls}
                onChange={(next) => {
                  if (
                    next.runner !== addDraft.runner ||
                    next.controlId !== addDraft.controlId
                  ) {
                    const body =
                      next.runner === 'nmap'
                        ? defaultNmapBody(next.controlId)
                        : defaultWinrmBody(next.controlId);
                    const looksDefault =
                      addDraft.body === defaultWinrmBody(addDraft.controlId) ||
                      addDraft.body === defaultNmapBody(addDraft.controlId);
                    setAddDraft(looksDefault ? { ...next, body } : next);
                    return;
                  }
                  setAddDraft(next);
                }}
              />
              <Button onClick={saveAdd}>Save</Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
