import { execFileSync } from 'child_process';
import path from 'path';

export function runPythonAction<T = unknown>(action: string, payload: unknown = {}): T {
  const scriptPath = path.join(process.cwd(), 'app.py');
  const input = JSON.stringify({ action, payload });

  const stdout = execFileSync('python3', [scriptPath, '--cli'], {
    cwd: process.cwd(),
    input,
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024,
  });

  return JSON.parse(stdout) as T;
}
