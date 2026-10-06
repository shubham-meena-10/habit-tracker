export default function UndoBar({ undo, onUndo }) {
  if (!undo) return null;
  return (
    <div className="undo-bar" role="status" aria-live="polite">
      <span>{undo.label}</span>
      <button className="btn btn--small" onClick={onUndo}>Undo</button>
    </div>
  );
}