import { useEffect, useState } from 'react';
import EmptyState from '../components/EmptyState.jsx';
import Loading from '../components/Loading.jsx';
import { roleFocusLabels } from '../lib/targetRole.js';
import { listMaterials } from '../services/materialService.js';

const allValue = '__all__';

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

export default function Materiais() {
  const [materials, setMaterials] = useState([]);
  const [filters, setFilters] = useState({ discipline: allValue, subject: allValue, focus: allValue });
  const [usingMock, setUsingMock] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listMaterials().then(({ data, usingMock: mock }) => {
      setMaterials(data);
      setUsingMock(mock);
      setLoading(false);
    });
  }, []);

  if (loading) return <Loading />;

  const options = {
    disciplines: unique(materials.map((material) => material.discipline)),
    subjects: unique(materials.map((material) => material.subject || material.topic)),
    focuses: unique(materials.map((material) => material.role_focus || 'unknown')),
  };
  const filteredMaterials = materials.filter((material) => {
    const subject = material.subject || material.topic || '';
    const focus = material.role_focus || 'unknown';
    return (filters.discipline === allValue || material.discipline === filters.discipline)
      && (filters.subject === allValue || subject === filters.subject)
      && (filters.focus === allValue || focus === filters.focus);
  });

  return (
    <section className="content-stack">
      <header className="page-header">
        <div>
          <span className="eyebrow">Estudo</span>
          <h1>Materiais</h1>
        </div>
        {usingMock ? <span className="pill">Dados demonstrativos</span> : null}
      </header>

      <form className="filters">
        <label>
          Disciplina
          <select value={filters.discipline} onChange={(event) => setFilters((current) => ({ ...current, discipline: event.target.value }))}>
            <option value={allValue}>Todas</option>
            {options.disciplines.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label>
          Assunto
          <select value={filters.subject} onChange={(event) => setFilters((current) => ({ ...current, subject: event.target.value }))}>
            <option value={allValue}>Todos</option>
            {options.subjects.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label>
          Foco
          <select value={filters.focus} onChange={(event) => setFilters((current) => ({ ...current, focus: event.target.value }))}>
            <option value={allValue}>Todos</option>
            {options.focuses.map((item) => <option key={item} value={item}>{roleFocusLabels[item] || item}</option>)}
          </select>
        </label>
      </form>

      {!filteredMaterials.length ? <EmptyState title="Nenhum material encontrado." description="Ajuste os filtros ou cadastre materiais no Supabase." /> : null}

      <div className="material-list">
        {filteredMaterials.map((material) => (
          <article className="data-card" key={material.id}>
            <div className="question-meta">
              <span>{material.type || 'resumo'}</span>
              <span>{material.discipline}</span>
              <span>{material.subject}</span>
              {material.topic ? <span>{material.topic}</span> : null}
              <span>{roleFocusLabels[material.role_focus || 'unknown']}</span>
            </div>
            <h3>{material.title}</h3>
            <p>{material.content}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
