import { ipcMain } from 'electron';
import { requireAppSession, requireRole } from '../auth/session';
import { errorMessage } from '../ipc/error-message';
import { ipcChannels } from '../shared/ipc-channels';
import type { ControlStatus, FindingStatus, ScriptResult, ScriptRunner } from '../shared/adhics-types';
import {
  buildReportSections,
  deleteControl,
  deleteDomain,
  deleteFamily,
  deleteScript,
  listAdhicsTree,
  listFindings,
  listLeafControls,
  listScripts,
  saveControl,
  saveDomain,
  saveFamily,
  saveScript,
  setScriptResult,
  updateFindingStatus,
} from './repository';

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return undefined;
}

function body(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== 'object') {
    return {};
  }
  return payload as Record<string, unknown>;
}

function wrapTree(fn: () => ReturnType<typeof listAdhicsTree>) {
  try {
    requireRole('administrator');
    return { ok: true as const, domains: fn() };
  } catch (error) {
    return { ok: false as const, error: errorMessage(error) };
  }
}

export function registerAdhicsIpc(): void {
  ipcMain.handle(ipcChannels.adhicsTree, () => {
    try {
      requireAppSession();
      return { ok: true, domains: listAdhicsTree() };
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle(ipcChannels.adhicsLeafList, () => {
    try {
      requireAppSession();
      return { ok: true, controls: listLeafControls() };
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle(ipcChannels.adhicsSaveDomain, (_event, payload: unknown) => {
    const input = body(payload);
    return wrapTree(() =>
      saveDomain({
        id: asNumber(input.id),
        code: asString(input.code),
        name: asString(input.name),
      }),
    );
  });

  ipcMain.handle(ipcChannels.adhicsDeleteDomain, (_event, payload: unknown) => {
    const id = asNumber(body(payload).id);
    if (!id) {
      return { ok: false, error: 'Domain id is required.' };
    }
    return wrapTree(() => deleteDomain(id));
  });

  ipcMain.handle(ipcChannels.adhicsSaveFamily, (_event, payload: unknown) => {
    const input = body(payload);
    const domainId = asNumber(input.domainId);
    if (!domainId) {
      return { ok: false, error: 'Domain is required.' };
    }
    return wrapTree(() =>
      saveFamily({
        id: asNumber(input.id),
        domainId,
        code: asString(input.code),
        title: asString(input.title),
      }),
    );
  });

  ipcMain.handle(ipcChannels.adhicsDeleteFamily, (_event, payload: unknown) => {
    const id = asNumber(body(payload).id);
    if (!id) {
      return { ok: false, error: 'Family id is required.' };
    }
    return wrapTree(() => deleteFamily(id));
  });

  ipcMain.handle(ipcChannels.adhicsSaveControl, (_event, payload: unknown) => {
    const input = body(payload);
    const familyId = asNumber(input.familyId);
    if (!familyId) {
      return { ok: false, error: 'Family is required.' };
    }
    return wrapTree(() =>
      saveControl({
        id: asNumber(input.id),
        familyId,
        code: asString(input.code),
        title: asString(input.title),
        tags: asString(input.tags),
        description: asString(input.description),
        status: asString(input.status) as ControlStatus,
      }),
    );
  });

  ipcMain.handle(ipcChannels.adhicsDeleteControl, (_event, payload: unknown) => {
    const id = asNumber(body(payload).id);
    if (!id) {
      return { ok: false, error: 'Control id is required.' };
    }
    return wrapTree(() => deleteControl(id));
  });

  ipcMain.handle(ipcChannels.scriptList, () => {
    try {
      requireAppSession();
      return { ok: true, scripts: listScripts() };
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle(ipcChannels.scriptSave, (_event, payload: unknown) => {
    try {
      requireRole('administrator');
      const input = body(payload);
      const controlId = asNumber(input.controlId);
      if (!controlId) {
        return { ok: false, error: 'Control is required.' };
      }
      return {
        ok: true,
        scripts: saveScript({
          id: asNumber(input.id),
          controlId,
          name: asString(input.name),
          runner: asString(input.runner) as ScriptRunner,
          enabled: Boolean(input.enabled),
          timeoutSec: asNumber(input.timeoutSec) ?? 30,
          body: asString(input.body),
        }),
      };
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle(ipcChannels.scriptDelete, (_event, payload: unknown) => {
    try {
      requireRole('administrator');
      const id = asNumber(body(payload).id);
      if (!id) {
        return { ok: false, error: 'Script id is required.' };
      }
      return { ok: true, scripts: deleteScript(id) };
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle(ipcChannels.scriptSetResult, (_event, payload: unknown) => {
    try {
      requireAppSession();
      const input = body(payload);
      const id = asNumber(input.id);
      const result = asString(input.result) as ScriptResult;
      if (!id) {
        return { ok: false, error: 'Script id is required.' };
      }
      return { ok: true, scripts: setScriptResult(id, result) };
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle(ipcChannels.findingList, () => {
    try {
      requireAppSession();
      return { ok: true, findings: listFindings() };
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle(ipcChannels.findingUpdateStatus, (_event, payload: unknown) => {
    try {
      requireAppSession();
      const input = body(payload);
      const id = asNumber(input.id);
      if (!id) {
        return { ok: false, error: 'Finding id is required.' };
      }
      return {
        ok: true,
        findings: updateFindingStatus(id, asString(input.status) as FindingStatus),
      };
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle(ipcChannels.adhicsReportData, () => {
    try {
      requireAppSession();
      return { ok: true, domains: buildReportSections() };
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    }
  });
}
