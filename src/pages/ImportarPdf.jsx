import { useState } from 'react';
import { registerManualPdfPair } from '../services/manualPdfService.js';

const initialForm = {
  title: '',
  year: '',
  board: '',
  role: '',
  organization: 'IBGE',
  proofPdfUrl: '',
  answerPdfUrl: '',
  sourceName: 'Importação manual',
  sourcePageUrl: '',
};

export default function ImportarPdf() {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    setError('');

    if (!form.title || !form.proofPdfUrl) {
      setError('Informe o titulo da prova e a URL do PDF da prova.');
      return;
    }

    setLoading(true);
    const { data, error: submitError } = await registerManualPdfPair(form);
    setLoading(false);

    if (submitError) {
      setError(submitError.message);
      return;
    }

    setMessage(`PDFs cadastrados para: ${data.exam.title}`);
    setForm(initialForm);
  }

  return (
    <section className="content-stack">
      <header className="page-header">
        <div>
          <span className="eyebrow">Importacao</span>
          <h1>Importar PDF</h1>
        </div>
      </header>

      {message ? <div className="success">{message}</div> : null}
      {error ? <div className="error">{error}</div> : null}

      <article className="notice">
        Depois de cadastrar os PDFs, rode no terminal: npm run manual:download-pdfs, npm run manual:extract-text e npm run manual:parse-pdfs.
      </article>

      <form className="panel-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label>Titulo da prova<input value={form.title} onChange={(event) => updateField('title', event.target.value)} /></label>
          <label>Ano<input value={form.year} onChange={(event) => updateField('year', event.target.value)} /></label>
          <label>Banca<input value={form.board} onChange={(event) => updateField('board', event.target.value)} /></label>
          <label>Cargo<input value={form.role} onChange={(event) => updateField('role', event.target.value)} /></label>
          <label>Orgao<input value={form.organization} onChange={(event) => updateField('organization', event.target.value)} /></label>
          <label>Nome da fonte<input value={form.sourceName} onChange={(event) => updateField('sourceName', event.target.value)} /></label>
        </div>
        <label>URL PDF da prova<input value={form.proofPdfUrl} onChange={(event) => updateField('proofPdfUrl', event.target.value)} /></label>
        <label>URL PDF do gabarito<input value={form.answerPdfUrl} onChange={(event) => updateField('answerPdfUrl', event.target.value)} /></label>
        <label>URL da pagina fonte<input value={form.sourcePageUrl} onChange={(event) => updateField('sourcePageUrl', event.target.value)} /></label>
        <button disabled={loading} type="submit">{loading ? 'Cadastrando...' : 'Cadastrar PDFs'}</button>
      </form>
    </section>
  );
}
