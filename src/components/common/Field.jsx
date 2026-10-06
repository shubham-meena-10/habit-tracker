export default function Field({ label, htmlFor, hint, error, children }) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && !error && <p className="muted small">{hint}</p>}
      {error && <p className="field__error" role="alert">{error}</p>}
    </div>
  );
}