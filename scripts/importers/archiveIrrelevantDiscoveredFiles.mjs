import { createSupabaseSeedClient } from '../utils/supabaseSeedClient.mjs';

const apply = process.argv.includes('--apply');

console.log('Iniciando arquivamento de arquivos irrelevantes...');
console.log(`Modo: ${apply ? 'aplicar alterações' : 'dry-run'}`);
console.log('Autenticando usuário de seed...');
const supabase = await createSupabaseSeedClient();
console.log('Usuário autenticado.');

const { data: files, error } = await supabase.from('import_discovered_files').select('*');
if (error) throw error;

const candidates = (files ?? []).filter((file) => {
  if (file.status === 'approved') return false;
  if (file.archived_at) return false;
  return file.is_exam_relevant === false || ['irrelevante', 'desconhecido'].includes(file.relevance_category);
});

let archived = 0;

if (apply && candidates.length) {
  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from('import_discovered_files')
    .update({ archived_at: now, status: 'archived' })
    .in(
      'id',
      candidates.map((file) => file.id),
    );

  if (updateError) throw updateError;
  archived = candidates.length;
}

console.log(`Total analisado: ${files?.length ?? 0}`);
console.log(`Candidatos a arquivar: ${candidates.length}`);
console.log(`Arquivados: ${archived}`);
console.log(`Mantidos: ${(files?.length ?? 0) - candidates.length}`);
if (!apply) console.log('Dry-run concluído. Use npm run import:archive-irrelevant -- --apply para arquivar.');
console.log('Finalizado.');
