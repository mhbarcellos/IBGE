import { useEffect, useState } from 'react';
import { createExam, listExams } from '../services/examService.js';
import { createExamFile } from '../services/importService.js';
import { createQuestion } from '../services/questionService.js';

const emptyExam = { title: '', year: '', board: '', role: '', source_url: '' };
const emptyExamFile = { exam_id: '', file_type: 'prova', title: '', url: '', source_name: '', status: 'pending' };
const emptyQuestion = {
  exam_id: '',
  number: '',
  discipline: '',
  subject: '',
  subtopic: '',
  statement: '',
  alternative_a: '',
  alternative_b: '',
  alternative_c: '',
  alternative_d: '',
  alternative_e: '',
  correct_answer: 'A',
  explanation: '',
  difficulty: 'media',
};

export default function AdminQuestoes() {
  const [exam, setExam] = useState(emptyExam);
  const [examFile, setExamFile] = useState(emptyExamFile);
  const [question, setQuestion] = useState(emptyQuestion);
  const [exams, setExams] = useState([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    listExams().then(({ data }) => setExams(data));
  }, []);

  function updateExam(name, value) {
    setExam((current) => ({ ...current, [name]: value }));
  }

  function updateQuestion(name, value) {
    setQuestion((current) => ({ ...current, [name]: value }));
  }

  function updateExamFile(name, value) {
    setExamFile((current) => ({ ...current, [name]: value }));
  }

  async function handleCreateExam(event) {
    event.preventDefault();
    setStatus('');
    setError('');

    const payload = { ...exam, year: exam.year ? Number(exam.year) : null };
    const { data, error: createError } = await createExam(payload);

    if (createError) {
      setError(createError.message);
      return;
    }

    setStatus('Prova cadastrada.');
    setExam(emptyExam);
    setExams((items) => [data, ...items]);
  }

  async function handleCreateQuestion(event) {
    event.preventDefault();
    setStatus('');
    setError('');

    const payload = {
      exam_id: question.exam_id || null,
      number: question.number ? Number(question.number) : null,
      discipline: question.discipline,
      subject: question.subject,
      subtopic: question.subtopic,
      statement: question.statement,
      alternatives: {
        A: question.alternative_a,
        B: question.alternative_b,
        C: question.alternative_c,
        D: question.alternative_d,
        E: question.alternative_e,
      },
      correct_answer: question.correct_answer,
      explanation: question.explanation,
      difficulty: question.difficulty,
    };

    const { error: createError } = await createQuestion(payload);

    if (createError) {
      setError(createError.message);
      return;
    }

    setStatus('Questao cadastrada.');
    setQuestion(emptyQuestion);
  }

  async function handleCreateExamFile(event) {
    event.preventDefault();
    setStatus('');
    setError('');

    const payload = {
      exam_id: examFile.exam_id || null,
      file_type: examFile.file_type,
      title: examFile.title,
      url: examFile.url,
      source_name: examFile.source_name,
      status: examFile.status,
    };

    const { error: createError } = await createExamFile(payload);

    if (createError) {
      setError(createError.message);
      return;
    }

    setStatus('Arquivo de prova cadastrado.');
    setExamFile(emptyExamFile);
  }

  return (
    <section className="content-stack">
      <header className="page-header">
        <div>
          <span className="eyebrow">Cadastro</span>
          <h1>Admin de questoes</h1>
        </div>
      </header>

      {status ? <div className="success">{status}</div> : null}
      {error ? <div className="error">{error}</div> : null}

      <div className="two-columns align-start">
        <form className="panel-form" onSubmit={handleCreateExam}>
          <h2>Cadastrar prova</h2>
          <label>Titulo<input required value={exam.title} onChange={(event) => updateExam('title', event.target.value)} /></label>
          <label>Ano<input value={exam.year} onChange={(event) => updateExam('year', event.target.value)} type="number" /></label>
          <label>Banca<input value={exam.board} onChange={(event) => updateExam('board', event.target.value)} /></label>
          <label>Cargo<input value={exam.role} onChange={(event) => updateExam('role', event.target.value)} /></label>
          <label>Fonte<input value={exam.source_url} onChange={(event) => updateExam('source_url', event.target.value)} type="url" /></label>
          <button type="submit">Salvar prova</button>
        </form>

        <form className="panel-form" onSubmit={handleCreateQuestion}>
          <h2>Cadastrar questao</h2>
          <label>
            Prova
            <select value={question.exam_id} onChange={(event) => updateQuestion('exam_id', event.target.value)}>
              <option value="">Sem prova vinculada</option>
              {exams.map((item) => (
                <option key={item.id} value={item.id}>{item.title}</option>
              ))}
            </select>
          </label>
          <div className="form-grid">
            <label>Numero<input value={question.number} onChange={(event) => updateQuestion('number', event.target.value)} type="number" /></label>
            <label>Dificuldade<input value={question.difficulty} onChange={(event) => updateQuestion('difficulty', event.target.value)} /></label>
          </div>
          <label>Disciplina<input required value={question.discipline} onChange={(event) => updateQuestion('discipline', event.target.value)} /></label>
          <label>Assunto<input required value={question.subject} onChange={(event) => updateQuestion('subject', event.target.value)} /></label>
          <label>Subassunto<input value={question.subtopic} onChange={(event) => updateQuestion('subtopic', event.target.value)} /></label>
          <label>Enunciado<textarea required value={question.statement} onChange={(event) => updateQuestion('statement', event.target.value)} /></label>
          <div className="form-grid">
            <label>Alternativa A<input required value={question.alternative_a} onChange={(event) => updateQuestion('alternative_a', event.target.value)} /></label>
            <label>Alternativa B<input required value={question.alternative_b} onChange={(event) => updateQuestion('alternative_b', event.target.value)} /></label>
            <label>Alternativa C<input required value={question.alternative_c} onChange={(event) => updateQuestion('alternative_c', event.target.value)} /></label>
            <label>Alternativa D<input required value={question.alternative_d} onChange={(event) => updateQuestion('alternative_d', event.target.value)} /></label>
            <label>Alternativa E<input value={question.alternative_e} onChange={(event) => updateQuestion('alternative_e', event.target.value)} /></label>
            <label>
              Gabarito
              <select value={question.correct_answer} onChange={(event) => updateQuestion('correct_answer', event.target.value)}>
                {['A', 'B', 'C', 'D', 'E'].map((letter) => <option key={letter}>{letter}</option>)}
              </select>
            </label>
          </div>
          <label>Explicacao<textarea value={question.explanation} onChange={(event) => updateQuestion('explanation', event.target.value)} /></label>
          <button type="submit">Salvar questao</button>
        </form>
      </div>

      <form className="panel-form" onSubmit={handleCreateExamFile}>
        <h2>Cadastrar arquivo da prova</h2>
        <div className="form-grid">
          <label>
            Prova
            <select value={examFile.exam_id} onChange={(event) => updateExamFile('exam_id', event.target.value)}>
              <option value="">Sem prova vinculada</option>
              {exams.map((item) => (
                <option key={item.id} value={item.id}>{item.title}</option>
              ))}
            </select>
          </label>
          <label>
            Tipo do arquivo
            <select value={examFile.file_type} onChange={(event) => updateExamFile('file_type', event.target.value)}>
              {['prova', 'gabarito', 'edital', 'resultado', 'outro'].map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </label>
          <label>Titulo<input required value={examFile.title} onChange={(event) => updateExamFile('title', event.target.value)} /></label>
          <label>URL<input required type="url" value={examFile.url} onChange={(event) => updateExamFile('url', event.target.value)} /></label>
          <label>Fonte<input value={examFile.source_name} onChange={(event) => updateExamFile('source_name', event.target.value)} /></label>
          <label>
            Status
            <select value={examFile.status} onChange={(event) => updateExamFile('status', event.target.value)}>
              {['pending', 'discovered', 'approved', 'downloaded', 'error'].map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>
        <button type="submit">Salvar arquivo</button>
      </form>
    </section>
  );
}
