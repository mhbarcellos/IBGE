import { isSupabaseConfigured, supabase } from '../lib/supabaseClient.js';
import { isDemoMode } from './demoMode.js';

export const monitoredSources = [
  { name: 'PCI Concursos IBGE', type: 'Indice', canDownloadFiles: false },
  { name: 'FGV IBGE', type: 'Banca oficial', canDownloadFiles: true },
  { name: 'IBFC IBGE', type: 'Banca oficial', canDownloadFiles: true },
  { name: 'Cebraspe IBGE', type: 'Banca oficial', canDownloadFiles: true },
  { name: 'IBGE Trabalhe Conosco', type: 'Indice oficial', canDownloadFiles: true },
];

function countBy(items, keyGetter) {
  return items.reduce((acc, item) => {
    const key = keyGetter(item) || 'sem valor';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

export async function getAutoImportDashboard() {
  if (!isSupabaseConfigured || isDemoMode()) {
    return {
      data: {
        reports: [],
        filesByExtension: { pdf: 2, xlsx: 1 },
        processable: 3,
        unsupported: 0,
        totals: {
          exams: 1,
          questions: 2,
          pending: 0,
          files: 3,
        },
      },
      error: null,
    };
  }

  const [reportsResult, examsResult, questionsResult, pendingResult, filesResult] = await Promise.all([
    supabase
      .from('import_run_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10),
    supabase.from('exams').select('*', { count: 'exact', head: true }),
    supabase.from('questions').select('*', { count: 'exact', head: true }),
    supabase.from('questions').select('*', { count: 'exact', head: true }).eq('needs_review', true),
    supabase.from('exam_files').select('file_extension, is_processable, processing_status'),
  ]);

  const error = reportsResult.error || examsResult.error || questionsResult.error || pendingResult.error || filesResult.error;
  const files = filesResult.data ?? [];
  return {
    data: {
      reports: reportsResult.data ?? [],
      filesByExtension: countBy(files, (file) => file.file_extension),
      processable: files.filter((file) => file.is_processable).length,
      unsupported: files.filter((file) => ['unsupported', 'unsupported_zip'].includes(file.processing_status)).length,
      totals: {
        exams: examsResult.count ?? 0,
        questions: questionsResult.count ?? 0,
        pending: pendingResult.count ?? 0,
        files: files.length,
      },
    },
    error,
  };
}
