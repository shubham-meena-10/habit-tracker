import { useState } from 'react';
import { useInstall } from '../../hooks/useInstall';

export default function InstallCard() {
  const { standalone, canPrompt, ios, prompt } = useInstall();
  const [msg, setMsg] = useState('');
  const secure = typeof window !== 'undefined' && window.isSecureContext;
  const cached = typeof navigator !== 'undefined' && 'serviceWorker' in navigator && Boolean(navigator.serviceWorker.controller);

  async function install() {
    const outcome = await prompt();
    setMsg(outcome === 'accepted' ? 'Installing…' : '');
  }

  return (
    <section className="card">
      <h2>Install &amp; offline</h2>
      <dl className="kv">
        <dt>Running as</dt><dd>{standalone ? 'Installed app' : 'Browser tab'}</dd>
        <dt>App files</dt>
        <dd>{cached ? 'Cached: opens offline' : 'Not cached yet (build and open the production version once online)'}</dd>
        <dt>Secure (HTTPS)</dt><dd>{secure ? 'Yes' : 'No: installing and offline need HTTPS (localhost is fine)'}</dd>
      </dl>

      {standalone && <p role="status">✅ You&apos;re using the installed app.</p>}

      {!standalone && canPrompt && (
        <div className="btn-row">
          <button className="btn btn--primary" onClick={install}>Install app</button>
        </div>
      )}
      {msg && <p role="status" className="small">{msg}</p>}

      {!standalone && !canPrompt && ios && (
        <div className="small">
          <p><strong>On iPhone / iPad (Safari):</strong></p>
          <ol>
            <li>Tap the <strong>Share</strong> button.</li>
            <li>Choose <strong>Add to Home Screen</strong>.</li>
            <li>Tap <strong>Add</strong>, then open the app from your Home Screen.</li>
          </ol>
          <p className="muted">Wait for the &quot;✓ Synced&quot; pill first. The installed app has its own storage and starts from your Sheet.</p>
        </div>
      )}

      {!standalone && !canPrompt && !ios && (
        <p className="muted small">
          Android Chrome: menu ⋮ → <strong>Install app</strong>. Desktop Chrome / Edge: the install icon at the right of the address bar, or menu → <strong>Install Habits</strong>.
        </p>
      )}
    </section>
  );
}