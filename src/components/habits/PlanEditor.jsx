import { useState } from 'react';
import Field from '../common/Field';
import { describeError } from '../../api/api';
import { useAppActions } from '../../store/AppContext';
import { GOAL_DIRECTIONS as D, TRACKING_TYPES as T } from '../../constants/trackingTypes';
import { projectLevels } from '../../engine/progression';
import { formatAmount } from '../../utils/format';
import { formatShortDate } from '../../utils/date';

const fmtNum = (n) => String(Math.round(n * 10000) / 10000);
const same = (a, b) => (a ?? null) === (b ?? null);

export default function PlanEditor({ habit, anchors, info, today }) {
  const actions = useAppActions();
  const f = habit.unitFactor || 1;
  const unitLabel = habit.unit || 'units';

  // Original base values: untouched fields are sent back exactly, so unit conversion can never drift.
  const orig = {
    target: { text: fmtNum(info.target / f), base: info.target },
    amount: habit.progressionAmount ? { text: fmtNum(habit.progressionAmount / f), base: habit.progressionAmount } : null,
    end: habit.endTarget !== null && habit.endTarget !== undefined
      ? { text: fmtNum(habit.endTarget / f), base: habit.endTarget } : null,
  };
  const initial = () => ({
    target: orig.target.text,
    enabled: Boolean(habit.progressionEnabled),
    amount: orig.amount ? orig.amount.text : '',
    interval: habit.progressionInterval ? String(habit.progressionInterval) : '14',
    unit: habit.progressionUnit || 'days',
    end: orig.end ? orig.end.text : '',
  });

  // Re-sync the draft when the saved habit or target changes (keeps the message below).
  const sig = `${habit.updatedAt}|${info.target}`;
  const [v, setV] = useState(initial);
  const [seen, setSeen] = useState(sig);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  if (seen !== sig) { setSeen(sig); setV(initial()); }
  const set = (patch) => { setMsg(null); setV((x) => ({ ...x, ...patch })); };

  const toBase = (key) => {
    const text = String(v[key]).trim();
    if (text === '') return null;
    const o = orig[key];
    if (o && o.text === text) return o.base;
    const n = Number(text);
    return Number.isFinite(n) ? Math.round(n * f * 1e6) / 1e6 : NaN;
  };

  // ----- validate -----
  const errors = {};
  const target = toBase('target');
  if (target === null || Number.isNaN(target) || target < 0) errors.target = 'Enter a target (0 or more)';
  else if (target === 0 && habit.trackingType !== T.LIMIT) errors.target = 'Target must be greater than 0';
  else if (habit.goalDirection === D.INCREASE && habit.minTarget !== null && habit.minTarget !== undefined && target < habit.minTarget) {
    errors.target = `Cannot be below your minimum (${formatAmount(habit, habit.minTarget)})`;
  }

  let amount = null;
  let interval = null;
  let end = null;
  if (v.enabled) {
    amount = toBase('amount');
    if (amount === null || Number.isNaN(amount) || !(amount > 0)) errors.amount = 'Enter an amount greater than 0';
    interval = Number(v.interval);
    if (!Number.isInteger(interval) || interval < 1 || interval > 3650) errors.interval = 'Enter a whole number, 1 or more';
    end = toBase('end');
    if (Number.isNaN(end) || (end !== null && end < 0)) errors.end = 'Enter a number (0 or more)';
    else if (end !== null && !errors.target) {
      if (habit.goalDirection === D.INCREASE && end < target) errors.end = 'Final target must not be below the target';
      if (habit.goalDirection === D.DECREASE && end > target) errors.end = 'Final target must not be above the target';
    }
  }

  const valid = Object.keys(errors).length === 0;
  const targetChanged = valid && target !== info.target;
  const settingsChanged = valid && (
    v.enabled !== Boolean(habit.progressionEnabled) ||
    (v.enabled && !(same(amount, habit.progressionAmount) && same(interval, habit.progressionInterval) &&
      v.unit === (habit.progressionUnit || 'days') && same(end, habit.endTarget)))
  );

  // ----- preview: current plan vs new plan, both from today -----
  const before = projectLevels(habit, anchors, today, 4);
  const after = valid
    ? projectLevels(
      { ...habit, progressionEnabled: v.enabled, progressionAmount: amount, progressionInterval: interval, progressionUnit: v.unit, endTarget: end },
      [{ effectiveDate: today, target, reason: 'manual', createdAt: '' }], today, 4
    )
    : null;

  const rows = (list) => (
    <ul className="plain-list">
      {list.map((l) => (
        <li key={l.from} className="small">
          {formatShortDate(l.from)}{l.to ? ` – ${formatShortDate(l.to)}` : ' onwards'}
          {' → '}<strong>{formatAmount(habit, l.target)}</strong>
        </li>
      ))}
    </ul>
  );

  async function apply() {
    if (!valid || busy) return;
    if (!window.confirm('Apply this plan from today? Past days keep the targets they had.')) return;
    setBusy(true);
    setMsg(null);
    let savedSettings = false;
    try {
      if (settingsChanged) {
        await actions.saveHabit({
          habitId: habit.habitId,
          progressionEnabled: v.enabled,
          progressionAmount: v.enabled ? amount : (habit.progressionAmount ?? null),
          progressionInterval: v.enabled ? interval : (habit.progressionInterval ?? null),
          progressionUnit: v.unit,
          endTarget: v.enabled ? end : (habit.endTarget ?? null),
        });
        savedSettings = true;
      }
      if (targetChanged) await actions.setTarget({ habitId: habit.habitId, reason: 'manual', target });
      setMsg({ ok: 'Plan updated. Past days keep the targets they had.' });
    } catch (err) {
      setMsg({
        err: savedSettings
          ? `The progression settings were saved, but the new target was not: ${describeError(err)}`
          : describeError(err),
      });
    } finally {
      setBusy(false);
    }
  }

  const verb = habit.goalDirection === D.DECREASE ? 'Decrease' : 'Increase';

  return (
    <details className="card plan-editor">
      <summary>Adjust plan…</summary>
      <p className="muted small">
        Changes apply from today. Earlier days keep the targets they had, because each target change stores the plan that was in force.
      </p>

      <Field label={`Target from today (${unitLabel})`} htmlFor="pe-target" error={errors.target}>
        <input id="pe-target" className="input" inputMode="decimal" value={v.target}
          aria-invalid={Boolean(errors.target)} onChange={(e) => set({ target: e.target.value })} />
      </Field>

      <label className="check">
        <input type="checkbox" checked={v.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
        <span>Change the target automatically over time</span>
      </label>

      {v.enabled && (
        <>
          <div className="form-row">
            <Field label={`${verb} by (${unitLabel})`} htmlFor="pe-amount" error={errors.amount}>
              <input id="pe-amount" className="input" inputMode="decimal" value={v.amount}
                aria-invalid={Boolean(errors.amount)} onChange={(e) => set({ amount: e.target.value })} />
            </Field>
            <Field label="Every" htmlFor="pe-interval" error={errors.interval}>
              <input id="pe-interval" className="input" inputMode="numeric" value={v.interval}
                aria-invalid={Boolean(errors.interval)} onChange={(e) => set({ interval: e.target.value })} />
            </Field>
            <Field label="Unit" htmlFor="pe-unit">
              <select id="pe-unit" className="input" value={v.unit} onChange={(e) => set({ unit: e.target.value })}>
                <option value="days">days</option>
                <option value="weeks">weeks</option>
                <option value="months">months</option>
              </select>
            </Field>
          </div>
          <Field label={`Final target (${unitLabel}, optional)`} htmlFor="pe-end" error={errors.end}
            hint={habit.goalDirection === D.DECREASE ? 'Progression stops at this floor.' : 'Progression stops at this cap.'}>
            <input id="pe-end" className="input" inputMode="decimal" value={v.end}
              aria-invalid={Boolean(errors.end)} onChange={(e) => set({ end: e.target.value })} />
          </Field>
        </>
      )}

      {valid && (
        <div className="plan-compare" aria-label="Before and after">
          <div>
            <div className="small-title">Current plan</div>
            {rows(before)}
          </div>
          <div>
            <div className="small-title">New plan</div>
            {rows(after)}
          </div>
        </div>
      )}

      <div className="btn-row">
        <button className="btn btn--primary" onClick={apply} disabled={busy || !valid || (!targetChanged && !settingsChanged)}>
          {busy ? 'Applying…' : 'Apply from today'}
        </button>
      </div>
      {valid && !targetChanged && !settingsChanged && <p className="muted small">No changes yet.</p>}
      {msg && msg.ok && <p role="status" className="small">✅ {msg.ok}</p>}
      {msg && msg.err && <p role="alert" className="small text-danger">❌ {msg.err}</p>}
    </details>
  );
}