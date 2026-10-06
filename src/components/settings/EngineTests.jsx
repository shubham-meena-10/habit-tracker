import { useState } from 'react';
import { runEngineTests } from '../../engine/selfTest';

export default function EngineTests() {
  const [results, setResults] = useState(null);
  const failed = results ? results.filter((r) => !r.pass) : [];

  return (
    <section className="card">
      <h2>Engine self-test</h2>
      <p className="muted small">Checks the progression and calculation engine against known cases.</p>
      <button className="btn" onClick={() => setResults(runEngineTests())}>Run tests</button>
      {results && (
        <p role="status">
          {failed.length === 0
            ? `✅ All ${results.length} tests passed`
            : `❌ ${failed.length} of ${results.length} failed`}
        </p>
      )}
      {failed.length > 0 && (
        <ul className="plain-list">
          {failed.map((f) => (
            <li key={f.name} className="small text-danger">{f.name}: got {String(f.got)}, expected {String(f.want)}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
