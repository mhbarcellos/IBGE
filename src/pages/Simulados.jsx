import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import EmptyState from '../components/EmptyState.jsx';
import Loading from '../components/Loading.jsx';
import { targetRole } from '../lib/targetRole.js';
import { saveAttempt } from '../services/performanceService.js';
import { allDisciplinesValue, getQuestionFilterOptions, getTrainingQuestions } from '../services/questionService.js';
import { createSimulatedExam, finishSimulatedExam, saveSimulatedExamQuestion } from '../services/simulatedExamService.js';

const letters = ['A', 'B', 'C', 'D', 'E'];
const quantityOptions = [10, 20, 30, 60];

function resultPercent(correct, total) {
  return total ? Math.round((correct / total) * 100) : 0;
}

function optionClass({ letter, selected, correctAnswer, answered }) {
  const classes = ['option-button'];
  if (selected === letter) classes.push('option-selected');
  if (answered && correctAnswer === letter) classes.push('option-correct');
  if (answered && selected === letter && selected !== correctAnswer) classes.push('option-wrong');
  if (answered) classes.push('option-disabled');
  return classes.join(' ');
}

export default function Simulados() {
  const [filters, setFilters] = useState({
    quantity: 10,
    focusMode: 'target',
    discipline: allDisciplinesValue,
    timed: false,
  });
  const [options, setOptions] = useState({ disciplines: [allDisciplinesValue], count: 0 });
  const [questions, setQuestions] = useState([]);
  const [simulation, setSimulation] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState('');
  const [answered, setAnswered] = useState(false);
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const current = questions[currentIndex];
  const finished = questions.length > 0 && currentIndex >= questions.length;
  const correct = answers.filter((answer) => answer.isCorrect).length;
  const wrongAnswers = answers.filter((answer) => !answer.isCorrect);

  useEffect(() => {
    getQuestionFilterOptions({ includePendingReview: false, focusMode: filters.focusMode }).then(({ data }) => {
      setOptions(data);
      setLoading(false);
    });
  }, [filters.focusMode]);

  const currentOptions = useMemo(() => letters.filter((letter) => current?.alternatives?.[letter]), [current]);

  function updateFilter(name, value) {
    setFilters((currentFilters) => ({ ...currentFilters, [name]: value }));
  }

  async function startSimulation(event) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    const { data, error } = await getTrainingQuestions({
      limit: filters.quantity,
      focusMode: filters.focusMode,
      discipline: filters.discipline,
      includePendingReview: false,
    });
    if (error) setMessage(error.message);
    if (!data.length) {
      setMessage('Nenhuma questão encontrada para montar este simulado.');
      setLoading(false);
      return;
    }

    const createResult = await createSimulatedExam({
      title: `Simulado ${new Date().toLocaleDateString('pt-BR')}`,
      focus: filters.focusMode,
      total_questions: data.length,
    });
    setSimulation(createResult.data);
    setQuestions(data);
    setCurrentIndex(0);
    setSelected('');
    setAnswered(false);
    setAnswers([]);
    setLoading(false);
  }

  async function chooseAnswer(letter) {
    if (!current || answered) return;
    const isCorrect = letter === current.correct_answer;
    setSelected(letter);
    setAnswered(true);
    const answer = { question: current, selectedAnswer: letter, isCorrect };
    setAnswers((items) => [...items, answer]);
    await saveAttempt({
      question_id: current.id,
      selected_answer: letter,
      is_correct: isCorrect,
    });
    await saveSimulatedExamQuestion({
      simulated_exam_id: simulation?.id,
      question_id: current.id,
      question_order: currentIndex + 1,
      selected_answer: letter,
      is_correct: isCorrect,
      answered_at: new Date().toISOString(),
    });
  }

  async function nextQuestion() {
    setSelected('');
    setAnswered(false);
    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);
    if (nextIndex >= questions.length) {
      await finishSimulatedExam(simulation?.id, {
        correct_count: correct,
        wrong_count: questions.length - correct,
      });
    }
  }

  function reset() {
    setQuestions([]);
    setSimulation(null);
    setCurrentIndex(0);
    setSelected('');
    setAnswered(false);
    setAnswers([]);
    setMessage('');
  }

  if (loading) return <Loading />;

  return (
    <section className="content-stack">
      <header className="page-header">
        <div>
          <span className="eyebrow">Treino de prova</span>
          <h1>Simulados</h1>
        </div>
      </header>

      {!questions.length ? (
        <form className="filters" onSubmit={startSimulation}>
          <label>
            Quantidade
            <select value={filters.quantity} onChange={(event) => updateFilter('quantity', Number(event.target.value))}>
              {quantityOptions.map((quantity) => <option key={quantity} value={quantity}>{quantity} questões</option>)}
            </select>
          </label>
          <label>
            Foco
            <select value={filters.focusMode} onChange={(event) => updateFilter('focusMode', event.target.value)}>
              <option value="target">{targetRole}</option>
              <option value="target_related">{targetRole} + relacionados</option>
              <option value="all">Todas</option>
            </select>
          </label>
          <label>
            Disciplina
            <select value={filters.discipline} onChange={(event) => updateFilter('discipline', event.target.value)}>
              {options.disciplines.map((discipline) => (
                <option key={discipline} value={discipline}>
                  {discipline === allDisciplinesValue ? 'Todas as disciplinas' : discipline}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-check">
            <input checked={filters.timed} type="checkbox" onChange={(event) => updateFilter('timed', event.target.checked)} />
            Cronômetro opcional
          </label>
          <button disabled={!options.count} type="submit">Criar simulado rápido</button>
        </form>
      ) : null}

      {message ? <div className="error">{message}</div> : null}

      {!questions.length && !options.count ? (
        <EmptyState title="Ainda não há questões suficientes para simulado." description="Importe ou cadastre questões com gabarito para criar simulados." />
      ) : null}

      {current ? (
        <article className="question-card">
          <div className="question-meta">
            <span>Questão {currentIndex + 1} de {questions.length}</span>
            <span>{current.discipline}</span>
            <span>{current.topic}</span>
            {filters.timed ? <span>Modo com cronômetro</span> : null}
          </div>
          <h3>{current.statement}</h3>
          <div className="option-list">
            {currentOptions.map((letter) => (
              <button
                className={optionClass({ letter, selected, correctAnswer: current.correct_answer, answered })}
                disabled={answered}
                key={letter}
                type="button"
                onClick={() => chooseAnswer(letter)}
              >
                <strong>{letter}</strong>
                <span>{current.alternatives[letter]}</span>
              </button>
            ))}
          </div>

          {answered ? (
            <div className={selected === current.correct_answer ? 'success' : 'error'}>
              {selected === current.correct_answer ? 'Você acertou.' : 'Você errou.'}
              <p><strong>Resposta correta: {current.correct_answer}</strong></p>
            </div>
          ) : null}

          {answered && selected !== current.correct_answer ? (
            <div className="answer-box">
              <strong>Por que a alternativa {selected} não está correta</strong>
              <p>{current.optionExplanations?.[selected]?.explanation || 'Ainda não há explicação revisada para esta alternativa.'}</p>
            </div>
          ) : null}

          {answered ? (
            <div className="answer-box">
              <strong>Comentário</strong>
              <p>{current.explanation || 'Ainda não há explicação revisada para esta questão.'}</p>
            </div>
          ) : null}

          <div className="button-row">
            <button disabled={!answered} type="button" onClick={nextQuestion}>Próxima questão</button>
            <button className="secondary-button" type="button" onClick={reset}>Encerrar</button>
          </div>
        </article>
      ) : null}

      {finished ? (
        <article className="result-panel">
          <h2>Resultado final</h2>
          <div className="stats-grid compact">
            <div><strong>{questions.length}</strong><span>Total</span></div>
            <div><strong>{correct}</strong><span>Acertos</span></div>
            <div><strong>{questions.length - correct}</strong><span>Erros</span></div>
            <div><strong>{resultPercent(correct, questions.length)}%</strong><span>Percentual</span></div>
          </div>
          {wrongAnswers.length ? (
            <div className="wrong-list">
              {wrongAnswers.map((answer) => (
                <p key={answer.question.id}><strong>{answer.question.discipline}:</strong> {answer.question.statement}</p>
              ))}
            </div>
          ) : null}
          <div className="button-row">
            <Link className="button-link" to="/revisao-erros">Revisar erros</Link>
            <button className="secondary-button" type="button" onClick={reset}>Novo simulado</button>
          </div>
        </article>
      ) : null}
    </section>
  );
}
