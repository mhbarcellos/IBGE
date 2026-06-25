import { useState } from 'react';
import { normalizeAlternatives } from '../services/questionService.js';

const optionKeys = ['A', 'B', 'C', 'D', 'E'];

export default function QuestionCard({ question }) {
  const [showAnswer, setShowAnswer] = useState(false);
  const { options: alternatives, error: alternativesError } = normalizeAlternatives(question.alternatives);
  const hasAnswer = optionKeys.includes(question.correct_answer);
  const explanationStatus = question.explanation_status || (question.explanation ? 'reviewed' : 'missing');
  const explanationLabel = {
    missing: 'Sem explicacao',
    auto_generated: 'Comentario automatico',
    reviewed: 'Comentario revisado',
  }[explanationStatus] || 'Sem explicacao';

  return (
    <article className="question-card">
      <div className="question-meta">
        <span>{question.discipline || 'Disciplina'}</span>
        <span>{question.topic || question.subject || 'Assunto'}</span>
        {question.exams?.title ? <span>{question.exams.title}</span> : null}
        {question.exams?.board ? <span>{question.exams.board}</span> : null}
        {question.exams?.year ? <span>{question.exams.year}</span> : null}
      </div>
      <div className="status-row">
        {question.needs_review ? <span className="pill warning">Pendente de revisao</span> : <span className="pill success-pill">Revisada</span>}
        {!hasAnswer ? <span className="pill warning">Sem gabarito</span> : null}
        <span className={explanationStatus === 'reviewed' ? 'pill success-pill' : 'pill warning'}>{explanationLabel}</span>
        {question.classification_status ? <span className="pill">Classificacao: {question.classification_status}</span> : null}
        {question.source_name ? <span className="pill">Origem: {question.source_name}</span> : null}
      </div>
      <h3>{question.statement}</h3>
      {alternativesError ? <div className="error">{alternativesError}</div> : null}
      <div className="alternatives">
        {optionKeys
          .filter((key) => alternatives[key])
          .map((key) => (
            <div className="alternative" key={key}>
              <strong>{key}</strong>
              <span>{alternatives[key]}</span>
            </div>
          ))}
      </div>
      {showAnswer ? (
        <div className="answer-box">
          <strong>{hasAnswer ? `Gabarito: ${question.correct_answer}` : 'Sem gabarito'}</strong>
          {question.explanation ? <p>{question.explanation}</p> : null}
        </div>
      ) : null}
      <button className="secondary-button" type="button" onClick={() => setShowAnswer((value) => !value)}>
        {showAnswer ? 'Ocultar resposta' : 'Mostrar resposta'}
      </button>
    </article>
  );
}
