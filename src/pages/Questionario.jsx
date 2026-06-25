import { useEffect, useMemo, useState } from 'react';
import EmptyState from '../components/EmptyState.jsx';
import { useAuth } from '../context/useAuth.js';
import {
  allDisciplinesValue,
  allTopicsValue,
  getQuestionFilterOptions,
  getTrainingQuestions,
} from '../services/questionService.js';
import { saveAttempt } from '../services/performanceService.js';

const letters = ['A', 'B', 'C', 'D', 'E'];

function optionClass({ letter, selected, correctAnswer, answered }) {
  const classes = ['option-button'];
  if (selected === letter) classes.push('option-selected');
  if (answered && correctAnswer === letter) classes.push('option-correct');
  if (answered && selected === letter && selected !== correctAnswer) classes.push('option-wrong');
  if (answered) classes.push('option-disabled');
  return classes.join(' ');
}

function explanationLabel(status) {
  if (status === 'auto_generated') return 'Comentario gerado automaticamente. Pode precisar de revisao.';
  if (status === 'reviewed') return 'Comentario revisado.';
  return '';
}

export default function Questionario() {
  const { user } = useAuth();
  const [filters, setFilters] = useState({ discipline: allDisciplinesValue, topic: allTopicsValue, limit: 5, includePendingReview: false });
  const [filterOptions, setFilterOptions] = useState({ disciplines: [allDisciplinesValue], topics: [allTopicsValue], count: 0 });
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState('');
  const [answered, setAnswered] = useState(false);
  const [savingAttempt, setSavingAttempt] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const current = questions[currentIndex];
  const finished = questions.length > 0 && currentIndex >= questions.length;
  const correctCount = results.filter((item) => item.isCorrect).length;
  const hasValidAnswer = current ? letters.includes(current.correct_answer) : false;
  const selectedOptionExplanation = current?.optionExplanations?.[selected];
  const currentOptions = useMemo(() => letters.filter((letter) => current?.alternatives?.[letter]), [current]);

  useEffect(() => {
    let active = true;
    const optionFilters = {
      discipline: filters.discipline,
      topic: filters.topic,
      includePendingReview: filters.includePendingReview,
    };
    getQuestionFilterOptions(optionFilters).then(({ data }) => {
      if (active) setFilterOptions(data);
    });
    return () => {
      active = false;
    };
  }, [filters.discipline, filters.topic, filters.includePendingReview]);

  function updateFilter(name, value) {
    setFilters((currentFilters) => {
      if (name === 'discipline') {
        return { ...currentFilters, discipline: value, topic: allTopicsValue };
      }
      return { ...currentFilters, [name]: value };
    });
  }

  async function startTraining(event) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    const { data, error } = await getTrainingQuestions(filters);
    setQuestions(data);
    setCurrentIndex(0);
    setSelected('');
    setAnswered(false);
    setResults([]);
    setLoading(false);
    if (error) setMessage(error.message);
    if (!data.length) setMessage('Nenhuma questao encontrada para esta combinacao de disciplina e assunto.');
  }

  async function chooseAnswer(letter) {
    if (answered || savingAttempt || !current || !hasValidAnswer) return;
    setSavingAttempt(true);
    setSelected(letter);
    const isCorrect = letter === current.correct_answer;
    setAnswered(true);
    setResults((items) => [...items, { questionId: current.id, isCorrect }]);
    await saveAttempt({
      user_id: user?.id,
      question_id: current.id,
      selected_answer: letter,
      is_correct: isCorrect,
    });
    setSavingAttempt(false);
  }

  function nextQuestion() {
    setSelected('');
    setAnswered(false);
    setCurrentIndex((index) => index + 1);
  }

  function restart() {
    setQuestions([]);
    setCurrentIndex(0);
    setSelected('');
    setAnswered(false);
    setResults([]);
    setMessage('');
  }

  return (
    <section className="content-stack">
      <header className="page-header">
        <div>
          <span className="eyebrow">Treino</span>
          <h1>Praticar</h1>
        </div>
      </header>

      <form className="filters" onSubmit={startTraining}>
        <label>
          Disciplina
          <select value={filters.discipline} onChange={(event) => updateFilter('discipline', event.target.value)}>
            {filterOptions.disciplines.map((discipline) => (
              <option key={discipline} value={discipline}>
                {discipline === allDisciplinesValue ? 'Todas as disciplinas' : discipline}
              </option>
            ))}
          </select>
        </label>
        <label>
          Assunto
          <select value={filters.topic} onChange={(event) => updateFilter('topic', event.target.value)}>
            {filterOptions.topics.map((topic) => (
              <option key={topic} value={topic}>
                {topic === allTopicsValue ? 'Todos os assuntos' : topic}
              </option>
            ))}
          </select>
        </label>
        <label>
          Quantidade
          <input min="1" max="50" type="number" value={filters.limit} onChange={(event) => updateFilter('limit', event.target.value)} />
        </label>
        <label className="inline-check">
          <input
            checked={filters.includePendingReview}
            type="checkbox"
            onChange={(event) => updateFilter('includePendingReview', event.target.checked)}
          />
          Incluir questoes pendentes de revisao
        </label>
        <button disabled={loading || filterOptions.count === 0} type="submit">{loading ? 'Buscando...' : 'Comecar'}</button>
      </form>

      <article className={filterOptions.count ? 'notice' : 'error'}>
        {filterOptions.count
          ? `${filterOptions.count} questoes disponiveis para este filtro.`
          : 'Nenhuma questao encontrada para esta combinacao de disciplina e assunto.'}
      </article>

      {message ? <div className="error">{message}</div> : null}

      {!questions.length && !loading ? (
        <EmptyState title="Monte um treino para comecar." description="Escolha disciplina, assunto e quantidade de questoes." />
      ) : null}

      {current ? (
        <article className="question-card">
          <div className="question-meta">
            <span>Questao {currentIndex + 1} de {questions.length}</span>
            <span>{current.discipline}</span>
            <span>{current.topic}</span>
          </div>
          <h3>{current.statement}</h3>

          {current.alternativesError ? <div className="error">{current.alternativesError}</div> : null}

          <div className="option-list">
            {currentOptions.map((letter) => (
              <button
                className={optionClass({ letter, selected, correctAnswer: current.correct_answer, answered })}
                disabled={answered || !hasValidAnswer || savingAttempt}
                key={letter}
                type="button"
                onClick={() => chooseAnswer(letter)}
              >
                <strong>{letter}</strong>
                <span>{current.alternatives[letter]}</span>
              </button>
            ))}
          </div>

          {!hasValidAnswer ? (
            <div className="error">Questao sem gabarito validado.</div>
          ) : null}

          {answered ? (
            <div className={selected === current.correct_answer ? 'success' : 'error'}>
              {selected === current.correct_answer ? 'Voce acertou.' : 'Voce errou.'}
              <p><strong>Resposta correta: {current.correct_answer}</strong></p>
            </div>
          ) : null}

          {answered && selected !== current.correct_answer ? (
            <div className="answer-box">
              <strong>Por que a alternativa {selected} nao e correta:</strong>
              <p>{selectedOptionExplanation?.explanation || 'Ainda nao ha explicacao especifica para esta alternativa.'}</p>
            </div>
          ) : null}

          {answered ? (
            <div className="answer-box">
              <strong>Comentario</strong>
              {explanationLabel(current.explanation_status) ? <p className="muted">{explanationLabel(current.explanation_status)}</p> : null}
              <p>{current.explanation || 'Ainda nao ha explicacao para esta questao.'}</p>
            </div>
          ) : null}

          <div className="button-row">
            <button className="secondary-button" disabled={!answered} type="button" onClick={nextQuestion}>Proxima questao</button>
            <button className="secondary-button" type="button" onClick={restart}>Tentar outra</button>
          </div>
        </article>
      ) : null}

      {finished ? (
        <article className="result-panel">
          <h2>Resultado</h2>
          <div className="stats-grid compact">
            <div><strong>{questions.length}</strong><span>Total</span></div>
            <div><strong>{correctCount}</strong><span>Acertos</span></div>
            <div><strong>{questions.length - correctCount}</strong><span>Erros</span></div>
            <div><strong>{questions.length ? Math.round((correctCount / questions.length) * 100) : 0}%</strong><span>Percentual</span></div>
          </div>
          <button type="button" onClick={restart}>Tentar outra</button>
        </article>
      ) : null}
    </section>
  );
}
