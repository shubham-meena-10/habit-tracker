import { useState } from 'react';
import Field from '../common/Field';
import { useAppState, useAppActions } from '../../store/AppContext';
import { volumeHabits, waterIncrementMl } from '../../utils/water';

export default function WaterSettings() {
  const { habits, settings } = useAppState();
  const actions = useAppActions();
  const [draft, setDraft] = useState({});
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  const list = volumeHabits(habits);
  const saved = {
    waterHabitId: settings.waterHabitId || '',
    waterUnit: settings.waterUnit === 'ml' ? 'ml' : 'L',
    increment: String(waterIncrementMl(settings)),
  };
  const v = { ...saved, ...draft };
  const set = (patch) => { setMsg(null); setDraft((d) => ({ ...d, ...patch })); };

  async function save() {
    const n = Number(v.increment);
    if (v.increment.trim() === '' || !Number.isInteger(n) || n < 1 || n > 5000) {
      setMsg({ err: 'Glass size must be a whole number of ml, from 1 to 5000.' });
      return;
    }
    setSaving(true);
    try {
      await actions.saveSettings({
        waterHabitId: v.waterHabitId,
        waterUnit: v.waterUnit,
        defaultWaterIncrementMl: String(n),
      });
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
      <h2>Water</h2>
      {list.length === 0 && (
        <p className="muted small">
          No litre/millilitre Quantity habit found. Create a Quantity habit measured in litres to use these options.
        </p>
      )}
      <Field label="Water habit" htmlFor="ws-habit" hint="Gets the big “+ 1 Glass” button on Home.">
        <select id="ws-habit" className="input" value={v.waterHabitId}
          onChange={(e) => set({ waterHabitId: e.target.value })} disabled={list.length === 0}>
          <option value="">Auto-detect</option>
          {list.map((h) => (<option key={h.habitId} value={h.habitId}>{h.icon} {h.name}</option>))}
        </select>
      </Field>
      <div className="form-row">
        <Field label="Glass size (ml)" htmlFor="ws-inc" hint="What “+ 1 Glass” adds.">
          <input id="ws-inc" className="input" inputMode="numeric" value={v.increment}
            onChange={(e) => set({ increment: e.target.value })} />
        </Field>
        <Field label="Show volumes in" htmlFor="ws-unit">
          <select id="ws-unit" className="input" value={v.waterUnit} onChange={(e) => set({ waterUnit: e.target.value })}>
            <option value="L">Litres (L)</option>
            <option value="ml">Millilitres (ml)</option>
          </select>
        </Field>
      </div>
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