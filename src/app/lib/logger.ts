import fsp from 'node:fs/promises';
import path from 'node:path';

const LOG_DIR = process.env.AUTOMATION_LOG_DIR || path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, process.env.AUTOMATION_LOG_FILE || 'automation.log');

async function ensureDir() {
  try {
    await fsp.mkdir(LOG_DIR, { recursive: true });
  } catch (err) {
  }
}

export async function log(level: 'info' | 'warn' | 'error' | 'debug', event: string, meta: Record<string, any> = {}) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    event,
    ...meta,
  };

  try {
    await ensureDir();
    await fsp.appendFile(LOG_FILE, JSON.stringify(entry) + '\n', { encoding: 'utf8' });
  } catch (err) {
    console.error('[logger] failed to write log', err);
  }
  console.log(JSON.stringify(entry));
}
