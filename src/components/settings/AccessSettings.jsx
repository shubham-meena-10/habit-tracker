import { useState } from 'react';
import { tokenSource } from '../../config';
import { clearStoredToken, storeToken } from '../../services/tokenService';
import { useAppActions } from '../../store/AppContext';

const LABEL = { device: 'Stored on this device', build: 'Built into the app', none: 'Not set' };

export default function AccessSettings() {
  const actions = useAppActions();
  const [value, setValue] = useState('');
  const [msg, setMsg] = useState(null);
  const [, bump] = useState(0);
  const source = tokenSource();

  async function save() {
    const t = value.trim();
    if (t.length < 20 || /\s/.test(t)) {
      setMsg({ err: 'Paste the full token printed by generateApiToken().' });
      return;
    }
    try {
      await storeToken(t);
      setValue('');
      bump((n) => n + 1);
      setMsg({ ok: 'Token saved on this device. Syncing…' });
      actions.syncNow(false);
    } catch (err) {
      console.error(err);
      setMsg({ err: 'Could not save the token.' });
    }
  }

  async function remove() {
    try {
      await clearStoredToken();
      bump((n) => n + 1);
      setMsg({ ok: 'Token removed from this device.' });
    } catch (err) {
      console.error(err);
      setMsg({ err: 'Could not remove the token.' });
    }
  }

  return (
    <section className="card">
      <h2>Access</h2>
      <dl className="kv">
        <dt>API token</dt><dd>{LABEL[source]}</dd>
      </dl>
      <p className="muted small">
        Build the app with an empty <code>VITE_API_TOKEN</code> and paste the token here on each device. Then the published files contain no secret. It stays in this browser&apos;s storage and is never included in backups.
      </p>
      <div className="form-row">
        <div className="field">
          <label htmlFor="ac-token">New token</label>
          <input id="ac-token" className="input" type="password" autoComplete="off" spellCheck={false}
            value={value} onChange={(e) => { setMsg(null); setValue(e.target.value); }} />
        </div>
      </div>
      <div className="btn-row">
        <button className="btn btn--primary" onClick={save} disabled={!value.trim()}>Save on this device</button>
        {source === 'device' && <button className="btn" onClick={remove}>Remove from this device</button>}
      </div>
      {msg && msg.ok && <p role="status" className="small">✅ {msg.ok}</p>}
      {msg && msg.err && <p role="alert" className="small text-danger">❌ {msg.err}</p>}
    </section>
  );
}