import { useEffect, useState } from 'react';
import EmptyState from '../components/EmptyState.jsx';
import Loading from '../components/Loading.jsx';
import { listExams } from '../services/examService.js';
import { approveParseCandidate, listReviewQuestions, updateReviewQuestion } from '../services/reviewService.js';

const letters = ['A', 'B', 'C', 'D', 'E'];
const initialFilters = { examId: '', year: '', board: '', discipline: '', sourceName: '', noAnswer: false };

export default function RevisaoQuestoes() {
  const [questions, setQuestions] = useState([]);
  const [exams, setExams] = useState([]);
  const [filters, setFilters] = useState(initialFilters);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function loadData(nextFilters) {
    setLoading(true);
    const [questionsResult, examsResult] = await Promise.all([listReviewQuestions(nextFilters), listExams()]);
    setQuestions(questionsResult.data ?? []);
    setExams(examsResult.data ?? []);
    setError(questionsResult.error?.message || examsResult.error?.message || '');
    setLoading(false);
  }

  useEffect(() => {
    loadData(initialFilters);
  }, []);

  function getDraft(question) {
    return drafts[question.id] || {
      discipline: question.discipline || '',
      subject: question.subject || '',
      statement: question.statement || '',
      alternatives: question.alternatives || {},
      correct_answer: question.correct_answer || '',
      explanation: question.explanation || '',
    };
  }

  function updateDraft(question, path, value) {
    const draft = getDraft(question);
    if (path.startsWith('alternatives.')) {
      const letter = path.split('.')[1];
      setDrafts((current) => ({
        ...current,
        [question.id]: { ...draft, alternatives: { ...draft.alternatives, [letter]: value } },
      }));
      return;
    }
    setDrafts((current) => ({ ...current, [question.id]: { ...draft, [path]: value } }));
  }

  async function saveReviewed(question) {
    setMessage('');
    setError('');
    const draft = getDraft(question);
    const isCandidate = question.reviewType === 'candidate';
    const action = isCandidate
      ? approveParseCandidate(question, draft)
      : updateReviewQuestion(question.id, {
          ...draft,
          correct_answer: draft.correct_answer || null,
          needs_review: false,
          import_status: 'reviewed',
        });
    const { error: updateError } = await action;

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setMessage(isCandidate ? 'Candidata aprovada para o banco de questoes.' : 'Questao marcada como revisada.');
    await loadData(filters);
  }

  return (
    <section className="content-stack">
      <header className="page-header">
        <div>
          <span className="eyebrow">Curadoria</span>
          <h1>Revisao de questoes</h1>
        </div>
      </header>

      {message ? <div className="success">{message}</div> : null}
      {error ? <div className="error">{error}</div> : null}

      <form className="filters" onSubmit={(event) => { event.preventDefault(); loadData(filters); }}>
        <select value={filters.examId} onChange={(event) => setFilters({ ...filters, examId: event.target.value })}>
          <option value="">Todas as provas</option>
          {exams.map((exam) => <option key={exam.id} value={exam.id}>{exam.title}</option>)}
        </select>
        <input placeholder="Ano" value={filters.year} onChange={(event) => setFilters({ ...filters, year: event.target.value })} />
        <input placeholder="Banca" value={filters.board} onChange={(event) => setFilters({ ...filters, board: event.target.value })} />
        <input placeholder="Disciplina" value={filters.discipline} onChange={(event) => setFilters({ ...filters, discipline: event.target.value })} />
        <input placeholder="Fonte" value={filters.sourceName} onChange={(event) => setFilters({ ...filters, sourceName: event.target.value })} />
        <label className="inline-check">
          <input checked={filters.noAnswer} type="checkbox" onChange={(event) => setFilters({ ...filters, noAnswer: event.target.checked })} />
          Somente sem gabarito
        </label>
        <button type="submit">Filtrar</button>
      </form>

      {loading ? <Loading /> : null}
      {!loading && !questions.length ? <EmptyState title="Nenhuma questao pendente." description="Questoes importadas sem gabarito ou com parser incerto aparecerao aqui." /> : null}
      {!loading ? questions.map((question) => {
        const draft = getDraft(question);
        return (
          <article className="question-card" key={question.id}>
            <div className="question-meta">
              <span>{question.exams?.title || 'Prova'}</span>
              <span>{question.exams?.year || '-'}</span>
              <span>{question.exams?.board || '-'}</span>
              <span>{question.exams?.role || '-'}</span>
              <span>Origem: {question.source_name || '-'}</span>
              {question.reviewType === 'candidate' ? <span>Candidata PDF</span> : null}
            </div>
            {question.reviewType === 'candidate' ? (
              <div className="status-row">
                <span className="pill">Questao {question.number || '-'}</span>
                <span className="pill">Confianca: {Math.round(Number(question.parse_confidence || 0) * 100)}%</span>
                <span className="pill">{question.correct_answer ? `Gabarito: ${question.correct_answer}` : 'Sem gabarito'}</span>
              </div>
            ) : null}
            <p className="muted">{question.import_notes || 'Sem observacao de importacao.'}</p>
            <div className="form-grid">
              <label>Disciplina<input value={draft.discipline} onChange={(event) => updateDraft(question, 'discipline', event.target.value)} /></label>
              <label>Assunto<input value={draft.subject} onChange={(event) => updateDraft(question, 'subject', event.target.value)} /></label>
              <label>Gabarito<input maxLength="1" value={draft.correct_answer} onChange={(event) => updateDraft(question, 'correct_answer', event.target.value.toUpperCase())} /></label>
            </div>
            <label>Enunciado<textarea value={draft.statement} onChange={(event) => updateDraft(question, 'statement', event.target.value)} /></label>
            <div className="form-grid">
              {letters.map((letter) => (
                <label key={letter}>Alternativa {letter}<input value={draft.alternatives?.[letter] || ''} onChange={(event) => updateDraft(question, `alternatives.${letter}`, event.target.value)} /></label>
              ))}
            </div>
            <label>Explicacao<textarea value={draft.explanation || ''} onChange={(event) => updateDraft(question, 'explanation', event.target.value)} /></label>
            <button type="button" onClick={() => saveReviewed(question)}>
              {question.reviewType === 'candidate' ? 'Aprovar para banco de questoes' : 'Marcar como revisada'}
            </button>
          </article>
        );
      }) : null}
    </section>
  );
}
