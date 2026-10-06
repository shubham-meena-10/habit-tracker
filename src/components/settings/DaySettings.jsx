import { useState } from 'react';
import Field from '../common/Field';
import { useAppState, useAppActions } from '../../store/AppContext';
import { DEFAULT_CHECKIN_TIME, validCloseTime, validTime } from '../../engine/checkin';

export default function DaySettings() {
  const { settings } = useAppState();
  const actions = useAppActions();
  const [draft, setDraft] = useState({});
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  const saved = {
    dayCloseTime: settings.dayCloseTime || '23:59',
    checkinTime: settings.checkinTime || DEFAULT_CHECKIN_TIME,
    weekStartsOn: Number(settings.weekStartsOn ?? 1) === 0 ? '0' : '1',
  };
  const v = { ...saved, ...draft };
  const set = (patch) => { setMsg(null); setDraft((d) => ({ ...d, ...patch })); };

  async function save() {
    if (!validCloseTime(v.dayCloseTime)) {
      setMsg({ err: 'The day can close between 12:00 and 23:59.' });
      return;
    }
    if (!validTime(v.checkinTime)) {
      setMsg({ err: 'Enter a valid check-in time.' });
      return;
    }
    setSaving(true);
    try {
      const patch = {};
      Object.keys(draft).forEach((k) => { patch[k] = v[k]; });
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
      <h2>Day</h2>
      <Field label="A day counts as finished at" htmlFor="ds-close"
        hint="Until then, habits you haven't done yet are simply to do. After it, they read “Not completed”, and limits (tea, rotis) count as met if you stayed within them. Between 12:00 and 23:59.">
        <input id="ds-close" type="time" className="input" value={v.dayCloseTime}
          onChange={(e) => set({ dayCloseTime: e.target.value })} />
      </Field>
      <Field label="Evening check-in prompt at" htmlFor="ds-checkin"
        hint="Home shows a “Time for your day check-in” card after this time.">
        <input id="ds-checkin" type="time" className="input" value={v.checkinTime}
          onChange={(e) => set({ checkinTime: e.target.value })} />
      </Field>
      <Field label="Week starts on" htmlFor="ds-week">
        <select id="ds-week" className="input" value={v.weekStartsOn} onChange={(e) => set({ weekStartsOn: e.target.value })}>
          <option value="1">Monday</option>
          <option value="0">Sunday</option>
        </select>
      </Field>
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