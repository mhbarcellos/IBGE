import { initialExams } from '../src/data/initialExams.js';
import { getMatchedRoleAlias, getRoleFocusLevel, targetRole } from '../src/lib/targetRole.js';
import { createSupabaseSeedClient } from './utils/supabaseSeedClient.mjs';

const supabase = await createSupabaseSeedClient();

let inserted = 0;
let existing = 0;

for (const exam of initialExams) {
  const roleText = `${exam.title} ${exam.role || ''} ${exam.source_url || ''} ${exam.source_page_url || ''}`;
  const payload = {
    ...exam,
    role_focus: exam.role_focus || getRoleFocusLevel(roleText),
    target_role: exam.target_role || targetRole,
    role_alias_matched: exam.role_alias_matched || getMatchedRoleAlias(roleText) || null,
  };
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

  const { error } = await supabase.from('exams').insert(payload);
  if (error) {
    console.error(`Erro ao inserir prova ${exam.title}: ${error.message}`);
    process.exitCode = 1;
    break;
  }

  inserted += 1;
}

console.log(`Provas inseridas: ${inserted}`);
console.log(`Provas ja existentes: ${existing}`);
