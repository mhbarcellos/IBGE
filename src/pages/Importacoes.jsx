import { useEffect, useState } from 'react';
import EmptyState from '../components/EmptyState.jsx';
import Loading from '../components/Loading.jsx';
import { listExams } from '../services/examService.js';
import {
  approveDiscoveredFile,
  archiveDiscoveredFile,
  createImportSource,
  getDiscoveredFiles,
  getExamFiles,
  getExamFileTextPreview,
  getExamFileTexts,
  getImportSources,
  restoreDiscoveredFile,
  seedInitialSources,
} from '../services/importService.js';

const emptySource = { name: '', url: '', source_type: '', notes: '' };
const emptyFilters = { type: '', status: '', suggested: '', minConfidence: '', search: '', showArchived: 'no', relevanceCategory: '' };

export default function Importacoes() {
  const [sources, setSources] = useState([]);
  const [discoveredFiles, setDiscoveredFiles] = useState([]);
  const [files, setFiles] = useState([]);
  const [texts, setTexts] = useState([]);
  const [exams, setExams] = useState([]);
  const [selectedExams, setSelectedExams] = useState({});
  const [filters, setFilters] = useState(emptyFilters);
  const [preview, setPreview] = useState(null);
  const [sourceForm, setSourceForm] = useState(emptySource);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  async function loadData() {
    setLoading(true);
    const [sourcesResult, discoveredResult, filesResult, textsResult, examsResult] = await Promise.all([
      getImportSources(),
      getDiscoveredFiles({ includeArchived: true }),
      getExamFiles(),
      getExamFileTexts(),
      listExams(),
    ]);
    setSources(sourcesResult.data ?? []);
    setDiscoveredFiles(discoveredResult.data ?? []);
    setFiles(filesResult.data ?? []);
    setTexts(textsResult.data ?? []);
    setExams(examsResult.data ?? []);
    setError(
      sourcesResult.error?.message ||
        discoveredResult.error?.message ||
        filesResult.error?.message ||
        textsResult.error?.message ||
        examsResult.error?.message ||
        '',
    );
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  function updateSource(name, value) {
    setSourceForm((current) => ({ ...current, [name]: value }));
  }

  function updateFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value }));
  }

  const filteredDiscoveredFiles = discoveredFiles.filter((file) => {
    const confidence = Number(file.inference_confidence || 0);
    const searchText = [
      file.title,
      file.normalized_title,
      file.file_type,
      file.inferred_notice_number,
      file.guessed_board,
      file.guessed_role,
      file.inferred_exam_title,
      file.inference_notes,
      file.url,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (filters.type && file.file_type !== filters.type) return false;
    if (filters.status && file.status !== filters.status) return false;
    if (filters.showArchived !== 'yes' && (file.archived_at || file.is_exam_relevant === false)) return false;
    if (filters.relevanceCategory && file.relevance_category !== filters.relevanceCategory) return false;
    if (filters.suggested === 'yes' && !(file.inferred_exam_id || file.inferredExam)) return false;
    if (filters.suggested === 'no' && (file.inferred_exam_id || file.inferredExam)) return false;
    if (filters.minConfidence && confidence < Number(filters.minConfidence) / 100) return false;
    if (filters.search && !searchText.includes(filters.search.toLowerCase())) return false;
    return true;
  });

  async function handleSeedSources() {
    setWorking(true);
    setStatus('');
    setError('');
    const result = await seedInitialSources();
    setWorking(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    setStatus(`${result.inserted} fonte(s) adicionada(s), ${result.existing} ja existiam.`);
    await loadData();
  }

  async function handleCreateSource(event) {
    event.preventDefault();
    setWorking(true);
    setStatus('');
    setError('');

    const result = await createImportSource(sourceForm);
    setWorking(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    setStatus(result.alreadyExists ? 'Essa fonte ja estava cadastrada.' : 'Fonte cadastrada.');
    setSourceForm(emptySource);
    await loadData();
  }

  async function handleApproveDiscovered(fileId) {
    setWorking(true);
    setStatus('');
    setError('');

    const result = await approveDiscoveredFile(fileId, selectedExams[fileId] || '');
    setWorking(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    setStatus('Arquivo descoberto aprovado como arquivo de prova.');
    await loadData();
  }

  function handleUseSuggestedExam(file) {
    if (!file.inferred_exam_id) return;
    setSelectedExams((current) => ({ ...current, [file.id]: file.inferred_exam_id }));
  }

  async function handlePreviewText(textId) {
    setStatus('');
    setError('');

    const result = await getExamFileTextPreview(textId);
    if (result.error) {
      setError(result.error.message);
      return;
    }

    setPreview({ id: textId, text: result.data });
  }

  async function handleArchive(fileId) {
    setWorking(true);
    setStatus('');
    setError('');
    const result = await archiveDiscoveredFile(fileId);
    setWorking(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    setStatus('Arquivo arquivado.');
    await loadData();
  }

  async function handleRestore(fileId) {
    setWorking(true);
    setStatus('');
    setError('');
    const result = await restoreDiscoveredFile(fileId);
    setWorking(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    setStatus('Arquivo restaurado.');
    await loadData();
  }

  if (loading) return <Loading />;

  return (
    <section className="content-stack">
      <header className="page-header">
        <div>
          <span className="eyebrow">Curadoria</span>
          <h1>Importações</h1>
        </div>
        <button disabled={working} type="button" onClick={handleSeedSources}>
          {working ? 'Populando...' : 'Popular fontes iniciais'}
        </button>
      </header>

      {status ? <div className="success">{status}</div> : null}
      {error ? <div className="error">{error}</div> : null}

      <form className="panel-form" onSubmit={handleCreateSource}>
        <h2>Adicionar fonte manualmente</h2>
        <div className="form-grid">
          <label>Nome<input required value={sourceForm.name} onChange={(event) => updateSource('name', event.target.value)} /></label>
          <label>URL<input required type="url" value={sourceForm.url} onChange={(event) => updateSource('url', event.target.value)} /></label>
          <label>Tipo<input value={sourceForm.source_type} onChange={(event) => updateSource('source_type', event.target.value)} /></label>
        </div>
        <label>Observacoes<textarea value={sourceForm.notes} onChange={(event) => updateSource('notes', event.target.value)} /></label>
        <button disabled={working} type="submit">Salvar fonte</button>
      </form>

      <article className="table-card">
        <h2>Fontes</h2>
        {!sources.length ? <EmptyState title="Nenhuma fonte cadastrada." description="Use o botao para popular as fontes iniciais ou adicione uma fonte manualmente." /> : null}
        {sources.length ? (
          <div className="responsive-table">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Tipo</th>
                  <th>Status</th>
                  <th>Observacoes</th>
                  <th>Link</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((source) => (
                  <tr key={source.id}>
                    <td>{source.name}</td>
                    <td>{source.source_type || '-'}</td>
                    <td><span className="pill">{source.status || 'pending'}</span></td>
                    <td>{source.notes || '-'}</td>
                    <td><a href={source.url} target="_blank" rel="noreferrer">Abrir</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </article>

      <article className="table-card">
        <h2>Arquivos descobertos</h2>
        <form className="filters" onSubmit={(event) => event.preventDefault()}>
          <input placeholder="Busca por texto" value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} />
          <select value={filters.type} onChange={(event) => updateFilter('type', event.target.value)}>
            <option value="">Todos os tipos</option>
            {['comunicado', 'edital', 'gabarito', 'prova', 'resultado', 'convocacao', 'outro'].map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
            <option value="">Todos os status</option>
            {['discovered', 'approved', 'pending', 'error'].map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          <select value={filters.suggested} onChange={(event) => updateFilter('suggested', event.target.value)}>
            <option value="">Prova sugerida: todas</option>
            <option value="yes">Com prova sugerida</option>
            <option value="no">Sem prova sugerida</option>
          </select>
          <select value={filters.showArchived} onChange={(event) => updateFilter('showArchived', event.target.value)}>
            <option value="no">Mostrar arquivados: não</option>
            <option value="yes">Mostrar arquivados: sim</option>
          </select>
          <select value={filters.relevanceCategory} onChange={(event) => updateFilter('relevanceCategory', event.target.value)}>
            <option value="">Todas as categorias</option>
            {['prova', 'gabarito', 'prova_e_gabarito', 'irrelevante', 'desconhecido'].map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          <input min="0" max="100" placeholder="Confiança mínima %" type="number" value={filters.minConfidence} onChange={(event) => updateFilter('minConfidence', event.target.value)} />
          <button className="secondary-button" type="button" onClick={() => setFilters(emptyFilters)}>Limpar filtros</button>
        </form>
        {!discoveredFiles.length ? <p className="muted">Nenhum arquivo descoberto ainda.</p> : null}
        {discoveredFiles.length && !filteredDiscoveredFiles.length ? <p className="muted">Nenhum arquivo corresponde aos filtros.</p> : null}
        {filteredDiscoveredFiles.length ? (
          <div className="responsive-table">
            <table>
              <thead>
                <tr>
                  <th>Titulo</th>
                  <th>Tipo</th>
                  <th>Edital</th>
                  <th>Fonte</th>
                  <th>Status</th>
                  <th>Ano</th>
                  <th>Banca</th>
                  <th>Cargo</th>
                  <th>Prova sugerida</th>
                  <th>Confiança</th>
                  <th>Relevância</th>
                  <th>Notas</th>
                  <th>Motivo</th>
                  <th>Prova vinculada</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {filteredDiscoveredFiles.map((file) => (
                  <tr key={file.id}>
                    <td>
                      <strong>{file.normalized_title || file.title || 'Arquivo descoberto'}</strong>
                      {file.normalized_title && file.title && file.normalized_title !== file.title ? <small className="subtle-line">{file.title}</small> : null}
                    </td>
                    <td>{file.file_type || '-'}</td>
                    <td>{file.inferred_notice_number || '-'}</td>
                    <td>{file.import_sources?.name || '-'}</td>
                    <td><span className="pill">{file.status || 'discovered'}</span></td>
                    <td>{file.guessed_year || '-'}</td>
                    <td>{file.guessed_board || '-'}</td>
                    <td>{file.guessed_role || '-'}</td>
                    <td>{file.inferredExam?.title || file.inferred_exam_title || '-'}</td>
                    <td>{Math.round(Number(file.inference_confidence || 0) * 100)}%</td>
                    <td>
                      <span className="pill">{file.archived_at ? 'Arquivado' : file.is_exam_relevant ? 'Relevante para estudo' : file.relevance_category || 'desconhecido'}</span>
                    </td>
                    <td>{file.inference_notes || '-'}</td>
                    <td>{file.relevance_reason || '-'}</td>
                    <td>
                      <select
                        aria-label="Associar prova"
                        value={selectedExams[file.id] || file.exam_id || file.inferred_exam_id || ''}
                        onChange={(event) => setSelectedExams((current) => ({ ...current, [file.id]: event.target.value }))}
                      >
                        <option value="">Sem prova</option>
                        {file.exam && !exams.some((exam) => exam.id === file.exam_id) ? (
                          <option value={file.exam_id}>{file.exam.title}</option>
                        ) : null}
                        {file.inferred_exam_id && !exams.some((exam) => exam.id === file.inferred_exam_id) ? (
                          <option value={file.inferred_exam_id}>{file.inferredExam?.title || file.inferred_exam_title || 'Prova sugerida'}</option>
                        ) : null}
                        {exams.map((exam) => (
                          <option key={exam.id} value={exam.id}>{exam.title}</option>
                        ))}
                      </select>
                    </td>
                    <td className="action-cell">
                      <a href={file.url} target="_blank" rel="noreferrer">Abrir</a>
                      {file.archived_at ? (
                        <button className="secondary-button" disabled={working} type="button" onClick={() => handleRestore(file.id)}>
                          Restaurar
                        </button>
                      ) : (
                        <button className="secondary-button" disabled={working} type="button" onClick={() => handleArchive(file.id)}>
                          Arquivar
                        </button>
                      )}
                      {file.is_exam_relevant && !file.archived_at ? (
                        <>
                          <button className="secondary-button" disabled={!file.inferred_exam_id} type="button" onClick={() => handleUseSuggestedExam(file)}>
                            Usar prova sugerida
                          </button>
                          <button disabled={working || file.status === 'approved'} type="button" onClick={() => handleApproveDiscovered(file.id)}>
                            Aprovar como arquivo de prova
                          </button>
                        </>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </article>

      <article className="table-card">
        <h2>Arquivos de prova</h2>
        {!files.length ? <p className="muted">Nenhum arquivo cadastrado ainda.</p> : null}
        {files.length ? (
          <div className="responsive-table">
            <table>
              <thead>
                <tr>
                  <th>Titulo</th>
                  <th>Tipo</th>
                  <th>Fonte</th>
                  <th>Status</th>
                  <th>Caminho local</th>
                  <th>Link</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr key={file.id}>
                    <td>{file.title || file.exams?.title || 'Arquivo'}</td>
                    <td>{file.file_type || '-'}</td>
                    <td>{file.source_name || '-'}</td>
                    <td><span className="pill">{file.status || 'pending'}</span></td>
                    <td>{file.local_path || '-'}</td>
                    <td><a href={file.url} target="_blank" rel="noreferrer">Abrir</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </article>

      <article className="table-card">
        <h2>Textos extraidos</h2>
        {!texts.length ? <p className="muted">Nenhum texto extraido ainda.</p> : null}
        {texts.length ? (
          <div className="responsive-table">
            <table>
              <thead>
                <tr>
                  <th>Arquivo</th>
                  <th>Status</th>
                  <th>Paginas</th>
                  <th>Extraido em</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {texts.map((text) => (
                  <tr key={text.id}>
                    <td>{text.exam_file_id}</td>
                    <td><span className="pill">{text.extraction_status || 'pending'}</span></td>
                    <td>{text.page_count || '-'}</td>
                    <td>{text.extracted_at ? new Date(text.extracted_at).toLocaleString('pt-BR') : '-'}</td>
                    <td>
                      <button className="secondary-button" type="button" onClick={() => handlePreviewText(text.id)}>
                        Visualizar trecho
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {preview ? (
          <div className="preview-box">
            <div className="page-header">
              <h3>Trecho extraido</h3>
              <button className="secondary-button" type="button" onClick={() => setPreview(null)}>Fechar</button>
            </div>
            <pre>{preview.text || 'Sem conteudo para exibir.'}</pre>
          </div>
        ) : null}
      </article>
    </section>
  );
}
