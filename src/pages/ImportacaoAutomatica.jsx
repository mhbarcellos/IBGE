import { useEffect, useState } from 'react';
import Loading from '../components/Loading.jsx';
import { getAutoImportDashboard, monitoredSources } from '../services/autoImportService.js';

export default function ImportacaoAutomatica() {
  const [dashboard, setDashboard] = useState({ reports: [], totals: { exams: 0, questions: 0, pending: 0 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getAutoImportDashboard().then(({ data, error: loadError }) => {
      setDashboard(data);
      setError(loadError?.message || '');
      setLoading(false);
    });
  }, []);

  return (
    <section className="content-stack">
      <header className="page-header">
        <div>
          <span className="eyebrow">Importacao</span>
          <h1>Importacao automatica</h1>
        </div>
      </header>

      <article className="notice">
        A importacao automatica nao burla CAPTCHA, Turnstile, login ou links protegidos. Fontes protegidas sao ignoradas e registradas no relatorio.
      </article>

      <div className="button-row">
        <code>npm run ibge:import-all</code>
        <code>npm run ibge:check</code>
      </div>

      {error ? <div className="error">{error}</div> : null}
      {loading ? <Loading /> : null}

      {!loading ? (
        <>
          <div className="stats-grid compact">
            <div><strong>{dashboard.totals.exams}</strong><span>Provas</span></div>
            <div><strong>{dashboard.totals.files}</strong><span>Arquivos</span></div>
            <div><strong>{dashboard.totals.questions}</strong><span>Questoes importadas</span></div>
            <div><strong>{dashboard.totals.pending}</strong><span>Pendentes</span></div>
            <div><strong>{dashboard.processable}</strong><span>Processaveis</span></div>
            <div><strong>{dashboard.unsupported}</strong><span>Nao suportados</span></div>
          </div>

          <article className="table-card">
            <h2>Arquivos por extensao</h2>
            <div className="responsive-table">
              <table>
                <thead>
                  <tr><th>Extensao</th><th>Arquivos</th></tr>
                </thead>
                <tbody>
                  {Object.entries(dashboard.filesByExtension || {}).map(([extension, total]) => (
                    <tr key={extension}>
                      <td><span className="pill">{extension}</span></td>
                      <td>{total}</td>
                    </tr>
                  ))}
                  {!Object.keys(dashboard.filesByExtension || {}).length ? (
                    <tr><td colSpan="2">Nenhum arquivo cadastrado ainda.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </article>

          <article className="table-card">
            <h2>Fontes monitoradas</h2>
            <div className="responsive-table">
              <table>
                <thead>
                  <tr><th>Fonte</th><th>Tipo</th><th>Arquivos diretos</th></tr>
                </thead>
                <tbody>
                  {monitoredSources.map((source) => (
                    <tr key={source.name}>
                      <td>{source.name}</td>
                      <td>{source.type}</td>
                      <td><span className="pill">{source.canDownloadFiles ? 'Sim' : 'Indice apenas'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="table-card">
            <h2>Ultimos relatorios</h2>
            <div className="responsive-table">
              <table>
                <thead>
                  <tr><th>Fonte</th><th>Status</th><th>Provas</th><th>Arquivos</th><th>Questoes</th><th>Revisao</th></tr>
                </thead>
                <tbody>
                  {dashboard.reports.map((report) => (
                    <tr key={report.id}>
                      <td>{report.source_name}</td>
                      <td><span className="pill">{report.status}</span></td>
                      <td>{report.exams_found}/{report.exams_imported}</td>
                      <td>{report.pdfs_found} ({report.pdfs_blocked} ignorados)</td>
                      <td>{report.questions_imported}</td>
                      <td>{report.questions_needing_review}</td>
                    </tr>
                  ))}
                  {!dashboard.reports.length ? (
                    <tr><td colSpan="6">Nenhum relatorio registrado ainda.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </article>
        </>
      ) : null}
    </section>
  );
}
