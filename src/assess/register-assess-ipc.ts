import { app, ipcMain } from 'electron';
import path from 'node:path';
import { getAssetById } from '../assets/repository';
import { parseAssetId } from '../assets/validate';
import type { AssetService } from '../shared/asset-types';
import { requireRole, requireSession } from '../auth/session';
import { isTargetAuthorized } from '../nmap/authorize';
import { loadAuthorizedRanges } from '../nmap/load-ranges';
import {
  resolveNmapPath,
  runAuthorizedServiceAssessment,
} from '../nmap/run-scan';
import { endScan, tryStartScan } from '../nmap/scan-lock';
import type { AssessmentResult } from '../shared/assessment-types';
import { ipcChannels } from '../shared/ipc-channels';
import { parseNmapXml } from '../nmap/parse-xml';
import { writeAudit } from '../audit/repository';
import { upsertFindingsFromMatches } from '../findings/repository';
import { evaluateMisconfigurations, nistQualitative } from './misconfig';
import {
  assessmentNotes,
  parseSmbFacts,
  parseTlsFacts,
} from './parse-assessment';
import { getLatestAssessment, saveAssessment } from './repository';

function configPath(): string {
  return path.join(app.getPath('userData'), 'authorized-networks.json');
}

export function registerAssessIpc(): void {
  ipcMain.handle(
    ipcChannels.assessLatest,
    async (_event, payload: unknown): Promise<AssessmentResult> => {
      try {
        requireSession();
      } catch {
        return { ok: false, error: 'unauthorized' };
      }

      const assetId = parseAssetId(payload);

      if (!assetId) {
        return { ok: false, error: 'invalid_input' };
      }

      try {
        const assessment = await getLatestAssessment(assetId);
        return assessment
          ? { ok: true, assessment }
          : { ok: false, error: 'not_found' };
      } catch {
        return { ok: false, error: 'database_unavailable' };
      }
    },
  );

  ipcMain.handle(
    ipcChannels.assessRun,
    async (_event, payload: unknown): Promise<AssessmentResult> => {
      try {
        requireRole('administrator');
      } catch (error) {
        if (error instanceof Error && error.message === 'Forbidden') {
          return { ok: false, error: 'forbidden' };
        }

        return { ok: false, error: 'unauthorized' };
      }

      const assetId = parseAssetId(payload);

      if (!assetId) {
        return { ok: false, error: 'invalid_input' };
      }

      let ipAddress: string | null = null;
      let hostname = '';
      let services: AssetService[] = [];

      try {
        const asset = await getAssetById(assetId);
        ipAddress = asset?.ipAddress ?? null;
        hostname = asset?.hostname ?? '';
        services = asset?.services ?? [];

        if (!asset) {
          return { ok: false, error: 'not_found' };
        }
      } catch {
        return { ok: false, error: 'database_unavailable' };
      }

      if (!ipAddress) {
        return { ok: false, error: 'invalid_input' };
      }

      let ranges: string[];

      try {
        ranges = await loadAuthorizedRanges(configPath());
      } catch {
        return { ok: false, error: 'invalid_input' };
      }

      if (!isTargetAuthorized(ipAddress, ranges)) {
        return { ok: false, error: 'not_authorized_range' };
      }

      const nmapPath = await resolveNmapPath();

      if (!nmapPath) {
        return { ok: false, error: 'nmap_missing' };
      }

      if (!tryStartScan()) {
        return { ok: false, error: 'scan_in_progress' };
      }

      try {
        const xml = await runAuthorizedServiceAssessment(nmapPath, ipAddress);
        const tls = parseTlsFacts(xml);
        const smb = parseSmbFacts(xml);
        const openPorts = (parseNmapXml(xml)[0]?.ports ?? []).map(
          (port) => port.port,
        );
        const issues = evaluateMisconfigurations({
          tls,
          smb,
          openPorts,
          services,
        });
        const assessment = await saveAssessment(
          assetId,
          tls,
          smb,
          assessmentNotes(),
          openPorts,
          issues,
        );
        await upsertFindingsFromMatches(
          issues.map((issue) => ({
            assetId,
            hostname,
            ipAddress,
            cveId: issue.id,
            title: issue.title,
            severity: issue.severity,
            evidence: issue.evidence,
            recommendation: issue.recommendation,
            description: `${issue.description} NIST qualitative rating: ${nistQualitative(issue.severity)}. Risk score ${issue.riskScore}.`,
          })),
          'assessment',
        );
        await writeAudit(
          'assess_services',
          `${ipAddress} · ${issues.length} issue(s)`,
        );
        return { ok: true, assessment };
      } catch (error) {
        if (error instanceof Error && error.message === 'timeout') {
          return { ok: false, error: 'timeout' };
        }

        if (
          error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === 'ENOENT'
        ) {
          return { ok: false, error: 'nmap_missing' };
        }

        return { ok: false, error: 'scan_failed' };
      } finally {
        endScan();
      }
    },
  );
}
