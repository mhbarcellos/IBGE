import { initialStudyMaterials } from '../src/data/initialStudyMaterials.js';
import { createSupabaseSeedClient, isMissingSchemaError, logPhase2Required } from './utils/supabaseSeedClient.mjs';

const supabase = await createSupabaseSeedClient();

let inserted = 0;
let existing = 0;
let skipped = false;

for (const material of initialStudyMaterials) {
  const current = await supabase
    .from('study_materials')
    .select('id')
    .eq('subject', material.subject)
    .eq('topic', material.topic)
    .eq('title', material.title)
    .maybeSingle();

  if (current.error) {
    if (isMissingSchemaError(current.error)) {
      logPhase2Required(current.error);
      skipped = true;
      break;
    }

    console.error(`Erro ao verificar material ${material.title}: ${current.error.message}`);
    process.exitCode = 1;
    break;
  }

  if (current.data) {
    existing += 1;
    continue;
  }

  const { error } = await supabase.from('study_materials').insert(material);
  if (error) {
    if (isMissingSchemaError(error)) {
      logPhase2Required(error);
      skipped = true;
      break;
    }

    console.error(`Erro ao inserir material ${material.title}: ${error.message}`);
    process.exitCode = 1;
    break;
  }

  inserted += 1;
}

console.log(`Materiais inseridos: ${inserted}`);
console.log(`Materiais ja existentes: ${existing}`);
if (skipped) console.log('Seed de materiais ignorado ate a migracao da Fase 2 ser aplicada.');
