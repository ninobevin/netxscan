import { useCallback, useEffect, useState } from 'react';
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
import type { PublicSession } from '../shared/auth-types';
import type {
  AdhicsControl,
  AdhicsDomain,
  AdhicsFamily,
  AdhicsScript,
  ControlStatus,
  ScriptResult,
} from '../shared/adhics-types';
import { defaultWinrmBody } from './prototype/dummy-data';

type FormKind = 'domain' | 'family' | 'control' | 'script' | null;

type AdhicsPanelProps = {
  session: PublicSession;
  onOpenScripts: (controlCode: string) => void;
};

export function AdhicsPanel({ session, onOpenScripts }: AdhicsPanelProps) {
  const isAdmin = session.role === 'administrator';
  const [domains, setDomains] = useState<AdhicsDomain[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState<FormKind>(null);
  const [domainId, setDomainId] = useState<number | null>(null);
  const [familyId, setFamilyId] = useState<number | null>(null);
  const [controlId, setControlId] = useState<number | null>(null);
  const [editId, setEditId] = useState<number | undefined>(undefined);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ControlStatus>('not_assessed');
  const [controlCode, setControlCode] = useState('');
  const [scriptName, setScriptName] = useState('');

  const load = useCallback(async () => {
    const result = await window.netxscan.getAdhicsTree();
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    setDomains(result.domains);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const applyTree = (result: { ok: true; domains: AdhicsDomain[] } | { ok: false; error: string }) => {
    if (!result.ok) {
      setMessage(result.error);
      return false;
    }
    setDomains(result.domains);
    setMessage(null);
    showSaveSuccess();
    return true;
  };

  const closeForm = () => {
    setForm(null);
    setEditId(undefined);
    setCode('');
    setName('');
    setTitle('');
    setTags('');
    setDescription('');
    setStatus('not_assessed');
    setScriptName('');
    setControlCode('');
  };

  const openDomain = (domain?: AdhicsDomain) => {
    setForm('domain');
    setEditId(domain?.id);
    setCode(domain?.code ?? '');
    setName(domain?.name ?? '');
  };

  const openFamily = (parentDomainId: number, family?: AdhicsFamily) => {
    setForm('family');
    setDomainId(parentDomainId);
    setEditId(family?.id);
    setCode(family?.code ?? '');
    setTitle(family?.title ?? '');
  };

  const openControl = (parentFamilyId: number, control?: AdhicsControl) => {
    setForm('control');
    setFamilyId(parentFamilyId);
    setEditId(control?.id);
    setCode(control?.code ?? '');
    setTitle(control?.title ?? '');
    setTags(control?.tags ?? '');
    setDescription(control?.description ?? '');
    setStatus(control?.status ?? 'not_assessed');
  };

  const openScript = (parentControlId: number, parentCode: string) => {
    setForm('script');
    setControlId(parentControlId);
    setControlCode(parentCode);
    setScriptName('');
  };

  const saveForm = async () => {
    if (form === 'domain') {
      if (!applyTree(await window.netxscan.saveAdhicsDomain({ id: editId, code, name }))) {
        return;
      }
    } else if (form === 'family' && domainId) {
      if (
        !applyTree(
          await window.netxscan.saveAdhicsFamily({ id: editId, domainId, code, title }),
        )
      ) {
        return;
      }
    } else if (form === 'control' && familyId) {
      if (
        !applyTree(
          await window.netxscan.saveAdhicsControl({
            id: editId,
            familyId,
            code,
            title,
            tags,
            description,
            status,
          }),
        )
      ) {
        return;
      }
    } else if (form === 'script' && controlId) {
      const result = await window.netxscan.saveAssessmentScript({
        controlId,
        name: scriptName,
        runner: 'winrm',
        enabled: true,
        timeoutSec: 30,
        body: defaultWinrmBody(controlCode || 'CO'),
      });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      await load();
      showSaveSuccess();
    }
    closeForm();
  };

  const removeDomain = async (id: number) => {
    applyTree(await window.netxscan.deleteAdhicsDomain(id));
  };
  const removeFamily = async (id: number) => {
    applyTree(await window.netxscan.deleteAdhicsFamily(id));
  };
  const removeControl = async (id: number) => {
    applyTree(await window.netxscan.deleteAdhicsControl(id));
  };
  const removeScript = async (id: number) => {
    const result = await window.netxscan.deleteAssessmentScript(id);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    await load();
    showSaveSuccess();
  };

  const setResult = async (script: AdhicsScript, result: ScriptResult) => {
    const next = await window.netxscan.setScriptResult(script.id, result);
    if (!next.ok) {
      setMessage(next.error);
      return;
    }
    await load();
  };

  return (
    <div className="space-y-4">
      {message ? <p className="text-sm text-destructive">{message}</p> : null}
      {isAdmin ? (
        <Button variant="secondary" onClick={() => openDomain()}>
          Add domain
        </Button>
      ) : null}
      {domains.length === 0 ? (
        <p className="text-sm text-muted-foreground">No ADHICS domains yet.</p>
      ) : null}
      {domains.map((domain) => (
        <section key={domain.id} className="space-y-3 rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">
              Domain {domain.code} – {domain.name}
            </h2>
            {isAdmin ? (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => openFamily(domain.id)}>
                  Add family
                </Button>
                <Button size="sm" variant="secondary" onClick={() => openDomain(domain)}>
                  Edit
                </Button>
                <Button size="sm" variant="secondary" onClick={() => void removeDomain(domain.id)}>
                  Delete
                </Button>
              </div>
            ) : null}
          </div>
          {domain.families.map((family) => (
            <div key={family.id} className="space-y-2 border-t pt-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">
                  {family.code} {family.title}
                </h3>
                {isAdmin ? (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => openControl(family.id)}>
                      Add control
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => openFamily(domain.id, family)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => void removeFamily(family.id)}>
                      Delete
                    </Button>
                  </div>
                ) : null}
              </div>
              {family.controls.map((control) => (
                <div key={control.id} className="rounded-lg border px-3 py-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-sm font-medium">
                        {control.code} {control.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {control.tags ? `[${control.tags}] · ` : null}
                        {control.scriptCount} scripts · {control.findingCount} findings · {control.status}
                      </p>
                    </div>
                    {isAdmin ? (
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="secondary" onClick={() => openScript(control.id, control.code)}>
                          Add script
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => onOpenScripts(control.code)}
                        >
                          Scripts
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => openControl(family.id, control)}>
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => void removeControl(control.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => onOpenScripts(control.code)}
                      >
                        Scripts
                      </Button>
                    )}
                  </div>
                  <ul className="mt-2 space-y-1">
                    {control.scripts.map((script) => (
                      <li
                        key={script.id}
                        className="flex flex-wrap items-center justify-between gap-2 text-sm"
                      >
                        <span>
                          {script.name}{' '}
                          <Badge variant="secondary">{script.lastResult ?? 'unset'}</Badge>
                        </span>
                        <span className="flex flex-wrap gap-1">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => void setResult(script, 'pass')}
                          >
                            Pass
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => void setResult(script, 'fail')}
                          >
                            Fail
                          </Button>
                          {isAdmin ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => void removeScript(script.id)}
                            >
                              Delete
                            </Button>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ))}
        </section>
      ))}
      <Dialog open={form !== null} onOpenChange={(open) => !open && closeForm()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {form === 'domain'
                ? editId
                  ? 'Edit domain'
                  : 'Add domain'
                : form === 'family'
                  ? editId
                    ? 'Edit family'
                    : 'Add family'
                  : form === 'control'
                    ? editId
                      ? 'Edit control'
                      : 'Add control'
                    : 'Add script'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {form === 'domain' ? (
              <>
                <div className="space-y-2">
                  <Label>Code</Label>
                  <Input value={code} onChange={(event) => setCode(event.target.value)} placeholder="5" />
                </div>
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Communications and Operations Management"
                  />
                </div>
              </>
            ) : null}
            {form === 'family' ? (
              <>
                <div className="space-y-2">
                  <Label>Code</Label>
                  <Input value={code} onChange={(event) => setCode(event.target.value)} placeholder="CO 1" />
                </div>
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input value={title} onChange={(event) => setTitle(event.target.value)} />
                </div>
              </>
            ) : null}
            {form === 'control' ? (
              <>
                <div className="space-y-2">
                  <Label>Control ID</Label>
                  <Input value={code} onChange={(event) => setCode(event.target.value)} placeholder="CO 1.2" />
                </div>
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input value={title} onChange={(event) => setTitle(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Tags</Label>
                  <Input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="T,S" />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <textarea
                    className="min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={status} onValueChange={(value) => setStatus(value as ControlStatus)}>
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
              </>
            ) : null}
            {form === 'script' ? (
              <div className="space-y-2">
                <Label>Script name</Label>
                <Input value={scriptName} onChange={(event) => setScriptName(event.target.value)} />
              </div>
            ) : null}
            <Button onClick={() => void saveForm()}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
