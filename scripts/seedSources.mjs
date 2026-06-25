import { ibgeSources } from '../src/data/ibgeSources.js';
import { createSupabaseSeedClient, isMissingSchemaError, logPhase2Required } from './utils/supabaseSeedClient.mjs';

const supabase = await createSupabaseSeedClient();

let inserted = 0;
let existing = 0;
let skipped = false;

for (const source of ibgeSources) {
  const current = await supabase.from('import_sources').select('id').eq('url', source.url).maybeSingle();
  if (current.error) {
    if (isMissingSchemaError(current.error)) {
      logPhase2Required(current.error);
      skipped = true;
      break;
    }

    console.error(`Erro ao verificar fonte ${source.url}: ${current.error.message}`);
    process.exitCode = 1;
    break;
  }

  if (current.data) {
    existing += 1;
    continue;
  }

  const { error } = await supabase.from('import_sources').insert(source);
  if (error) {
    if (isMissingSchemaError(error)) {
      logPhase2Required(error);
      skipped = true;
      break;
    }

    console.error(`Erro ao inserir fonte ${source.url}: ${error.message}`);
    process.exitCode = 1;
    break;
  }

  inserted += 1;
}

console.log(`Fontes inseridas: ${inserted}`);
console.log(`Fontes ja existentes: ${existing}`);
if (skipped) console.log('Seed de fontes ignorado ate a migracao da Fase 2 ser aplicada.');
