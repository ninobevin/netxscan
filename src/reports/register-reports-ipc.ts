import { dialog, ipcMain } from 'electron';
import { writeFile } from 'node:fs/promises';
import { writeAudit } from '../audit/repository';
import { requireSession } from '../auth/session';
import { ipcChannels } from '../shared/ipc-channels';
import type {
  ReportExportResult,
  ReportPreviewResult,
} from '../shared/report-types';
import { buildReportHtml, parseReportKind } from './build';

export function registerReportsIpc(): void {
  ipcMain.handle(
    ipcChannels.reportsPreview,
    async (_event, payload: unknown): Promise<ReportPreviewResult> => {
      try {
        requireSession();
      } catch {
        return { ok: false, error: 'unauthorized' };
      }

      const kind = parseReportKind(
        payload && typeof payload === 'object'
          ? (payload as { kind?: unknown }).kind
          : payload,
      );
      if (!kind) {
        return { ok: false, error: 'invalid_input' };
      }

      try {
        const report = await buildReportHtml(kind);
        return { ok: true, kind, title: report.title, html: report.html };
      } catch {
        return { ok: false, error: 'database_unavailable' };
      }
    },
  );

  ipcMain.handle(
    ipcChannels.reportsExport,
    async (_event, payload: unknown): Promise<ReportExportResult> => {
      try {
        requireSession();
      } catch {
        return { ok: false, error: 'unauthorized' };
      }

      const kind = parseReportKind(
        payload && typeof payload === 'object'
          ? (payload as { kind?: unknown }).kind
          : payload,
      );
      if (!kind) {
        return { ok: false, error: 'invalid_input' };
      }

      try {
        const report = await buildReportHtml(kind);
        const day = new Date().toISOString().slice(0, 10);
        const picked = await dialog.showSaveDialog({
          title: 'Save report',
          defaultPath: `netxscan-${kind}-${day}.html`,
          filters: [{ name: 'HTML', extensions: ['html'] }],
        });

        if (picked.canceled || !picked.filePath) {
          return { ok: false, error: 'cancelled' };
        }

        await writeFile(picked.filePath, report.html, 'utf8');
        await writeAudit('report_export', `${kind} HTML`);
        return { ok: true, path: picked.filePath };
      } catch {
        return { ok: false, error: 'export_failed' };
      }
    },
  );
}
