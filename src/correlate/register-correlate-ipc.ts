import { ipcMain } from 'electron';
import { mapLatestAssessments } from '../assess/repository';
import { listAssets } from '../assets/repository';
import { requireRole, requireSession } from '../auth/session';
import { listAllCves } from '../cve/repository';
import { ipcChannels } from '../shared/ipc-channels';
import type {
  CorrelationListResult,
  CorrelationRunResult,
} from '../shared/correlation-types';
import { mapLatestWindowsAssessments } from '../windows/repository';
import { correlateAssets, type FactBundle } from './engine';
import {
  getLatestCorrelationRun,
  saveCorrelationRun,
} from './repository';
import { upsertFindingsFromMatches } from '../findings/repository';
import { writeAudit } from '../audit/repository';

export function registerCorrelateIpc(): void {
  ipcMain.handle(
    ipcChannels.correlateLatest,
    async (): Promise<CorrelationListResult> => {
      try {
        requireSession();
      } catch {
        return { ok: false, error: 'unauthorized' };
      }

      try {
        const run = await getLatestCorrelationRun();
        return { ok: true, run };
      } catch {
        return { ok: false, error: 'database_unavailable' };
      }
    },
  );

  ipcMain.handle(
    ipcChannels.correlateRun,
    async (): Promise<CorrelationRunResult> => {
      try {
        requireRole('administrator');
      } catch (error) {
        if (error instanceof Error && error.message === 'Forbidden') {
          return { ok: false, error: 'forbidden' };
        }

        return { ok: false, error: 'unauthorized' };
      }

      try {
        const [cves, assets, tlsMap, windowsMap] = await Promise.all([
          listAllCves(),
          listAssets(false),
          mapLatestAssessments(),
          mapLatestWindowsAssessments(),
        ]);

        const bundles: FactBundle[] = assets.map((asset) => {
          const assessment = tlsMap.get(asset.id);
          return {
            assetId: asset.id,
            hostname: asset.hostname,
            ipAddress: asset.ipAddress,
            services: asset.services,
            tls: assessment?.tls ?? null,
            smb: assessment?.smb ?? null,
            windows: windowsMap.get(asset.id)?.facts ?? null,
          };
        });

        const matches = correlateAssets(cves, bundles);
        const run = await saveCorrelationRun(matches);
        await upsertFindingsFromMatches(matches);
        await writeAudit(
          'correlate_run',
          `${matches.length} match(es)`,
        );
        return { ok: true, run };
      } catch {
        return { ok: false, error: 'database_unavailable' };
      }
    },
  );
}
