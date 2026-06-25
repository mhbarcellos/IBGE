import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extname } from 'node:path';

const require = createRequire(import.meta.url);

function normalizeExtension(file) {
  const fromColumn = file.file_extension || '';
  if (fromColumn) return fromColumn.toLowerCase().replace(/^\./, '');
  if (file.local_path) return extname(file.local_path).replace('.', '').toLowerCase();
  return '';
}

function assertLocalFile(path) {
  if (!path || !existsSync(path)) {
    throw new Error(`Arquivo local nao encontrado: ${path || 'sem local_path'}`);
  }
}

async function extractPdfText(path) {
  const { PDFParse } = require('pdf-parse');
  const parser = new PDFParse({ data: readFileSync(path) });
  const parsed = await parser.getText();
  return { text: parsed.text, pageCount: parsed.total ?? null };
}

async function extractDocxText(path) {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ path });
  return { text: result.value || '', pageCount: null };
}

async function extractSpreadsheetText(path) {
  const xlsx = await import('xlsx');
  const workbook = xlsx.readFile(path, { cellDates: false });
  const parts = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
    parts.push(`# ${sheetName}`);
    for (const row of rows) {
      parts.push(row.map((cell) => (cell == null ? '' : String(cell))).join('\t'));
    }
  }
  return { text: parts.join('\n'), pageCount: workbook.SheetNames.length };
}

async function extractCsvText(path) {
  return { text: readFileSync(path, 'utf8'), pageCount: null };
}

export async function extractTextFromExamFile(file, absolutePath) {
  assertLocalFile(absolutePath);
  const extension = normalizeExtension(file);

  if (extension === 'pdf') return extractPdfText(absolutePath);
  if (extension === 'docx') return extractDocxText(absolutePath);
  if (extension === 'xlsx' || extension === 'xls') return extractSpreadsheetText(absolutePath);
  if (extension === 'csv') return extractCsvText(absolutePath);
  if (extension === 'zip') {
    const error = new Error('ZIP baixado, mas extracao automatica segura ainda nao implementada.');
    error.processingStatus = 'unsupported_zip';
    throw error;
  }
  if (extension === 'doc') {
    const error = new Error('DOC antigo nao suportado para extracao automatica.');
    error.processingStatus = 'unsupported';
    throw error;
  }

  const error = new Error(`Formato nao suportado para extracao: ${extension || 'desconhecido'}`);
  error.processingStatus = 'unsupported';
  throw error;
}
