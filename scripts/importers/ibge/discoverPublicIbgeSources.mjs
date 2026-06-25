import { createSupabaseSeedClient } from '../../utils/supabaseSeedClient.mjs';
import { saveImportReport, printReportSummary } from '../shared/importReport.mjs';
import { discoverExamsAndFiles as discoverFgv } from './sources/fgvImporter.mjs';
import { discoverExamsAndFiles as discoverIbfc } from './sources/ibfcImporter.mjs';
import { discoverExamsAndFiles as discoverCebraspe } from './sources/cebraspeImporter.mjs';
import { discoverExamsAndFiles as discoverIbge } from './sources/ibgeImporter.mjs';

const importers = [discoverFgv, discoverIbfc, discoverCebraspe, discoverIbge];

console.log('Iniciando descoberta automatica de fontes publicas IBGE...');
const supabase = await createSupabaseSeedClient();
const reports = [];
const limits = { maxLinks: 8, maxSecondLevel: 3, maxPdfs: 5, maxExamPages: 5 };

for (const importer of importers) {
  try {
    const report = await importer({ supabase, limits, logger: console });
    reports.push(report);
    await saveImportReport(supabase, report, 'discover', report.errors.length ? 'finished_with_errors' : 'finished');
  } catch (error) {
    const fallback = {
      sourceName: importer.name || 'Fonte IBGE',
      errors: [error.message],
      startedAt: new Date().toISOString(),
    };
    reports.push(fallback);
    await saveImportReport(supabase, fallback, 'discover', 'error');
    console.log(`Fonte falhou e foi ignorada: ${error.message}`);
  }
}

printReportSummary(reports);
console.log('Finalizado.');
