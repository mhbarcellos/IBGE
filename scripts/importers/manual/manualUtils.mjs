import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const defaultManualSourceName = 'Importação manual';

export function loadEnvFile() {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return {};

  return readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .reduce((env, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return env;
      const separator = trimmed.indexOf('=');
      if (separator === -1) return env;
      const key = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, '');
      return { ...env, [key]: value };
    }, {});
}

export function getEnvValue(fileEnv, key, fallback = '') {
  return process.env[key] || fileEnv[key] || fallback;
}

export function getManualSourceName(fileEnv = loadEnvFile()) {
  return getEnvValue(fileEnv, 'MANUAL_SOURCE_NAME', defaultManualSourceName);
}

export function getManualLimit(fileEnv, key, fallback) {
  const value = Number(getEnvValue(fileEnv, key, fallback));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function requireManualEnv(fileEnv, keys) {
  const missing = keys.filter((key) => !getEnvValue(fileEnv, key));
  if (missing.length) {
    throw new Error(`Variaveis obrigatorias ausentes no .env: ${missing.join(', ')}.`);
  }
}
