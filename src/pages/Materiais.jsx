import { useEffect, useState } from 'react';
import EmptyState from '../components/EmptyState.jsx';
import Loading from '../components/Loading.jsx';
import { listMaterials } from '../services/materialService.js';

export default function Materiais() {
  const [materials, setMaterials] = useState([]);
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

  return (
    <section className="content-stack">
      <header className="page-header">
        <div>
          <span className="eyebrow">Estudo</span>
          <h1>Materiais</h1>
        </div>
        {usingMock ? <span className="pill">Dados demonstrativos</span> : null}
      </header>

      {!materials.length ? <EmptyState title="Nenhum material cadastrado." description="Cadastre materiais diretamente no Supabase por enquanto." /> : null}

      <div className="material-list">
        {materials.map((material) => (
          <article className="data-card" key={material.id}>
            <div className="question-meta">
              <span>{material.discipline}</span>
              <span>{material.subject}</span>
              {material.topic ? <span>{material.topic}</span> : null}
            </div>
            <h3>{material.title}</h3>
            <p>{material.content}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
