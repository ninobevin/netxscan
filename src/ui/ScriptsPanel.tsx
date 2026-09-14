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
import { applyComputerName, defaultNmapBody, defaultWinrmBody } from './prototype/dummy-data';
import type { AdhicsScript, LeafControlOption, ScriptRunner } from '../shared/adhics-types';

type ScriptsPanelProps = {
  focusControlCode?: string | null;
};

type Draft = {
  id?: number;
  controlId: number;
  name: string;
  runner: ScriptRunner;
  enabled: boolean;
  timeoutSec: number;
  body: string;
};

type ScriptFieldsProps = {
  prefix: string;
  value: Draft;
  controls: LeafControlOption[];
  onChange: (next: Draft) => void;
};

function controlLabel(controls: LeafControlOption[], id: number): string {
  const control = controls.find((item) => item.id === id);
  return control ? `${control.code} · ${control.title}` : String(id);
}

function ScriptFields({ prefix, value, controls, onChange }: ScriptFieldsProps) {
  const previewHost = 'RCPT-PC-01';
  const selected = controls.find((item) => item.id === value.controlId);
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Control ID</Label>
          <Select
            value={String(value.controlId)}
            onValueChange={(next) => onChange({ ...value, controlId: Number(next) })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select ADHICS control" />
            </SelectTrigger>
            <SelectContent>
              {controls.map((control) => (
                <SelectItem key={control.id} value={String(control.id)}>
                  {controlLabel(controls, control.id)}
                </SelectItem>
              ))}
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
          onValueChange={(next) => onChange({ ...value, runner: next as ScriptRunner })}
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
          Use <code>{'{{ComputerName}}'}</code> for the target.
          {selected ? ` Bound to ${selected.code}.` : null}
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

function toDraft(script: AdhicsScript): Draft {
  return {
    id: script.id,
    controlId: script.controlId,
    name: script.name,
    runner: script.runner,
    enabled: script.enabled,
    timeoutSec: script.timeoutSec,
    body: script.body,
  };
}

export function ScriptsPanel({ focusControlCode }: ScriptsPanelProps) {
  const [controls, setControls] = useState<LeafControlOption[]>([]);
  const [scripts, setScripts] = useState<AdhicsScript[]>([]);
  const [selectedId, setSelectedId] = useState(0);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addDraft, setAddDraft] = useState<Draft | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    const [leaf, list] = await Promise.all([
      window.netxscan.listLeafControls(),
      window.netxscan.listAssessmentScripts(),
    ]);
    if (!leaf.ok) {
      setMessage(leaf.error);
      return;
    }
    if (!list.ok) {
      setMessage(list.error);
      return;
    }
    setControls(leaf.controls);
    setScripts(list.scripts);
    setMessage(null);
    return { controls: leaf.controls, scripts: list.scripts };
  };

  useEffect(() => {
    void (async () => {
      const loaded = await load();
      if (!loaded) {
        return;
      }
      const focus = focusControlCode
        ? loaded.scripts.find((script) => script.controlCode === focusControlCode)
        : loaded.scripts[0];
      if (focus) {
        setSelectedId(focus.id);
        setDraft(toDraft(focus));
      }
    })();
    // Load once; focus applied when scripts arrive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!focusControlCode) {
      return;
    }
    const next = scripts.find((script) => script.controlCode === focusControlCode);
    if (next) {
      setSelectedId(next.id);
      setDraft(toDraft(next));
    }
  }, [focusControlCode, scripts]);

  const select = (id: number) => {
    const next = scripts.find((script) => script.id === id) ?? null;
    setSelectedId(id);
    setDraft(next ? toDraft(next) : null);
    setMessage(null);
  };

  const onSave = async () => {
    if (!draft?.id) {
      return;
    }
    const result = await window.netxscan.saveAssessmentScript({
      id: draft.id,
      controlId: draft.controlId,
      name: draft.name,
      runner: draft.runner,
      enabled: draft.enabled,
      timeoutSec: draft.timeoutSec,
      body: draft.body,
    });
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    setScripts(result.scripts);
    showSaveSuccess();
  };

  const onDelete = async () => {
    if (!draft?.id) {
      return;
    }
    const result = await window.netxscan.deleteAssessmentScript(draft.id);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    setScripts(result.scripts);
    const next = result.scripts[0] ?? null;
    setSelectedId(next?.id ?? 0);
    setDraft(next ? toDraft(next) : null);
    showSaveSuccess();
  };

  const setResult = async (result: 'pass' | 'fail') => {
    if (!draft?.id) {
      return;
    }
    const next = await window.netxscan.setScriptResult(draft.id, result);
    if (!next.ok) {
      setMessage(next.error);
      return;
    }
    setScripts(next.scripts);
    const updated = next.scripts.find((script) => script.id === draft.id);
    if (updated) {
      setDraft(toDraft(updated));
    }
  };

  const openAdd = () => {
    if (controls.length === 0) {
      setMessage('Add an ADHICS control first.');
      return;
    }
    const controlId = draft?.controlId ?? controls[0].id;
    const code = controls.find((item) => item.id === controlId)?.code ?? 'CO';
    setAddDraft({
      controlId,
      name: '',
      runner: 'winrm',
      enabled: true,
      timeoutSec: 30,
      body: defaultWinrmBody(code),
    });
    setAddOpen(true);
    setMessage(null);
  };

  const saveAdd = async () => {
    if (!addDraft) {
      return;
    }
    const result = await window.netxscan.saveAssessmentScript(addDraft);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    setScripts(result.scripts);
    const created = result.scripts.find(
      (script) =>
        script.controlId === addDraft.controlId && script.name === addDraft.name.trim(),
    );
    if (created) {
      setSelectedId(created.id);
      setDraft(toDraft(created));
    }
    setAddOpen(false);
    setAddDraft(null);
    showSaveSuccess();
  };

  const listed = [...scripts].sort((a, b) => {
    const byControl = a.controlCode.localeCompare(b.controlCode);
    if (byControl !== 0) {
      return byControl;
    }
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Scripts attach only to dotted controls (CO 1.2, CO 2.3). Fail counts as one finding.
      </p>
      {message ? <p className="text-sm text-destructive">{message}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={openAdd} disabled={controls.length === 0}>
          New
        </Button>
        <Button onClick={() => void onSave()} disabled={!draft?.id}>
          Save
        </Button>
        <Button variant="secondary" onClick={() => void onDelete()} disabled={!draft?.id}>
          Delete
        </Button>
        <Button variant="secondary" onClick={() => void setResult('pass')} disabled={!draft?.id}>
          Pass
        </Button>
        <Button variant="secondary" onClick={() => void setResult('fail')} disabled={!draft?.id}>
          Fail
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
              <p className="font-mono text-xs">{script.controlCode}</p>
              <p className="text-sm font-medium">{script.name}</p>
              <p className="text-xs text-muted-foreground">
                {script.runner === 'nmap' ? 'Via Nmap' : 'WinRM'} · {script.lastResult ?? 'unset'}
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
        {draft ? (
          <div className="rounded-xl border bg-card p-4">
            <ScriptFields prefix="edit" value={draft} controls={controls} onChange={setDraft} />
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
                  if (next.runner !== addDraft.runner || next.controlId !== addDraft.controlId) {
                    const code = controls.find((item) => item.id === next.controlId)?.code ?? 'CO';
                    const body =
                      next.runner === 'nmap' ? defaultNmapBody(code) : defaultWinrmBody(code);
                    const prevCode =
                      controls.find((item) => item.id === addDraft.controlId)?.code ?? 'CO';
                    const looksDefault =
                      addDraft.body === defaultWinrmBody(prevCode) ||
                      addDraft.body === defaultNmapBody(prevCode);
                    setAddDraft(looksDefault ? { ...next, body } : next);
                    return;
                  }
                  setAddDraft(next);
                }}
              />
              <Button onClick={() => void saveAdd()}>Save</Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
