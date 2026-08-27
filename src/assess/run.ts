import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { RUNNER_PS1 } from './runner-script';

export type RemoteRun = {
  code: number | null;
  stdout: string;
  stderr: string;
};

export async function runRemoteScript(
  computer: string,
  script: string,
  paramsJson: string | null,
  timeoutMs: number,
): Promise<RemoteRun> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'netxscan-assess-'));
  const runnerPath = path.join(dir, 'runner.ps1');
  const scriptPath = path.join(dir, 'payload.ps1');
  const paramsPath = path.join(dir, 'params.json');
  try {
    await writeFile(runnerPath, RUNNER_PS1, 'utf8');
    await writeFile(scriptPath, script, 'utf8');
    const args = [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      runnerPath,
      '-ComputerName',
      computer,
      '-ScriptPath',
      scriptPath,
    ];
    if (paramsJson) {
      await writeFile(paramsPath, paramsJson, 'utf8');
      args.push('-ParamsPath', paramsPath);
    }

    const psPath = process.env.SystemRoot
      ? `${process.env.SystemRoot}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`
      : 'powershell.exe';
    const result = await spawnWait(psPath, args, timeoutMs);
    return result;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export function parseAssessJson(stdout: string): {
  positive: boolean;
  summary: string;
  data: unknown;
  raw: string;
} {
  const start = stdout.lastIndexOf('{');
  const end = stdout.lastIndexOf('}');
  if (start === -1 || end <= start) {
    return {
      positive: false,
      summary: stdout.trim().slice(0, 400) || 'no JSON output',
      data: {},
      raw: stdout.slice(0, 8000),
    };
  }

  const raw = stdout.slice(start, end + 1);
  try {
    const parsed = JSON.parse(raw) as {
      positive?: unknown;
      summary?: unknown;
      data?: unknown;
    };
    return {
      positive: parsed.positive === true,
      summary:
        typeof parsed.summary === 'string' && parsed.summary
          ? parsed.summary.slice(0, 500)
          : parsed.positive === true
            ? 'ok'
            : 'failed',
      data: parsed.data ?? {},
      raw: raw.slice(0, 200_000),
    };
  } catch {
    return {
      positive: false,
      summary: 'invalid JSON output',
      data: {},
      raw: raw.slice(0, 8000),
    };
  }
}

function spawnWait(
  exe: string,
  args: string[],
  timeoutMs: number,
): Promise<RemoteRun> {
  return new Promise((resolve) => {
    const child = spawn(exe, args, { shell: false, windowsHide: true });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (code: number | null) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve({ code, stdout, stderr });
    };
    const timer = setTimeout(() => {
      child.kill();
      finish(null);
    }, timeoutMs);
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', () => {
      clearTimeout(timer);
      finish(null);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      finish(code);
    });
  });
}
