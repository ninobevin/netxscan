import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseDatabaseConfig, type DatabaseConfig } from './config';

const EXAMPLE_CONFIG = {
  engine: 'sqlite',
};

export async function loadDatabaseConfig(
  configPath: string,
): Promise<DatabaseConfig> {
  const userDataDir = path.dirname(configPath);
  await mkdir(userDataDir, { recursive: true });

  try {
    await access(configPath);
  } catch {
    await writeFile(
      configPath,
      `${JSON.stringify(EXAMPLE_CONFIG, null, 2)}\n`,
      'utf8',
    );
  }

  const raw = await readFile(configPath, 'utf8');
  return parseDatabaseConfig(JSON.parse(raw) as unknown, userDataDir);
}
