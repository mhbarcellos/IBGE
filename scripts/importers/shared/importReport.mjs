export function createEmptyStats(sourceName) {
  return {
    sourceName,
    examsFound: 0,
    examsImported: 0,
    pdfsFound: 0,
    pdfsDownloaded: 0,
    pdfsBlocked: 0,
    questionsCandidates: 0,
    questionsImported: 0,
    questionsNeedingReview: 0,
    errors: [],
  };
}

export async function saveImportReport(supabase, stats, runType = 'auto', status = 'finished') {
  const payload = {
    source_name: stats.sourceName,
    run_type: runType,
    status,
    message: stats.errors?.length ? stats.errors.slice(0, 5).join(' | ') : null,
    exams_found: stats.examsFound || 0,
    exams_imported: stats.examsImported || 0,
    pdfs_found: stats.pdfsFound || 0,
    pdfs_downloaded: stats.pdfsDownloaded || 0,
    pdfs_blocked: stats.pdfsBlocked || 0,
    questions_candidates: stats.questionsCandidates || 0,
    questions_imported: stats.questionsImported || 0,
    questions_needing_review: stats.questionsNeedingReview || 0,
    started_at: stats.startedAt || new Date().toISOString(),
    finished_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('import_run_reports').insert(payload);
  if (error) {
    console.log(`Nao foi possivel salvar relatorio de ${stats.sourceName}: ${error.message}`);
  }
}

export function printReportSummary(reports) {
  const totals = reports.reduce((acc, report) => ({
    examsFound: acc.examsFound + (report.examsFound || 0),
    examsImported: acc.examsImported + (report.examsImported || 0),
    pdfsFound: acc.pdfsFound + (report.pdfsFound || 0),
    pdfsDownloaded: acc.pdfsDownloaded + (report.pdfsDownloaded || 0),
    pdfsBlocked: acc.pdfsBlocked + (report.pdfsBlocked || 0),
    questionsCandidates: acc.questionsCandidates + (report.questionsCandidates || 0),
    questionsImported: acc.questionsImported + (report.questionsImported || 0),
    questionsNeedingReview: acc.questionsNeedingReview + (report.questionsNeedingReview || 0),
  }), {
    examsFound: 0,
    examsImported: 0,
    pdfsFound: 0,
    pdfsDownloaded: 0,
    pdfsBlocked: 0,
    questionsCandidates: 0,
    questionsImported: 0,
    questionsNeedingReview: 0,
  });

  console.log('Resumo final do importador IBGE:');
  console.log(`Provas encontradas: ${totals.examsFound}`);
  console.log(`Provas importadas/atualizadas: ${totals.examsImported}`);
  console.log(`Arquivos encontrados: ${totals.pdfsFound}`);
  console.log(`Arquivos baixados: ${totals.pdfsDownloaded}`);
  console.log(`Arquivos bloqueados/ignorados: ${totals.pdfsBlocked}`);
  console.log(`Questoes candidatas: ${totals.questionsCandidates}`);
  console.log(`Questoes importadas: ${totals.questionsImported}`);
  console.log(`Questoes pendentes de revisao: ${totals.questionsNeedingReview}`);
}
