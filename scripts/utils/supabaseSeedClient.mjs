import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

function loadEnvFile() {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return {};

  const env = {};
  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, '');
    env[key] = value;
  }

  return env;
}

function getEnvValue(fileEnv, key) {
  return process.env[key] || fileEnv[key] || '';
}

export async function createSupabaseSeedClient() {
  const fileEnv = loadEnvFile();
  const required = {
    VITE_SUPABASE_URL: getEnvValue(fileEnv, 'VITE_SUPABASE_URL'),
    VITE_SUPABASE_ANON_KEY: getEnvValue(fileEnv, 'VITE_SUPABASE_ANON_KEY'),
    SEED_USER_EMAIL: getEnvValue(fileEnv, 'SEED_USER_EMAIL'),
    SEED_USER_PASSWORD: getEnvValue(fileEnv, 'SEED_USER_PASSWORD'),
  };

  const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length) {
    throw new Error(`Variaveis ausentes no .env: ${missing.join(', ')}.`);
  }

  const supabase = createClient(required.VITE_SUPABASE_URL, required.VITE_SUPABASE_ANON_KEY);
  const { error } = await supabase.auth.signInWithPassword({
    email: required.SEED_USER_EMAIL,
    password: required.SEED_USER_PASSWORD,
  });

  if (error) {
    throw new Error('Falha ao autenticar usuário de seed. Verifique SEED_USER_EMAIL e SEED_USER_PASSWORD no .env.');
  }

  return supabase;
}

export function isMissingSchemaError(error) {
  return (
    error?.code === 'PGRST205' ||
    error?.code === '42703' ||
    error?.message?.includes('Could not find the table') ||
    (error?.message?.includes('column') && error?.message?.includes('does not exist'))
  );
}

export function logPhase2Required(error) {
  console.log(`Schema ainda nao esta pronto para este seed: ${error.message}`);
  console.log('Execute supabase/phase2_import_tables.sql no SQL Editor do Supabase e rode o comando novamente.');
}
