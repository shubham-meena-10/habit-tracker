import { useMemo, useState } from 'react';
import Field from '../common/Field';
import { TRACKING_TYPES as T, GOAL_DIRECTIONS as D } from '../../constants/trackingTypes';
import { allowedPresets, defaultPresetKey, presetByKey } from '../../constants/units';
import {
  NEW_CATEGORY, WEEKDAY_ORDER, WEEKDAY_LABELS, isCheckKind, directionOptions, defaultDirection,
  resolveUnit, showsMinTarget, validateForm, previewFromForm,
} from '../../utils/habitForm';
import { formatAmount } from '../../utils/format';
import { formatShortDate } from '../../utils/date';

const TYPE_OPTIONS = [
  [T.BOOLEAN, 'Yes / No', 'Did it or not (e.g. Yoga)'],
  [T.COUNT, 'Count', 'Reps, pages… (e.g. Pushups)'],
  [T.TIMER, 'Timer', 'Timed, with a built-in timer (e.g. Plank)'],
  [T.DURATION, 'Duration', 'Time you enter yourself'],
  [T.QUANTITY, 'Quantity', 'A measured amount (e.g. Water)'],
  [T.LIMIT, 'Limit', 'Stay at or under a cap (e.g. Tea)'],
  [T.ABSTINENCE, 'Quit / Avoid', 'One-tap daily clean check-in'],
];
const DIRECTION_LABELS = {
  INCREASE: 'Increase (higher is better)', DECREASE: 'Decrease (lower is better)',
  MAINTAIN: 'Maintain', AVOID: 'Avoid (zero is the goal)',
};
const ICONS = ['💪', '🏃', '🧘', '💧', '📖', '📚', '💼', '🍵', '☀️', '🚶', '🛡️', '😴', '🧠', '🍎', '🚿', '💻'];

export default function HabitForm({ initial, isNew, categories, currentTarget, submitting, serverError, onSubmit, onCancel }) {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const type = form.trackingType;
  const check = isCheckKind(type);
  const preset = presetByKey(form.unitKey);
  const unitInfo = resolveUnit(form);
  const unitLabel = preset.custom ? (form.customUnit.trim() || 'units') : preset.label;
  const draft = { trackingType: type, unit: unitInfo.unit, unitFactor: unitInfo.factor };

  const visibleCategories = categories
    .filter((c) => c.active || c.categoryId === form.categoryId)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const preview = useMemo(
    () => previewFromForm(form, { isNew, currentTarget }),
    [form, isNew, currentTarget]
  );

  function changeType(next) {
    setForm((f) => ({
      ...f,
      trackingType: next,
      goalDirection: defaultDirection(next),
      unitKey: defaultPresetKey(next),
      progressionEnabled: isCheckKind(next) ? false : f.progressionEnabled,
    }));
  }

  const toggleDay = (d) =>
    set({
      weekdays: form.weekdays.includes(d)
        ? form.weekdays.filter((x) => x !== d)
        : [...form.weekdays, d].sort((a, b) => a - b),
    });

  function submit(e) {
    e.preventDefault();
    const errs = validateForm(form, { isNew, currentTarget });
    setErrors(errs);
    if (Object.keys(errs).length) {
      setTimeout(() => {
        const el = document.querySelector('[aria-invalid="true"]');
        if (el) el.focus();
      }, 0);
      return;
    }
    onSubmit(form);
  }

  const inv = (k) => Boolean(errors[k]);

  return (
    <form className="habit-form" onSubmit={submit} noValidate>
      {/* ---------- Basics ---------- */}
      <section className="card">
        <h2>Basics</h2>
        <Field label="Name" htmlFor="hf-name" error={errors.name}>
          <input id="hf-name" className="input" value={form.name} maxLength={60}
            aria-invalid={inv('name')} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Cold shower" />
        </Field>

        <Field label="Icon" htmlFor="hf-icon">
          <input id="hf-icon" className="input input--icon" value={form.icon} maxLength={8}
            onChange={(e) => set({ icon: e.target.value })} />
          <div className="chip-row" role="group" aria-label="Suggested icons">
            {ICONS.map((i) => (
              <button type="button" key={i} className={`chip chip--icon${form.icon === i ? ' chip--on' : ''}`}
                aria-label={`Use icon ${i}`} onClick={() => set({ icon: i })}>{i}</button>
            ))}
          </div>
        </Field>

        <Field label="Category" htmlFor="hf-cat">
          <select id="hf-cat" className="input" value={form.categoryId} onChange={(e) => set({ categoryId: e.target.value })}>
            {visibleCategories.map((c) => (<option key={c.categoryId} value={c.categoryId}>{c.icon} {c.name}</option>))}
            <option value={NEW_CATEGORY}>+ New category…</option>
          </select>
        </Field>
        {form.categoryId === NEW_CATEGORY && (
          <div className="form-row">
            <Field label="Category name" htmlFor="hf-newcat" error={errors.newCategoryName}>
              <input id="hf-newcat" className="input" value={form.newCategoryName} maxLength={40}
                aria-invalid={inv('newCategoryName')} onChange={(e) => set({ newCategoryName: e.target.value })} />
            </Field>
            <Field label="Icon" htmlFor="hf-newcaticon">
              <input id="hf-newcaticon" className="input input--icon" value={form.newCategoryIcon} maxLength={8}
                onChange={(e) => set({ newCategoryIcon: e.target.value })} />
            </Field>
          </div>
        )}

        <Field label="Description (optional)" htmlFor="hf-desc">
          <input id="hf-desc" className="input" value={form.description} maxLength={300}
            onChange={(e) => set({ description: e.target.value })} />
        </Field>
      </section>

      {/* ---------- Tracking ---------- */}
      <section className="card">
        <h2>Tracking</h2>
        <Field label="Tracking type" htmlFor="hf-type"
          hint={isNew ? (TYPE_OPTIONS.find((o) => o[0] === type) || [])[2] : 'The tracking type cannot change after creation. Create a new habit instead.'}>
          <select id="hf-type" className="input" value={type} disabled={!isNew} onChange={(e) => changeType(e.target.value)}>
            {TYPE_OPTIONS.map(([value, label]) => (<option key={value} value={value}>{label}</option>))}
          </select>
        </Field>

        {!check && (
          <>
            <Field label="Goal direction" htmlFor="hf-dir" error={errors.goalDirection}>
              <select id="hf-dir" className="input" value={form.goalDirection} aria-invalid={inv('goalDirection')}
                onChange={(e) => set({ goalDirection: e.target.value })}>
                {directionOptions(type).map((d) => (<option key={d} value={d}>{DIRECTION_LABELS[d]}</option>))}
              </select>
            </Field>

            <div className="form-row">
              <Field label="Unit" htmlFor="hf-unit"
                hint={isNew ? undefined : 'Locked after creation.'}>
                <select id="hf-unit" className="input" value={form.unitKey} disabled={!isNew}
                  onChange={(e) => set({ unitKey: e.target.value })}>
                  {allowedPresets(type).map((p) => (<option key={p.key} value={p.key}>{p.label}</option>))}
                </select>
              </Field>
              {preset.custom && (
                <Field label="Unit name" htmlFor="hf-custom" error={errors.customUnit}>
                  <input id="hf-custom" className="input" value={form.customUnit} maxLength={20}
                    aria-invalid={inv('customUnit')} onChange={(e) => set({ customUnit: e.target.value })} placeholder="e.g. rotis" />
                </Field>
              )}
            </div>

            {isNew ? (
              <Field label={`Daily ${type === T.LIMIT ? 'limit' : 'target'} (${unitLabel})`} htmlFor="hf-target" error={errors.target}>
                <input id="hf-target" className="input" inputMode="decimal" value={form.target}
                  aria-invalid={inv('target')} onChange={(e) => set({ target: e.target.value })} />
              </Field>
            ) : (
              <p className="muted small">
                Current target: <strong>{formatAmount(draft, currentTarget)}</strong>. Change it in &quot;Target &amp; status&quot; above.
              </p>
            )}

            {showsMinTarget(form) && (
              <Field label={`Minimum target (${unitLabel}, optional)`} htmlFor="hf-min" error={errors.minTarget}
                hint="The least that still counts as done on a bad day. The percentage is still measured against the full target.">
                <input id="hf-min" className="input" inputMode="decimal" value={form.minTarget}
                  aria-invalid={inv('minTarget')} onChange={(e) => set({ minTarget: e.target.value })} />
              </Field>
            )}

            <Field label={`One-tap buttons (${unitLabel}, optional)`} htmlFor="hf-quick" error={errors.quickAdds}
              hint="Comma-separated, e.g. 1, 5, 10. Use a negative number for an undo button (-1). Leave blank for defaults.">
              <input id="hf-quick" className="input" value={form.quickAdds} aria-invalid={inv('quickAdds')}
                onChange={(e) => set({ quickAdds: e.target.value })} placeholder={unitInfo.factor === 1000 ? '0.25, 0.5, 1' : '1, 5, 10'} />
            </Field>
          </>
        )}
      </section>

      {/* ---------- Progression ---------- */}
      {!check && (
        <section className="card">
          <h2>Progression</h2>
          <label className="check">
            <input type="checkbox" checked={form.progressionEnabled}
              onChange={(e) => set({ progressionEnabled: e.target.checked })} />
            <span>Change the target automatically over time</span>
          </label>

          {form.progressionEnabled && (
            <>
              <div className="form-row">
                <Field label={`${form.goalDirection === D.DECREASE ? 'Decrease' : 'Increase'} by (${unitLabel})`}
                  htmlFor="hf-pamount" error={errors.progressionAmount}>
                  <input id="hf-pamount" className="input" inputMode="decimal" value={form.progressionAmount}
                    aria-invalid={inv('progressionAmount')} onChange={(e) => set({ progressionAmount: e.target.value })} />
                </Field>
                <Field label="Every" htmlFor="hf-pint" error={errors.progressionInterval}>
                  <input id="hf-pint" className="input" inputMode="numeric" value={form.progressionInterval}
                    aria-invalid={inv('progressionInterval')} onChange={(e) => set({ progressionInterval: e.target.value })} />
                </Field>
                <Field label="Unit" htmlFor="hf-punit">
                  <select id="hf-punit" className="input" value={form.progressionUnit}
                    onChange={(e) => set({ progressionUnit: e.target.value })}>
                    <option value="days">days</option>
                    <option value="weeks">weeks</option>
                    <option value="months">months</option>
                  </select>
                </Field>
              </div>

              <Field label={`Final target (${unitLabel}, optional)`} htmlFor="hf-end" error={errors.endTarget}
                hint={form.goalDirection === D.DECREASE ? 'Progression stops at this floor.' : 'Progression stops at this cap.'}>
                <input id="hf-end" className="input" inputMode="decimal" value={form.endTarget}
                  aria-invalid={inv('endTarget')} onChange={(e) => set({ endTarget: e.target.value })} />
              </Field>

              {preview && (
                <div className="preview" aria-label="Progression preview">
                  <div className="small-title">Preview{isNew ? '' : ' (from today)'}</div>
                  <ul className="plain-list">
                    {preview.map((l) => (
                      <li key={l.from} className="small">
                        {formatShortDate(l.from)}{l.to ? ` – ${formatShortDate(l.to)}` : ' onwards'}
                        {' → '}<strong>{formatAmount(draft, l.target)}</strong>
                      </li>
                    ))}
                  </ul>
                  {!isNew && <p className="muted small">Saving re-anchors progression at today&apos;s target. Past days keep their old targets.</p>}
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* ---------- Schedule ---------- */}
      <section className="card">
        <h2>Schedule</h2>
        <Field label="Days" error={errors.weekdays}>
          <div className="chip-row" role="group" aria-label="Active weekdays">
            {WEEKDAY_ORDER.map((d) => (
              <button type="button" key={d} aria-pressed={form.weekdays.includes(d)}
                className={`chip${form.weekdays.includes(d) ? ' chip--on' : ''}`} onClick={() => toggleDay(d)}>
                {WEEKDAY_LABELS[d]}
              </button>
            ))}
          </div>
          <div className="btn-row">
            <button type="button" className="btn btn--small" onClick={() => set({ weekdays: [0, 1, 2, 3, 4, 5, 6] })}>Every day</button>
            <button type="button" className="btn btn--small" onClick={() => set({ weekdays: [1, 2, 3, 4, 5] })}>Weekdays</button>
          </div>
        </Field>

        <div className="form-row">
          <Field label="Time (optional)" htmlFor="hf-time">
            <input id="hf-time" type="time" className="input" value={form.scheduleTime}
              onChange={(e) => set({ scheduleTime: e.target.value })} />
          </Field>
          <Field label="Reminder (optional)" htmlFor="hf-rem">
            <input id="hf-rem" type="time" className="input" value={form.reminderTime}
              onChange={(e) => set({ reminderTime: e.target.value })} />
          </Field>
        </div>

        <Field label="Start date" htmlFor="hf-start" hint={isNew ? 'Progression and "missed days" count from here.' : 'Locked after creation.'}>
          <input id="hf-start" type="date" className="input" value={form.startDate} disabled={!isNew}
            onChange={(e) => set({ startDate: e.target.value })} />
        </Field>
      </section>

      {serverError && <p className="text-danger" role="alert">{serverError}</p>}
      <div className="btn-row">
        <button type="submit" className="btn btn--primary" disabled={submitting}>
          {submitting ? 'Saving…' : isNew ? 'Create habit' : 'Save changes'}
        </button>
        <button type="button" className="btn" onClick={onCancel} disabled={submitting}>Cancel</button>
      </div>
    </form>
  );
}