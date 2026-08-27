import { randomUUID } from 'node:crypto';
import { getDb } from '../db/client';
import type {
  AssessmentHistoryRow,
  AssessmentKind,
  AssessmentModule,
  AssessmentResultRow,
} from '../shared/assess-types';

type ModuleRow = {
  id: string;
  slug: string | null;
  name: string;
  description: string | null;
  assess_script: string;
  remediation_script: string | null;
  reverse_script: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

function asIso(value: Date | string | null): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return value ?? '';
}

function toModule(row: ModuleRow): AssessmentModule {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    assessScript: row.assess_script,
    remediationScript: row.remediation_script,
    reverseScript: row.reverse_script,
    createdAt: asIso(row.created_at),
    updatedAt: asIso(row.updated_at),
  };
}

export async function listModules(): Promise<AssessmentModule[]> {
  const db = getDb();
  const [rows] = await db.query(
    `SELECT id, slug, name, description, assess_script, remediation_script, reverse_script,
            created_at, updated_at
     FROM assessment_modules
     ORDER BY CASE WHEN slug IS NULL THEN 1 ELSE 0 END, name`,
  );
  return (rows as ModuleRow[]).map(toModule);
}

export async function getModuleById(
  id: string,
): Promise<AssessmentModule | undefined> {
  const db = getDb();
  const [rows] = await db.query(
    `SELECT id, slug, name, description, assess_script, remediation_script, reverse_script,
            created_at, updated_at
     FROM assessment_modules WHERE id = :id LIMIT 1`,
    { id },
  );
  const row = (rows as ModuleRow[])[0];
  return row ? toModule(row) : undefined;
}

export async function getModuleBySlug(
  slug: string,
): Promise<AssessmentModule | undefined> {
  const db = getDb();
  const [rows] = await db.query(
    `SELECT id, slug, name, description, assess_script, remediation_script, reverse_script,
            created_at, updated_at
     FROM assessment_modules WHERE slug = :slug LIMIT 1`,
    { slug },
  );
  const row = (rows as ModuleRow[])[0];
  return row ? toModule(row) : undefined;
}

export async function insertBuiltinIfMissing(
  slug: string,
  name: string,
  description: string,
  assessScript: string,
  remediationScript: string | null,
  reverseScript: string | null,
): Promise<void> {
  const db = getDb();
  const existing = await getModuleBySlug(slug);
  if (existing) {
    await db.query(
      `UPDATE assessment_modules
       SET name = :name,
           description = :description,
           assess_script = :assessScript,
           remediation_script = :remediationScript,
           reverse_script = :reverseScript
       WHERE slug = :slug`,
      {
        slug,
        name,
        description,
        assessScript,
        remediationScript,
        reverseScript,
      },
    );
    return;
  }

  await db.query(
    `INSERT INTO assessment_modules
      (id, slug, name, description, assess_script, remediation_script, reverse_script)
     VALUES (:id, :slug, :name, :description, :assessScript, :remediationScript, :reverseScript)`,
    {
      id: randomUUID(),
      slug,
      name,
      description,
      assessScript,
      remediationScript,
      reverseScript,
    },
  );
}

export async function saveCustomModule(input: {
  id?: string;
  name: string;
  description: string | null;
  assessScript: string;
  remediationScript: string | null;
  reverseScript: string | null;
}): Promise<AssessmentModule> {
  const db = getDb();
  if (input.id) {
    await db.query(
      `UPDATE assessment_modules
       SET name = :name, description = :description, assess_script = :assessScript,
           remediation_script = :remediationScript, reverse_script = :reverseScript
       WHERE id = :id AND slug IS NULL`,
      { ...input, id: input.id },
    );
    const updated = await getModuleById(input.id);
    if (!updated) {
      throw new Error('not_found');
    }
    return updated;
  }

  const id = randomUUID();
  await db.query(
    `INSERT INTO assessment_modules
      (id, slug, name, description, assess_script, remediation_script, reverse_script)
     VALUES (:id, NULL, :name, :description, :assessScript, :remediationScript, :reverseScript)`,
    { id, ...input },
  );
  const created = await getModuleById(id);
  if (!created) {
    throw new Error('not_found');
  }
  return created;
}

export async function deleteCustomModule(id: string): Promise<boolean> {
  const db = getDb();
  const [result] = await db.query(
    `DELETE FROM assessment_modules WHERE id = :id AND slug IS NULL`,
    { id },
  );
  return Boolean((result as { affectedRows?: number }).affectedRows);
}

export async function upsertResult(
  assetId: string,
  moduleId: string,
  positive: boolean,
  summary: string,
  payloadJson: string | null,
): Promise<void> {
  const db = getDb();
  await db.query(`DELETE FROM assessment_results WHERE asset_id = :assetId AND module_id = :moduleId`, {
    assetId,
    moduleId,
  });
  await db.query(
    `INSERT INTO assessment_results (asset_id, module_id, positive, summary, payload_json)
     VALUES (:assetId, :moduleId, :positive, :summary, :payloadJson)`,
    {
      assetId,
      moduleId,
      positive: positive ? 1 : 0,
      summary: summary.slice(0, 500),
      payloadJson,
    },
  );
}

export async function getResult(
  assetId: string,
  moduleId: string,
): Promise<AssessmentResultRow | undefined> {
  const db = getDb();
  const [rows] = await db.query(
    `SELECT asset_id, module_id, positive, summary, payload_json, ran_at
     FROM assessment_results
     WHERE asset_id = :assetId AND module_id = :moduleId LIMIT 1`,
    { assetId, moduleId },
  );
  const row = (
    rows as Array<{
      asset_id: string;
      module_id: string;
      positive: number | boolean;
      summary: string | null;
      payload_json: string | null;
      ran_at: Date | string;
    }>
  )[0];
  if (!row) {
    return undefined;
  }

  return {
    assetId: row.asset_id,
    moduleId: row.module_id,
    positive: Number(row.positive) === 1 || row.positive === true,
    summary: row.summary,
    payloadJson: row.payload_json,
    ranAt: asIso(row.ran_at),
  };
}

export async function insertHistory(input: {
  assetId: string;
  moduleId: string;
  kind: AssessmentKind;
  paramsJson: string | null;
  positive: boolean;
  summary: string;
  payloadJson: string | null;
}): Promise<string> {
  const id = randomUUID();
  const db = getDb();
  await db.query(
    `INSERT INTO assessment_history
      (id, asset_id, module_id, kind, params_json, positive, summary, payload_json)
     VALUES (:id, :assetId, :moduleId, :kind, :paramsJson, :positive, :summary, :payloadJson)`,
    {
      id,
      ...input,
      positive: input.positive ? 1 : 0,
      summary: input.summary.slice(0, 500),
    },
  );
  return id;
}

export async function listHistory(
  assetId: string,
): Promise<AssessmentHistoryRow[]> {
  const db = getDb();
  const [rows] = await db.query(
    `SELECT h.id, h.asset_id, h.module_id, m.name AS module_name, h.kind, h.params_json,
            h.positive, h.summary, h.payload_json, h.created_at
     FROM assessment_history h
     JOIN assessment_modules m ON m.id = h.module_id
     WHERE h.asset_id = :assetId AND m.slug = 'security_baseline'
     ORDER BY h.created_at DESC
     LIMIT 200`,
    { assetId },
  );
  return (
    rows as Array<{
      id: string;
      asset_id: string;
      module_id: string;
      module_name: string;
      kind: AssessmentKind;
      params_json: string | null;
      positive: number | boolean;
      summary: string | null;
      payload_json: string | null;
      created_at: Date | string;
    }>
  ).map((row) => ({
    id: row.id,
    assetId: row.asset_id,
    moduleId: row.module_id,
    moduleName: row.module_name,
    kind: row.kind,
    paramsJson: row.params_json,
    positive: Number(row.positive) === 1 || row.positive === true,
    summary: row.summary,
    payloadJson: row.payload_json,
    createdAt: asIso(row.created_at),
  }));
}

export async function getHistoryById(
  id: string,
): Promise<AssessmentHistoryRow | undefined> {
  const rows = await listHistoryById(id);
  return rows;
}

async function listHistoryById(
  id: string,
): Promise<AssessmentHistoryRow | undefined> {
  const db = getDb();
  const [rows] = await db.query(
    `SELECT h.id, h.asset_id, h.module_id, m.name AS module_name, h.kind, h.params_json,
            h.positive, h.summary, h.payload_json, h.created_at
     FROM assessment_history h
     JOIN assessment_modules m ON m.id = h.module_id
     WHERE h.id = :id LIMIT 1`,
    { id },
  );
  const row = (
    rows as Array<{
      id: string;
      asset_id: string;
      module_id: string;
      module_name: string;
      kind: AssessmentKind;
      params_json: string | null;
      positive: number | boolean;
      summary: string | null;
      payload_json: string | null;
      created_at: Date | string;
    }>
  )[0];
  if (!row) {
    return undefined;
  }

  return {
    id: row.id,
    assetId: row.asset_id,
    moduleId: row.module_id,
    moduleName: row.module_name,
    kind: row.kind,
    paramsJson: row.params_json,
    positive: Number(row.positive) === 1 || row.positive === true,
    summary: row.summary,
    payloadJson: row.payload_json,
    createdAt: asIso(row.created_at),
  };
}

export async function replaceBaselineFindings(
  assetId: string,
  findings: Array<{ id: string; status: string; detail: string }>,
): Promise<void> {
  const db = getDb();
  await db.query(`DELETE FROM baseline_findings WHERE asset_id = :assetId`, {
    assetId,
  });
  for (const finding of findings) {
    await db.query(
      `INSERT INTO baseline_findings (asset_id, check_id, status, detail)
       VALUES (:assetId, :checkId, :status, :detail)`,
      {
        assetId,
        checkId: finding.id.slice(0, 80),
        status: finding.status.slice(0, 8),
        detail: finding.detail.slice(0, 500),
      },
    );
  }
}

export async function listAllBaselineFindings(): Promise<
  Array<{ assetId: string; checkId: string; status: string; detail: string }>
> {
  const db = getDb();
  const [rows] = await db.query(
    `SELECT asset_id, check_id, status, detail FROM baseline_findings`,
  );
  return (
    rows as Array<{
      asset_id: string;
      check_id: string;
      status: string;
      detail: string | null;
    }>
  ).map((row) => ({
    assetId: row.asset_id,
    checkId: row.check_id,
    status: row.status,
    detail: row.detail ?? '',
  }));
}
