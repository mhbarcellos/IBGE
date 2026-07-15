import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createSupabaseSeedClient } from '../../utils/supabaseSeedClient.mjs';
import { saveImportReport, printReportSummary, createEmptyStats } from '../shared/importReport.mjs';
import { discoverExamsAndFiles as discoverFgv } from './sources/fgvImporter.mjs';
import { discoverExamsAndFiles as discoverIbfc } from './sources/ibfcImporter.mjs';
import { discoverExamsAndFiles as discoverCebraspe } from './sources/cebraspeImporter.mjs';
import { discoverExamsAndFiles as discoverIbge } from './sources/ibgeImporter.mjs';
import { downloadApprovedPdfs, extractDownloadedTexts, parseExtractedQuestions } from './autoPdfPipeline.mjs';

const sourceNames = ['FGV IBGE', 'IBFC IBGE', 'Cebraspe IBGE', 'IBGE Trabalhe Conosco'];
const importers = [discoverFgv, discoverIbfc, discoverCebraspe, discoverIbge];
const importerSteps = importers.map((importer, index) => ({
  importer,
  sourceName: sourceNames[index] || importer.name || 'Fonte IBGE',
}));

function getPackageScripts() {
  try {
    const packageJsonPath = resolve(process.cwd(), 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    return packageJson.scripts || {};
  } catch (error) {
    console.error(`Nao foi possivel ler package.json: ${error.message}`);
    return {};
  }
}

const packageScripts = getPackageScripts();

function getNpmRunner(scriptName, extraArgs) {
  if (process.platform === 'win32') {
    const npmCliPath = resolve(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
    return {
      command: process.execPath,
      args: [npmCliPath, 'run', scriptName, ...extraArgs],
    };
  }

  return {
    command: 'npm',
    args: ['run', scriptName, ...extraArgs],
  };
}

function runNpmScript(scriptName, extraArgs = [], envOverrides = {}) {
  return new Promise((resolve) => {
    if (!packageScripts[scriptName]) {
      console.warn(`Etapa ignorada: ${scriptName} nao existe no package.json.`);
      console.log('Continuando para a proxima etapa.');
      resolve({
        scriptName,
        success: false,
        skipped: true,
        error: 'Script nao encontrado no package.json',
      });
      return;
    }

    console.log(`Executando etapa: ${scriptName}`);
    const { command, args } = getNpmRunner(scriptName, extraArgs);
    let completed = false;
    let child;

    try {
      child = spawn(command, args, {
        cwd: process.cwd(),
        stdio: 'inherit',
        shell: false,
        env: { ...process.env, ...envOverrides },
      });
    } catch (error) {
      console.error(`Erro ao executar npm run ${scriptName}:`, error.message);
      console.log('Continuando para a proxima etapa.');
      resolve({
        scriptName,
        success: false,
        error: error.message,
      });
      return;
    }

    child.on('error', (error) => {
      if (completed) return;
      completed = true;
      console.error(`Erro ao executar npm run ${scriptName}:`, error.message);
      console.log('Continuando para a proxima etapa.');
      resolve({
        scriptName,
        success: false,
        error: error.message,
      });
    });

    child.on('close', (code) => {
      if (completed) return;
      completed = true;
      if (code === 0) {
        console.log(`Etapa concluida: ${scriptName}`);
      } else {
        console.error(`Etapa falhou: ${scriptName}`);
        console.log('Continuando para a proxima etapa.');
      }

      resolve({
        scriptName,
        success: code === 0,
        code,
      });
    });
  });
}

console.log('Iniciando importacao automatica completa do IBGE...');
const supabase = await createSupabaseSeedClient();
const reports = [];
const limits = { maxLinks: 8, maxSecondLevel: 3, maxPdfs: 5, maxExamPages: 5 };

console.log('Etapa 1: PCI como indice historico (sem download de PDF protegido).');
const pciResult = await runNpmScript('pci:discover', [], { PCI_MAX_LIST_PAGES: process.env.PCI_MAX_LIST_PAGES || '1' });
const pciReport = createEmptyStats('PCI Concursos IBGE');
pciReport.startedAt = new Date().toISOString();
pciReport.errors = pciResult.success ? [] : [`pci:discover falhou${pciResult.code ? ` com codigo ${pciResult.code}` : ''}${pciResult.error ? `: ${pciResult.error}` : ''}`];
await saveImportReport(supabase, pciReport, 'index', pciResult.success ? 'finished' : 'error');
reports.push(pciReport);

console.log('Etapa 2: descoberta agregada de fontes oficiais.');
await runNpmScript('ibge:discover');

console.log('Etapa 3: importadores oficiais FGV/IBFC/Cebraspe/IBGE.');
for (const { importer, sourceName } of importerSteps) {
  try {
    console.log(`Executando etapa: ${sourceName}`);
    const report = await importer({ supabase, limits, logger: console });
    reports.push(report);
    await saveImportReport(supabase, report, 'discover', report.errors.length ? 'finished_with_errors' : 'finished');
    console.log(`Etapa concluida: ${sourceName}`);
  } catch (error) {
    const report = createEmptyStats(sourceName);
    report.errors.push(error.message);
    reports.push(report);
    await saveImportReport(supabase, report, 'discover', 'error');
    console.error(`Etapa falhou: ${sourceName}`);
    console.error(`Fonte falhou e foi ignorada: ${error.message}`);
    console.log('Continuando para a proxima etapa.');
  }
}

const pipelineReport = createEmptyStats('Pipeline Arquivos IBGE');
pipelineReport.startedAt = new Date().toISOString();

console.log('Etapa 4: download de arquivos reais e acessiveis.');
try {
  console.log('Executando etapa: download de arquivos acessiveis');
  const downloadResult = await downloadApprovedPdfs({ supabase, sourceNames, logger: console, limit: 30 });
  pipelineReport.pdfsDownloaded = downloadResult.downloaded;
  pipelineReport.pdfsBlocked = downloadResult.blocked;
  console.log('Etapa concluida: download de arquivos acessiveis');
} catch (error) {
  pipelineReport.errors.push(`download de arquivos acessiveis: ${error.message}`);
  console.error('Etapa falhou: download de arquivos acessiveis');
  console.error(error.message);
  console.log('Continuando para a proxima etapa.');
}

console.log('Etapa 5: extracao de texto.');
try {
  console.log('Executando etapa: extracao de texto');
  await extractDownloadedTexts({ supabase, sourceNames, logger: console, limit: 30 });
  console.log('Etapa concluida: extracao de texto');
} catch (error) {
  pipelineReport.errors.push(`extracao de texto: ${error.message}`);
  console.error('Etapa falhou: extracao de texto');
  console.error(error.message);
  console.log('Continuando para a proxima etapa.');
}

console.log('Etapa 6: parser de questoes e gabaritos.');
try {
  console.log('Executando etapa: parser de questoes e gabaritos');
  const parseResult = await parseExtractedQuestions({ supabase, sourceNames, logger: console, limit: 20 });
  pipelineReport.questionsCandidates = parseResult.candidatesCount;
  pipelineReport.questionsImported = parseResult.imported;
  pipelineReport.questionsNeedingReview = parseResult.review;
  console.log('Etapa concluida: parser de questoes e gabaritos');
} catch (error) {
  pipelineReport.errors.push(`parser de questoes e gabaritos: ${error.message}`);
  console.error('Etapa falhou: parser de questoes e gabaritos');
  console.error(error.message);
  console.log('Continuando para a proxima etapa.');
}

reports.push(pipelineReport);
await saveImportReport(supabase, pipelineReport, 'pipeline', pipelineReport.errors.length ? 'finished_with_errors' : 'finished');

console.log('Etapa 7: classificacao de foco ACA.');
await runNpmScript('questions:classify-role');

console.log('Etapa 8: verificacao final.');
await runNpmScript('ibge:check');

console.log('Resumo final');
printReportSummary(reports);
console.log('Importacao automatica concluida.');
