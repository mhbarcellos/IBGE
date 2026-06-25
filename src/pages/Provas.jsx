import { useEffect, useState } from 'react';
import EmptyState from '../components/EmptyState.jsx';
import Loading from '../components/Loading.jsx';
import { listExams } from '../services/examService.js';

export default function Provas() {
  const [exams, setExams] = useState([]);
  const [usingMock, setUsingMock] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listExams().then(({ data, usingMock: mock }) => {
      setExams(data);
      setUsingMock(mock);
      setLoading(false);
    });
  }, []);

  if (loading) return <Loading />;

  return (
    <section className="content-stack">
      <header className="page-header">
        <div>
          <span className="eyebrow">Catalogo</span>
          <h1>Provas</h1>
        </div>
        {usingMock ? <span className="pill">Dados demonstrativos</span> : null}
      </header>

      {!exams.length ? <EmptyState title="Nenhuma prova cadastrada." description="Use a tela Admin para cadastrar a primeira prova." /> : null}

      <div className="card-grid">
        {exams.map((exam) => (
          <article className="data-card" key={exam.id}>
            <h3>{exam.title}</h3>
            <dl>
              <div><dt>Ano</dt><dd>{exam.year || '-'}</dd></div>
              <div><dt>Banca</dt><dd>{exam.board || '-'}</dd></div>
              <div><dt>Cargo</dt><dd>{exam.role || '-'}</dd></div>
            </dl>
            {exam.source_url ? <a href={exam.source_url} target="_blank" rel="noreferrer">Fonte</a> : null}
          </article>
        ))}
      </div>
    </section>
  );
}
