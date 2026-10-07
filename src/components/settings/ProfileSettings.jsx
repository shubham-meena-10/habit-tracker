import { useState } from 'react';
import Field from '../common/Field';
import { useAppState, useAppActions } from '../../store/AppContext';
import { THEMES, applyTheme } from '../../hooks/useTheme';

const THEME_LABELS = { system: 'Match my device', light: 'Light', dark: 'Dark' };

export default function ProfileSettings() {
  const { settings } = useAppState();
  const actions = useAppActions();
  const [draft, setDraft] = useState({});
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  const theme = THEMES.includes(settings.theme) ? settings.theme : 'system';
  const saved = {
    profileName: settings.profileName && settings.profileName !== 'Me' ? settings.profileName : '',
    defaultProgressionAmount: settings.defaultProgressionAmount || '5',
    defaultProgressionInterval: settings.defaultProgressionInterval || '14',
    defaultProgressionUnit: settings.defaultProgressionUnit || 'days',
  };
  const v = { ...saved, ...draft };
  const set = (patch) => { setMsg(null); setDraft((d) => ({ ...d, ...patch })); };

  // The theme applies and saves straight away: one control, nothing to forget to confirm.
  async function changeTheme(next) {
    applyTheme(next);
    try { await actions.saveSettings({ theme: next }); } catch (err) { console.error(err); setMsg({ err: 'Could not save the theme.' }); }
  }

  async function save() {
    const amount = v.defaultProgressionAmount.trim();
    const interval = Number(v.defaultProgressionInterval);
    if (amount !== '' && !(Number(amount) > 0)) { setMsg({ err: 'The default amount must be greater than 0 (or empty).' }); return; }
    if (!Number.isInteger(interval) || interval < 1 || interval > 3650) { setMsg({ err: 'The default interval must be a whole number, 1 or more.' }); return; }
    if (v.profileName.trim().length > 40) { setMsg({ err: 'The name is too long (max 40 characters).' }); return; }
    setSaving(true);
    try {
      const patch = {};
      Object.keys(draft).forEach((k) => { patch[k] = k === 'profileName' ? v[k].trim() : v[k]; });
      await actions.saveSettings(patch);
      setDraft({});
      setMsg({ ok: 'Saved. It syncs to your Sheet in the background.' });
    } catch (err) {
      console.error(err);
      setMsg({ err: 'Could not save settings.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card">
      <h2>Profile &amp; appearance</h2>
      <Field label="Theme" htmlFor="ps-theme">
        <select id="ps-theme" className="input" value={theme} onChange={(e) => changeTheme(e.target.value)}>
          {THEMES.map((t) => (<option key={t} value={t}>{THEME_LABELS[t]}</option>))}
        </select>
      </Field>
      <Field label="Your name" htmlFor="ps-name" hint="Shown in the greeting on Home. Leave empty to skip it.">
        <input id="ps-name" className="input" value={v.profileName} maxLength={40}
          onChange={(e) => set({ profileName: e.target.value })} />
      </Field>

      <h3 className="small-title">Defaults for new progression habits</h3>
      <div className="form-row">
        <Field label="Amount" htmlFor="ps-amount">
          <input id="ps-amount" className="input" inputMode="decimal" value={v.defaultProgressionAmount}
            onChange={(e) => set({ defaultProgressionAmount: e.target.value })} />
        </Field>
        <Field label="Every" htmlFor="ps-int">
          <input id="ps-int" className="input" inputMode="numeric" value={v.defaultProgressionInterval}
            onChange={(e) => set({ defaultProgressionInterval: e.target.value })} />
        </Field>
        <Field label="Unit" htmlFor="ps-unit">
          <select id="ps-unit" className="input" value={v.defaultProgressionUnit}
            onChange={(e) => set({ defaultProgressionUnit: e.target.value })}>
            <option value="days">days</option>
            <option value="weeks">weeks</option>
            <option value="months">months</option>
          </select>
        </Field>
      </div>
      <p className="muted small">These pre-fill the Progression section when you create a habit. Existing habits are not changed.</p>

      <div className="btn-row">
        <button className="btn btn--primary" onClick={save} disabled={saving || Object.keys(draft).length === 0}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      {msg && msg.ok && <p role="status" className="small">✅ {msg.ok}</p>}
      {msg && msg.err && <p role="alert" className="small text-danger">❌ {msg.err}</p>}
    </section>
  );
}