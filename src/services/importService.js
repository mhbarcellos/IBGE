import { isSupabaseConfigured, supabase } from '../lib/supabaseClient.js';
import { ibgeSources } from '../data/ibgeSources.js';
import { isDemoMode } from './demoMode.js';

const localSourcesKey = 'ibge_demo_import_sources';
const localFilesKey = 'ibge_demo_exam_files';
const localDiscoveredKey = 'ibge_demo_import_discovered_files';
const localTextsKey = 'ibge_demo_exam_file_texts';

const mockDiscoveredFiles = [
  {
    id: 'demo-discovered-1',
    source_id: 'demo-source-1',
    title: 'COMUNICADO',
    normalized_title: 'Comunicado Edital 05 2025 SCQ',
    url: 'https://example.com/comunicado-edital-05-2025-scq.pdf',
    file_type: 'comunicado',
    inferred_notice_number: '05/2025',
    inferred_exam_title: 'IBGE 2025 - Supervisor de Coleta e Qualidade',
    inferred_exam_id: 'demo-exam-scq',
    inference_confidence: 0.9,
    inference_notes: "Tipo inferido por conter 'comunicado'. Edital 05/2025 detectado. Prova sugerida por ano, banca e cargo Supervisor de Coleta e Qualidade.",
    is_exam_relevant: false,
    relevance_category: 'irrelevante',
    relevance_reason: 'Arquivado por conter termo administrativo: comunicado.',
    archived_at: new Date().toISOString(),
    guessed_year: 2025,
    guessed_board: 'FGV',
    guessed_role: 'Supervisor de Coleta e Qualidade',
    status: 'archived',
    notes: 'Exemplo visual para validar a inferencia.',
    import_sources: { name: 'FGV IBGE 2025 - SCQ' },
    created_at: new Date().toISOString(),
  },
  {
    id: 'demo-discovered-2',
    source_id: 'demo-source-1',
    title: 'Prova objetiva APM',
    normalized_title: 'Prova objetiva APM',
    url: 'https://example.com/prova-objetiva-apm-2025.pdf',
    file_type: 'prova',
    inferred_notice_number: '04/2025',
    inferred_exam_title: 'IBGE 2025 - Agente de Pesquisas e Mapeamento',
    inferred_exam_id: 'demo-exam-apm',
    inference_confidence: 0.9,
    inference_notes: "Tipo inferido por conter 'prova'. Edital 04/2025 detectado. Prova sugerida por ano, banca e cargo Agente de Pesquisas e Mapeamento.",
    is_exam_relevant: true,
    relevance_category: 'prova',
    relevance_reason: 'Contem termo forte de prova ou caderno de questoes.',
    archived_at: null,
    guessed_year: 2025,
    guessed_board: 'FGV',
    guessed_role: 'Agente de Pesquisas e Mapeamento',
    status: 'discovered',
    notes: 'Exemplo visual para validar a inferencia.',
    import_sources: { name: 'FGV IBGE 2025 - APM' },
    created_at: new Date().toISOString(),
  },
  {
    id: 'demo-discovered-3',
    source_id: 'demo-source-1',
    title: 'Gabarito preliminar APM',
    normalized_title: 'Gabarito preliminar APM',
    url: 'https://example.com/gabarito-preliminar-apm-2025.pdf',
    file_type: 'gabarito',
    inferred_notice_number: '04/2025',
    inferred_exam_title: 'IBGE 2025 - Agente de Pesquisas e Mapeamento',
    inferred_exam_id: 'demo-exam-apm',
    inference_confidence: 0.9,
    inference_notes: "Tipo inferido por conter 'gabarito'. Edital 04/2025 detectado. Prova sugerida por ano, banca e cargo Agente de Pesquisas e Mapeamento.",
    is_exam_relevant: true,
    relevance_category: 'gabarito',
    relevance_reason: 'Contem termo forte de gabarito.',
    archived_at: null,
    guessed_year: 2025,
    guessed_board: 'FGV',
    guessed_role: 'Agente de Pesquisas e Mapeamento',
    status: 'discovered',
    notes: 'Exemplo visual para validar a inferencia.',
    import_sources: { name: 'FGV IBGE 2025 - APM' },
    created_at: new Date().toISOString(),
  },
  {
    id: 'demo-discovered-4',
    source_id: 'demo-source-1',
    title: 'Edital 04 2025 APM',
    normalized_title: 'Edital 04 2025 APM',
    url: 'https://example.com/edital-04-2025-apm.pdf',
    file_type: 'edital',
    inferred_notice_number: '04/2025',
    inferred_exam_title: 'IBGE 2025 - Agente de Pesquisas e Mapeamento',
    inferred_exam_id: 'demo-exam-apm',
    inference_confidence: 0.9,
    inference_notes: "Tipo inferido por conter 'edital'. Edital 04/2025 detectado. Prova sugerida por ano, banca e cargo Agente de Pesquisas e Mapeamento.",
    is_exam_relevant: false,
    relevance_category: 'irrelevante',
    relevance_reason: 'Arquivado por conter termo administrativo: edital.',
    archived_at: new Date().toISOString(),
    guessed_year: 2025,
    guessed_board: 'FGV',
    guessed_role: 'Agente de Pesquisas e Mapeamento',
    status: 'archived',
    notes: 'Exemplo visual para validar a inferencia.',
    import_sources: { name: 'FGV IBGE 2025 - APM' },
    created_at: new Date().toISOString(),
  },
];

const mockExamFileTexts = [
  {
    id: 'demo-text-1',
    exam_file_id: 'demo-file-1',
    text_content:
      'Este e um trecho demonstrativo de texto extraido de PDF. Na fase seguinte, este conteudo sera analisado para identificar enunciados, alternativas, gabaritos e assuntos antes da revisao humana.',
    page_count: 12,
    extraction_status: 'extracted',
    extraction_error: null,
    local_text_path: 'data/imported/texts/demo-file-1.txt',
    extracted_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  },
];

function shouldUseLocalImportData() {
  return !isSupabaseConfigured || isDemoMode();
}

function readLocal(key) {
  if (typeof window === 'undefined') return [];
  const stored = window.localStorage.getItem(key);
  if (!stored) return [];

  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

function readLocalWithFallback(key, fallback) {
  const stored = readLocal(key);
  return stored.length ? stored : fallback;
}

function writeLocal(key, data) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(key, JSON.stringify(data));
  }
}

function makeLocalRecord(payload) {
  return {
    ...payload,
    id: `demo-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    status: payload.status || 'pending',
    created_at: new Date().toISOString(),
  };
}

function attachExamReferences(files, exams) {
  const examMap = new Map((exams || []).map((exam) => [exam.id, exam]));
  return (files || []).map((file) => ({
    ...file,
    exam: file.exam_id ? examMap.get(file.exam_id) ?? null : null,
    inferredExam: file.inferred_exam_id ? examMap.get(file.inferred_exam_id) ?? null : null,
  }));
}

export async function getImportSources() {
  if (shouldUseLocalImportData()) {
    const stored = readLocal(localSourcesKey);
    return { data: stored, error: null, usingMock: true };
  }

  return supabase.from('import_sources').select('*').order('created_at', { ascending: false });
}

export async function createImportSource(payload) {
  if (shouldUseLocalImportData()) {
    const sources = readLocal(localSourcesKey);
    const existing = sources.find((source) => source.url === payload.url);
    if (existing) return { data: existing, error: null, alreadyExists: true };

    const record = makeLocalRecord(payload);
    writeLocal(localSourcesKey, [record, ...sources]);
    return { data: record, error: null, alreadyExists: false };
  }

  const existing = await supabase.from('import_sources').select('id').eq('url', payload.url).maybeSingle();
  if (existing.error) return { data: null, error: existing.error };
  if (existing.data) return { data: existing.data, error: null, alreadyExists: true };

  const { data, error } = await supabase.from('import_sources').insert(payload).select().single();
  return { data, error, alreadyExists: false };
}

export async function seedInitialSources() {
  let inserted = 0;
  let existing = 0;

  for (const source of ibgeSources) {
    const result = await createImportSource(source);
    if (result.error) return { inserted, existing, error: result.error };
    if (result.alreadyExists) existing += 1;
    else inserted += 1;
  }

  return { inserted, existing, error: null };
}

export async function getExamFiles() {
  if (shouldUseLocalImportData()) {
    const fallback = [
      {
        id: 'demo-file-1',
        title: 'Arquivo demonstrativo aprovado',
        file_type: 'prova',
        url: 'https://example.com/ibge-prova-demonstrativa.pdf',
        source_name: 'Fonte demonstrativa',
        status: 'downloaded',
        local_path: 'data/imported/pdfs/demo-file-1.pdf',
        created_at: new Date().toISOString(),
      },
    ];
    return { data: readLocalWithFallback(localFilesKey, fallback), error: null, usingMock: true };
  }

  return supabase
    .from('exam_files')
    .select('*, exams(title, year, board, role)')
    .order('created_at', { ascending: false });
}

export async function createExamFile(payload) {
  if (shouldUseLocalImportData()) {
    const files = readLocal(localFilesKey);
    const record = makeLocalRecord(payload);
    writeLocal(localFilesKey, [record, ...files]);
    return { data: record, error: null };
  }

  return supabase.from('exam_files').insert(payload).select().single();
}

export async function updateExamFileStatus(id, status) {
  if (shouldUseLocalImportData()) {
    const files = readLocal(localFilesKey);
    const updated = files.map((file) => (file.id === id ? { ...file, status } : file));
    writeLocal(localFilesKey, updated);
    return { data: updated.find((file) => file.id === id) ?? null, error: null };
  }

  return supabase.from('exam_files').update({ status }).eq('id', id).select().single();
}

function filterDiscoveredFiles(files, options = {}) {
  const includeArchived = Boolean(options.includeArchived);
  const category = options.relevanceCategory || '';
  const search = (options.search || '').toLowerCase();

  return (files || []).filter((file) => {
    if (!includeArchived && (file.archived_at || file.is_exam_relevant === false)) return false;
    if (category && file.relevance_category !== category) return false;
    if (search) {
      const text = [
        file.title,
        file.normalized_title,
        file.url,
        file.file_type,
        file.relevance_category,
        file.relevance_reason,
        file.inferred_exam_title,
        file.import_sources?.name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return text.includes(search);
    }
    return true;
  });
}

export async function getDiscoveredFiles(options = {}) {
  if (shouldUseLocalImportData()) {
    return { data: filterDiscoveredFiles(readLocalWithFallback(localDiscoveredKey, mockDiscoveredFiles), options), error: null, usingMock: true };
  }

  let query = supabase.from('import_discovered_files').select('*, import_sources(name)').order('created_at', { ascending: false });

  if (!options.includeArchived) {
    query = query.eq('is_exam_relevant', true).is('archived_at', null);
  }

  if (options.relevanceCategory) {
    query = query.eq('relevance_category', options.relevanceCategory);
  }

  if (options.search) {
    const search = `%${options.search}%`;
    query = query.or(`title.ilike.${search},normalized_title.ilike.${search},url.ilike.${search},relevance_reason.ilike.${search},inferred_exam_title.ilike.${search}`);
  }

  const filesResult = await query;

  if (filesResult.error) {
    return { data: null, error: filesResult.error };
  }

  const examsResult = await supabase.from('exams').select('id, title, year, board, role');
  if (examsResult.error) {
    return { data: null, error: examsResult.error };
  }

  return {
    data: attachExamReferences(filesResult.data, examsResult.data),
    error: null,
  };
}

export async function archiveDiscoveredFile(id) {
  const archivedAt = new Date().toISOString();
  if (shouldUseLocalImportData()) {
    const discovered = readLocalWithFallback(localDiscoveredKey, mockDiscoveredFiles);
    const updated = discovered.map((file) => (file.id === id ? { ...file, archived_at: archivedAt, status: 'archived', is_exam_relevant: false } : file));
    writeLocal(localDiscoveredKey, updated);
    return { data: updated.find((file) => file.id === id) ?? null, error: null };
  }

  return supabase.from('import_discovered_files').update({ archived_at: archivedAt, status: 'archived' }).eq('id', id).select().single();
}

export async function restoreDiscoveredFile(id) {
  if (shouldUseLocalImportData()) {
    const discovered = readLocalWithFallback(localDiscoveredKey, mockDiscoveredFiles);
    const updated = discovered.map((file) => (file.id === id ? { ...file, archived_at: null, status: 'discovered' } : file));
    writeLocal(localDiscoveredKey, updated);
    return { data: updated.find((file) => file.id === id) ?? null, error: null };
  }

  return supabase.from('import_discovered_files').update({ archived_at: null, status: 'discovered' }).eq('id', id).select().single();
}

export async function approveDiscoveredFile(discoveredFileId, examId) {
  if (shouldUseLocalImportData()) {
    const discovered = readLocalWithFallback(localDiscoveredKey, mockDiscoveredFiles);
    const target = discovered.find((file) => file.id === discoveredFileId);

    if (!target) {
      return { data: null, error: new Error('Arquivo descoberto nao encontrado.') };
    }

    const examFile = makeLocalRecord({
      exam_id: examId || target.inferred_exam_id || null,
      file_type: target.file_type || 'outro',
      title: target.normalized_title || target.title,
      url: target.url,
      source_name: target.import_sources?.name || target.guessed_board || 'Fonte demonstrativa',
      status: 'approved',
    });

    const files = readLocal(localFilesKey);
    writeLocal(localFilesKey, [examFile, ...files]);
    writeLocal(
      localDiscoveredKey,
      discovered.map((file) => (file.id === discoveredFileId ? { ...file, exam_id: examId || target.inferred_exam_id || null, status: 'approved' } : file)),
    );

    return { data: examFile, error: null };
  }

  const { data: discoveredFile, error: loadError } = await supabase
    .from('import_discovered_files')
    .select('*, import_sources(name)')
    .eq('id', discoveredFileId)
    .single();

  if (loadError) return { data: null, error: loadError };

  const payload = {
    exam_id: examId || discoveredFile.inferred_exam_id || null,
    file_type: discoveredFile.file_type || 'outro',
    title: discoveredFile.normalized_title || discoveredFile.title,
    url: discoveredFile.url,
    source_name: discoveredFile.import_sources?.name || discoveredFile.guessed_board,
    status: 'approved',
  };

  const { data: examFile, error: insertError } = await supabase.from('exam_files').insert(payload).select().single();
  if (insertError) return { data: null, error: insertError };

  const { error: updateError } = await supabase
    .from('import_discovered_files')
    .update({ status: 'approved', exam_id: examId || discoveredFile.inferred_exam_id || null })
    .eq('id', discoveredFileId);

  if (updateError) return { data: null, error: updateError };
  return { data: examFile, error: null };
}

export async function getExamFileTexts() {
  if (shouldUseLocalImportData()) {
    return { data: readLocalWithFallback(localTextsKey, mockExamFileTexts), error: null, usingMock: true };
  }

  return supabase
    .from('exam_file_texts')
    .select('id, exam_file_id, page_count, extraction_status, extraction_error, local_text_path, extracted_at, created_at')
    .order('created_at', { ascending: false });
}

export async function getExamFileTextPreview(examFileTextId) {
  if (shouldUseLocalImportData()) {
    const text = readLocalWithFallback(localTextsKey, mockExamFileTexts).find((item) => item.id === examFileTextId);
    return { data: text?.text_content?.slice(0, 3000) ?? '', error: text ? null : new Error('Texto nao encontrado.') };
  }

  const { data, error } = await supabase.from('exam_file_texts').select('text_content').eq('id', examFileTextId).single();
  return { data: data?.text_content?.slice(0, 3000) ?? '', error };
}
