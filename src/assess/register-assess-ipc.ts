import { app, ipcMain } from 'electron';
import path from 'node:path';
import { getAssetById } from '../assets/repository';
import { parseAssetId } from '../assets/validate';
import { requireRole } from '../auth/session';
import { writeAudit } from '../audit/repository';
import { loadAuthorizedRanges } from '../nmap/load-ranges';
import { ipcChannels } from '../shared/ipc-channels';
import type {
  AssessRunResult,
  AssessmentError,
  AssessmentKind,
  HistoryListResult,
  ModuleItemResult,
  ModuleListResult,
  ResultGetResult,
} from '../shared/assess-types';
import {
  isAssetHostAuthorized,
  resolveComputerName,
} from '../winrm/service';
import { endAssess, tryStartAssess } from './lock';
import { parseAssessJson, runRemoteScript } from './run';
import {
  deleteCustomModule,
  getHistoryById,
  getModuleById,
  getResult,
  insertHistory,
  listHistory,
  listModules,
  replaceBaselineFindings,
  saveCustomModule,
  upsertResult,
} from './repository';

function configPath(): string {
  return path.join(app.getPath('userData'), 'authorized-networks.json');
}

function requireAdmin(): { ok: false; error: AssessmentError } | null {
  try {
    requireRole('administrator');
    return null;
  } catch (error) {
    if (error instanceof Error && error.message === 'Forbidden') {
      return { ok: false, error: 'forbidden' };
    }
    return { ok: false, error: 'unauthorized' };
  }
}

function parseKind(value: unknown): AssessmentKind | null {
  if (value === 'assess' || value === 'remediate' || value === 'reverse') {
    return value;
  }
  return null;
}

const PARAM_VALUE = /^[A-Za-z0-9 ._+\-{}]{1,128}$/;

function parseParams(value: unknown): Record<string, string> | null {
  if (value === undefined || value === null) {
    return {};
  }
  if (!value || typeof value !== 'object') {
    return null;
  }
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!['action', 'uninstallKey', 'packageName', 'wingetId'].includes(key)) {
      return null;
    }
    if (typeof raw !== 'string' || !PARAM_VALUE.test(raw)) {
      return null;
    }
    out[key] = raw;
  }
  return out;
}

function timeoutFor(slug: string | null, kind: AssessmentKind): number {
  if (slug === 'installed_software' && kind === 'remediate') {
    return 300_000;
  }
  if (slug === 'security_updates' && kind === 'remediate') {
    return 600_000;
  }
  if (slug === 'security_baseline') {
    return 90_000;
  }
  if (kind === 'assess') {
    return 60_000;
  }
  return 120_000;
}

export function registerAssessIpc(): void {
  ipcMain.handle(
    ipcChannels.assessModuleList,
    async (): Promise<ModuleListResult> => {
      const denied = requireAdmin();
      if (denied) {
        return denied;
      }
      try {
        const modules = await listModules();
        return { ok: true, modules };
      } catch {
        return { ok: false, error: 'database_unavailable' };
      }
    },
  );

  ipcMain.handle(
    ipcChannels.assessModuleSave,
    async (_event, payload: unknown): Promise<ModuleItemResult> => {
      const denied = requireAdmin();
      if (denied) {
        return denied;
      }
      if (!payload || typeof payload !== 'object') {
        return { ok: false, error: 'invalid_input' };
      }
      const record = payload as Record<string, unknown>;
      const name = typeof record.name === 'string' ? record.name.trim() : '';
      const assessScript =
        typeof record.assessScript === 'string' ? record.assessScript : '';
      if (name.length < 1 || name.length > 128 || assessScript.length < 1) {
        return { ok: false, error: 'invalid_input' };
      }
      const id =
        typeof record.id === 'string' && record.id.length === 36
          ? record.id
          : undefined;
      try {
        const module = await saveCustomModule({
          id,
          name,
          description:
            typeof record.description === 'string'
              ? record.description.slice(0, 500)
              : null,
          assessScript: assessScript.slice(0, 200_000),
          remediationScript:
            typeof record.remediationScript === 'string'
              ? record.remediationScript.slice(0, 200_000)
              : null,
          reverseScript:
            typeof record.reverseScript === 'string'
              ? record.reverseScript.slice(0, 200_000)
              : null,
        });
        await writeAudit('assess_module_save', name);
        return { ok: true, module };
      } catch {
        return { ok: false, error: 'database_unavailable' };
      }
    },
  );

  ipcMain.handle(
    ipcChannels.assessModuleDelete,
    async (_event, payload: unknown): Promise<ModuleItemResult> => {
      const denied = requireAdmin();
      if (denied) {
        return denied;
      }
      const id = parseAssetId(payload);
      if (!id) {
        return { ok: false, error: 'invalid_input' };
      }
      try {
        const ok = await deleteCustomModule(id);
        if (!ok) {
          return { ok: false, error: 'not_found' };
        }
        await writeAudit('assess_module_delete', id);
        return {
          ok: true,
          module: {
            id,
            slug: null,
            name: '',
            description: null,
            assessScript: '',
            remediationScript: null,
            reverseScript: null,
            createdAt: '',
            updatedAt: '',
          },
        };
      } catch {
        return { ok: false, error: 'database_unavailable' };
      }
    },
  );

  ipcMain.handle(
    ipcChannels.assessHistory,
    async (_event, payload: unknown): Promise<HistoryListResult> => {
      const denied = requireAdmin();
      if (denied) {
        return { ok: false, error: denied.error };
      }
      const assetId = parseAssetId(payload);
      if (!assetId) {
        return { ok: false, error: 'invalid_input' };
      }
      try {
        const rows = await listHistory(assetId);
        return { ok: true, rows };
      } catch {
        return { ok: false, error: 'database_unavailable' };
      }
    },
  );

  ipcMain.handle(
    ipcChannels.assessResult,
    async (_event, payload: unknown): Promise<ResultGetResult> => {
      const denied = requireAdmin();
      if (denied) {
        return { ok: false, error: denied.error };
      }
      if (!payload || typeof payload !== 'object') {
        return { ok: false, error: 'invalid_input' };
      }
      const assetId = parseAssetId(payload);
      const moduleId = (payload as { moduleId?: unknown }).moduleId;
      if (!assetId || typeof moduleId !== 'string' || moduleId.length !== 36) {
        return { ok: false, error: 'invalid_input' };
      }
      try {
        const result = await getResult(assetId, moduleId);
        return { ok: true, result: result ?? null };
      } catch {
        return { ok: false, error: 'database_unavailable' };
      }
    },
  );

  ipcMain.handle(
    ipcChannels.assessRun,
    async (_event, payload: unknown): Promise<AssessRunResult> => {
      return executeRun(payload, null);
    },
  );

  ipcMain.handle(
    ipcChannels.assessReverse,
    async (_event, payload: unknown): Promise<AssessRunResult> => {
      const denied = requireAdmin();
      if (denied) {
        return denied;
      }
      const historyId = parseAssetId({
        id: payload && typeof payload === 'object'
          ? (payload as { historyId?: unknown }).historyId
          : undefined,
      });
      if (!historyId) {
        return { ok: false, error: 'invalid_input' };
      }
      const history = await getHistoryById(historyId);
      if (!history || history.kind !== 'remediate') {
        return { ok: false, error: 'not_found' };
      }
      let reverseParams: Record<string, string> = {};
      if (history.paramsJson) {
        try {
          reverseParams = JSON.parse(history.paramsJson) as Record<string, string>;
        } catch {
          reverseParams = {};
        }
      }
      return executeRun(
        {
          id: history.assetId,
          moduleId: history.moduleId,
          kind: 'reverse',
          params: reverseParams,
        },
        historyId,
      );
    },
  );
}

async function executeRun(
  payload: unknown,
  _fromHistory: string | null,
): Promise<AssessRunResult> {
  const denied = requireAdmin();
  if (denied) {
    return denied;
  }
  if (process.platform !== 'win32') {
    return { ok: false, error: 'unavailable' };
  }
  if (!payload || typeof payload !== 'object') {
    return { ok: false, error: 'invalid_input' };
  }
  const assetId = parseAssetId(payload);
  const moduleId = (payload as { moduleId?: unknown }).moduleId;
  const kind = parseKind((payload as { kind?: unknown }).kind) ?? 'assess';
  const params = parseParams((payload as { params?: unknown }).params);
  if (
    !assetId ||
    typeof moduleId !== 'string' ||
    moduleId.length !== 36 ||
    params === null
  ) {
    return { ok: false, error: 'invalid_input' };
  }

  const module = await getModuleById(moduleId);
  if (!module) {
    return { ok: false, error: 'not_found' };
  }
  const script =
    kind === 'assess'
      ? module.assessScript
      : kind === 'remediate'
        ? module.remediationScript
        : module.reverseScript;
  if (!script) {
    return { ok: false, error: 'invalid_input' };
  }

  const asset = await getAssetById(assetId);
  if (!asset) {
    return { ok: false, error: 'not_found' };
  }
  if (asset.winrmManageable !== true) {
    return { ok: false, error: 'not_manageable' };
  }
  const computer = resolveComputerName(asset);
  if (!computer) {
    return { ok: false, error: 'invalid_input' };
  }
  let ranges: string[];
  try {
    ranges = await loadAuthorizedRanges(configPath());
  } catch {
    return { ok: false, error: 'invalid_input' };
  }
  if (!isAssetHostAuthorized(asset, ranges)) {
    return { ok: false, error: 'not_authorized_range' };
  }

  if (!tryStartAssess()) {
    return { ok: false, error: 'in_progress' };
  }

  try {
    const paramsJson =
      Object.keys(params).length > 0 ? JSON.stringify(params) : null;
    const remote = await runRemoteScript(
      computer,
      script,
      paramsJson,
      timeoutFor(module.slug, kind),
    );
    const parsed = parseAssessJson(remote.stdout || remote.stderr);
    const payloadJson = parsed.raw.slice(0, 200_000);
    if (kind === 'assess') {
      await upsertResult(
        assetId,
        moduleId,
        parsed.positive,
        parsed.summary,
        payloadJson,
      );
    }
    if (kind === 'assess' && module.slug === 'security_baseline') {
      const findings = extractFindings(parsed.data);
      await replaceBaselineFindings(assetId, findings);
    }
    let historyId = '';
    if (module.slug === 'security_baseline') {
      historyId = await insertHistory({
        assetId,
        moduleId,
        kind,
        paramsJson,
        positive: parsed.positive,
        summary: parsed.summary,
        payloadJson,
      });
    }
    const action =
      kind === 'assess'
        ? 'assessment_run'
        : kind === 'remediate'
          ? 'assessment_remediate'
          : 'assessment_reverse';
    await writeAudit(
      action,
      `${computer}${asset.ipAddress ? ` (${asset.ipAddress})` : ''} · ${module.name} · ${kind} · ${parsed.positive ? 'PASS' : 'FAIL'} · ${parsed.summary}${params.action ? ` · ${params.action}` : ''}`,
    );
    return {
      ok: true,
      positive: parsed.positive,
      summary: parsed.summary,
      payloadJson,
      historyId,
    };
  } catch {
    return { ok: false, error: 'database_unavailable' };
  } finally {
    endAssess();
  }
}

function extractFindings(
  data: unknown,
): Array<{ id: string; status: string; detail: string }> {
  if (!data || typeof data !== 'object') {
    return [];
  }
  const findings = (data as { findings?: unknown }).findings;
  if (!Array.isArray(findings)) {
    return [];
  }
  const out: Array<{ id: string; status: string; detail: string }> = [];
  for (const item of findings) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const id = (item as { id?: unknown }).id;
    const status = (item as { status?: unknown }).status;
    const detail = (item as { detail?: unknown }).detail;
    if (typeof id !== 'string' || typeof status !== 'string') {
      continue;
    }
    out.push({
      id,
      status,
      detail: typeof detail === 'string' ? detail : '',
    });
  }
  return out;
}
