import { initialExams } from '../src/data/initialExams.js';
import { createSupabaseSeedClient } from './utils/supabaseSeedClient.mjs';

const supabase = await createSupabaseSeedClient();

let inserted = 0;
let existing = 0;

for (const exam of initialExams) {
  let query = supabase
    .from('exams')
    .select('id')
    .eq('title', exam.title)
    .eq('board', exam.board)
    .eq('role', exam.role);

  query = exam.year === null ? query.is('year', null) : query.eq('year', exam.year);

  const current = await query.maybeSingle();
  if (current.error) {
    console.error(`Erro ao verificar prova ${exam.title}: ${current.error.message}`);
    process.exitCode = 1;
    break;
  }

  if (current.data) {
    existing += 1;
    continue;
  }

  const { error } = await supabase.from('exams').insert(exam);
  if (error) {
    console.error(`Erro ao inserir prova ${exam.title}: ${error.message}`);
    process.exitCode = 1;
    break;
  }

  inserted += 1;
}

console.log(`Provas inseridas: ${inserted}`);
console.log(`Provas ja existentes: ${existing}`);
