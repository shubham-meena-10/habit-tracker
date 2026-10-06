export default function EmptyState({ title, message, children }) {
  return (
    <div className="empty-state">
      <h2>{title}</h2>
      <p className="muted">{message}</p>
      {children}
    </div>
  );
}