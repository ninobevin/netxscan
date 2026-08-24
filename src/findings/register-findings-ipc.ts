import { ipcMain } from 'electron';
import { requireRole, requireSession } from '../auth/session';
import { ipcChannels } from '../shared/ipc-channels';
import type {
  FindingItemResult,
  FindingListResult,
  FindingSyncResult,
} from '../shared/finding-types';
import {
  listFindings,
  matchesFromLatestRun,
  updateFinding,
  upsertFindingsFromMatches,
} from './repository';
import {
  parseFindingFilter,
  parseFindingId,
  parseFindingNotes,
  parseFindingStatus,
} from './validate';
import { writeAudit } from '../audit/repository';

export function registerFindingsIpc(): void {
  ipcMain.handle(
    ipcChannels.findingsList,
    async (_event, payload: unknown): Promise<FindingListResult> => {
      try {
        requireSession();
      } catch {
        return { ok: false, error: 'unauthorized' };
      }

      const status = parseFindingFilter(
        payload && typeof payload === 'object'
          ? (payload as { status?: unknown }).status
          : payload,
      );

      try {
        const findings = await listFindings(status);
        return { ok: true, findings };
      } catch {
        return { ok: false, error: 'database_unavailable' };
      }
    },
  );

  ipcMain.handle(
    ipcChannels.findingsSync,
    async (): Promise<FindingSyncResult> => {
      try {
        requireRole('administrator');
      } catch (error) {
        if (error instanceof Error && error.message === 'Forbidden') {
          return { ok: false, error: 'forbidden' };
        }

        return { ok: false, error: 'unauthorized' };
      }

      try {
        const matches = await matchesFromLatestRun();
        const { created, updated } = await upsertFindingsFromMatches(matches);
        const findings = await listFindings('all');
        await writeAudit(
          'findings_sync',
          `created ${created}, updated ${updated}`,
        );
        return { ok: true, created, updated, findings };
      } catch {
        return { ok: false, error: 'database_unavailable' };
      }
    },
  );

  ipcMain.handle(
    ipcChannels.findingsUpdate,
    async (_event, payload: unknown): Promise<FindingItemResult> => {
      try {
        requireSession();
      } catch {
        return { ok: false, error: 'unauthorized' };
      }

      const record =
        payload && typeof payload === 'object'
          ? (payload as Record<string, unknown>)
          : null;
      const id = parseFindingId(record?.id);
      const status = parseFindingStatus(record?.status);
      const notes = parseFindingNotes(record?.notes);

      if (!id || !status || notes === null) {
        return { ok: false, error: 'invalid_input' };
      }

      try {
        const finding = await updateFinding(id, status, notes);
        if (!finding) {
          return { ok: false, error: 'not_found' };
        }

        await writeAudit(
          'findings_update',
          `${finding.cveId} on ${finding.hostname} → ${status}`,
        );
        return { ok: true, finding };
      } catch {
        return { ok: false, error: 'database_unavailable' };
      }
    },
  );
}
