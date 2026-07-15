import { useEffect, useState } from 'react';
import EmptyState from '../components/EmptyState.jsx';
import Loading from '../components/Loading.jsx';
import PageHeader from '../components/PageHeader.jsx';
import QuestionCard from '../components/QuestionCard.jsx';
import { targetRole } from '../lib/targetRole.js';
import { allDisciplinesValue, allTopicsValue, getQuestionFilterOptions, listQuestions } from '../services/questionService.js';

const initialFilters = {
  discipline: allDisciplinesValue,
  topic: allTopicsValue,
  board: '',
  year: '',
  role: '',
  roleFocus: 'all',
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
    getQuestionFilterOptions({
      discipline: filters.discipline,
      topic: filters.topic,
      roleFocus: filters.roleFocus,
      includePendingReview: filters.includePendingReview,
    }).then(({ data }) => {
      if (active) setFilterOptions(data);
    });
    return () => {
      active = false;
    };
  }, [filters.discipline, filters.topic, filters.roleFocus, filters.includePendingReview]);

  function updateFilter(name, value) {
    setFilters((current) => {
      if (name === 'discipline') return { ...current, discipline: value, topic: allTopicsValue };
      return { ...current, [name]: value };
    });
  }

  function clearFilters() {
    setFilters(initialFilters);
    loadQuestions(initialFilters);
  }

  return (
    <section className="content-stack">
      <PageHeader
        eyebrow="Banco"
        title="Banco de Questões"
        description="Filtre o essencial e pratique a partir de uma questão, disciplina ou prova."
        action={usingMock ? <span className="pill">Dados demonstrativos</span> : null}
      />

      <form className="filters compact-filter-card" onSubmit={(event) => { event.preventDefault(); loadQuestions(); }}>
        <label>
          Foco
          <select value={filters.roleFocus} onChange={(event) => updateFilter('roleFocus', event.target.value)}>
            <option value="target">{targetRole}</option>
            <option value="related">Relacionadas</option>
            <option value="other">Outras</option>
            <option value="unknown">Sem classificação</option>
            <option value="all">Todas</option>
          </select>
        </label>
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
        <input aria-label="Banca" placeholder="Banca" value={filters.board} onChange={(event) => updateFilter('board', event.target.value)} />
        <input aria-label="Ano" placeholder="Ano" value={filters.year} onChange={(event) => updateFilter('year', event.target.value)} />
        <input aria-label="Prova ou cargo" placeholder="Prova/Cargo" value={filters.role} onChange={(event) => updateFilter('role', event.target.value)} />
        <button type="submit">Filtrar</button>
        <button className="secondary-button" type="button" onClick={clearFilters}>Limpar filtros</button>
      </form>

      <p className="muted">{filterOptions.count} questões disponíveis para os filtros selecionados.</p>

      {loading ? <Loading /> : null}
      {!loading && !questions.length ? <EmptyState title="Nenhuma questão encontrada." description="Ajuste os filtros ou cadastre questões no Admin." /> : null}
      {!loading ? questions.map((question) => <QuestionCard key={question.id} question={question} />) : null}
    </section>
  );
}
