export default function Loading({ label = 'Carregando...' }) {
  return (
    <div className="loading" role="status">
      <span className="spinner" />
      {label}
    </div>
  );
}
