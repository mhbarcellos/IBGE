import { useEffect, useState } from 'react';
import EmptyState from '../components/EmptyState.jsx';
import Loading from '../components/Loading.jsx';
import QuestionCard from '../components/QuestionCard.jsx';
import { allDisciplinesValue, allTopicsValue, getQuestionFilterOptions, listQuestions } from '../services/questionService.js';

const initialFilters = {
  discipline: allDisciplinesValue,
  topic: allTopicsValue,
  board: '',
  year: '',
  role: '',
  includePendingReview: true,
};

export default function Questoes() {
  const [filters, setFilters] = useState(initialFilters);
  const [filterOptions, setFilterOptions] = useState({ disciplines: [allDisciplinesValue], topics: [allTopicsValue], count: 0 });
  const [questions, setQuestions] = useState([]);
  const [usingMock, setUsingMock] = useState(false);
  const [loading, setLoading] = useState(true);

  function loadQuestions(nextFilters = filters) {
    setLoading(true);
    listQuestions(nextFilters).then(({ data, usingMock: mock }) => {
      setQuestions(data);
      setUsingMock(mock);
      setLoading(false);
    });
  }

  useEffect(() => {
    loadQuestions(initialFilters);
  }, []);

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
    setFilters((current) => {
      if (name === 'discipline') return { ...current, discipline: value, topic: allTopicsValue };
      return { ...current, [name]: value };
    });
  }

  return (
    <section className="content-stack">
      <header className="page-header">
        <div>
          <span className="eyebrow">Banco</span>
          <h1>Banco de Questoes</h1>
        </div>
        {usingMock ? <span className="pill">Dados demonstrativos</span> : null}
      </header>

      <form className="filters" onSubmit={(event) => { event.preventDefault(); loadQuestions(); }}>
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
        <input placeholder="Banca" value={filters.board} onChange={(event) => updateFilter('board', event.target.value)} />
        <input placeholder="Ano" value={filters.year} onChange={(event) => updateFilter('year', event.target.value)} />
        <input placeholder="Prova/Cargo" value={filters.role} onChange={(event) => updateFilter('role', event.target.value)} />
        <button type="submit">Filtrar</button>
      </form>

      <article className="notice">{filterOptions.count} questoes disponiveis para disciplina/assunto selecionados.</article>

      {loading ? <Loading /> : null}
      {!loading && !questions.length ? <EmptyState title="Nenhuma questao encontrada." description="Ajuste os filtros ou cadastre questoes no Admin." /> : null}
      {!loading ? questions.map((question) => <QuestionCard key={question.id} question={question} />) : null}
    </section>
  );
}
