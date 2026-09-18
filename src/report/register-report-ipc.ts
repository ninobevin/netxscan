import { BrowserWindow, app, dialog, ipcMain } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { requireAppSession } from '../auth/session';
import { getCompanyProfile } from '../company/repository';
import { getCompanyLogoBytes } from '../company/logo';
import { listAssessmentBatches } from '../adhics/repository';
import { errorMessage } from '../ipc/error-message';
import { ipcChannels } from '../shared/ipc-channels';
import type { AssetListColumn, ReportKind, ReportQuery } from '../shared/report-types';
import { buildReportPdf } from './build-pdf';
import { buildReportPreview } from './queries';

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

function parseQuery(payload: unknown): ReportQuery {
  const body = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  const kindRaw = asString(body.kind);
  const kind: ReportKind =
    kindRaw === 'assets' || kindRaw === 'findings' || kindRaw === 'compliance'
      ? kindRaw
      : 'findings';
  const columns = Array.isArray(body.columns)
    ? (body.columns.filter((item) => typeof item === 'string') as AssetListColumn[])
    : undefined;
  const outcome = asString(body.outcome) === 'pass' ? 'pass' : 'fail';
  const statusRaw = asString(body.status);
  const status =
    statusRaw === 'open' || statusRaw === 'acknowledged' || statusRaw === 'closed' || statusRaw === 'all'
      ? statusRaw
      : 'all';
  return {
    kind,
    locationId: asNumber(body.locationId) ?? null,
    categoryId: asNumber(body.categoryId) ?? null,
    columns,
    batchId: asNumber(body.batchId) ?? null,
    outcome,
    status,
  };
}

async function savePdf(query: ReportQuery) {
  const company = getCompanyProfile();
  const preview = buildReportPreview(query);
  const logo = getCompanyLogoBytes();
  const bytes = await buildReportPdf(preview, {
    name: company.name,
    address: company.address,
    logo,
  });
  const parent = BrowserWindow.getFocusedWindow();
  const options = {
    title: 'Save report',
    defaultPath: path.join(app.getPath('documents'), `${preview.title.replace(/[^\w]+/g, '-').toLowerCase()}.pdf`),
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  };
  const chosen = parent
    ? await dialog.showSaveDialog(parent, options)
    : await dialog.showSaveDialog(options);
  if (chosen.canceled || !chosen.filePath) {
    return { ok: true as const, cancelled: true as const };
  }
  fs.writeFileSync(chosen.filePath, Buffer.from(bytes));
  return { ok: true as const, path: chosen.filePath };
}

export function registerReportIpc(): void {
  ipcMain.handle(ipcChannels.reportBatches, () => {
    try {
      requireAppSession();
      return { ok: true, batches: listAssessmentBatches() };
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle(ipcChannels.reportPreview, (_event, payload: unknown) => {
    try {
      requireAppSession();
      return { ok: true, preview: buildReportPreview(parseQuery(payload)) };
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle(ipcChannels.reportSavePdf, async (_event, payload: unknown) => {
    try {
      requireAppSession();
      return await savePdf(parseQuery(payload));
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    }
  });
}
