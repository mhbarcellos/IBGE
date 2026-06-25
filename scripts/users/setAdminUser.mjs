import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createSupabaseSeedClient } from '../utils/supabaseSeedClient.mjs';

function loadEnvFile() {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return {};
  const env = {};
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;
    env[trimmed.slice(0, separator).trim()] = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

function cleanEmail(value = '') {
  return value.replace(/^mailto:/i, '').replace(/^\[|\]$/g, '').trim();
}

const fileEnv = loadEnvFile();
const adminEmail = cleanEmail(process.env.ADMIN_USER_EMAIL || fileEnv.ADMIN_USER_EMAIL || '');

if (!adminEmail) {
  throw new Error('Defina ADMIN_USER_EMAIL no .env.');
}

function printManualSql(email) {
  console.log('Nao foi possivel promover via API com RLS atual.');
  console.log('Rode este SQL uma vez no SQL Editor do Supabase:');
  console.log('');
  console.log('update public.profiles');
  console.log("set role = 'admin'");
  console.log(`where email = '${email.replace(/'/g, "''")}';`);
  console.log('');
}

const supabase = await createSupabaseSeedClient();

const { data: profile, error: selectError } = await supabase
  .from('profiles')
  .select('id, email, role')
  .eq('email', adminEmail)
  .maybeSingle();

if (selectError) {
  console.log(`Erro ao buscar profile: ${selectError.message}`);
  printManualSql(adminEmail);
  process.exit(0);
}

if (!profile) {
  console.log(`Profile nao encontrado para ${adminEmail}. Crie/login com esse usuario primeiro para acionar o trigger.`);
  printManualSql(adminEmail);
  process.exit(0);
}

const { error: updateError } = await supabase
  .from('profiles')
  .update({ role: 'admin' })
  .eq('id', profile.id);

if (updateError) {
  console.log(`Erro ao promover usuario: ${updateError.message}`);
  printManualSql(adminEmail);
  process.exit(0);
}

console.log(`${adminEmail} agora e admin.`);
