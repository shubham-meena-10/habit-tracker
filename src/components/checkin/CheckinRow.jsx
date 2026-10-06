import { useState } from 'react';
import { Link } from 'react-router';
import EntryEditor from '../calendar/EntryEditor';
import { noteText, valueText } from '../calendar/DayDetail';
import { TRACKING_TYPES as T } from '../../constants/trackingTypes';

export default function CheckinRow({ row, state, date, final, busy, onMark, onClear }) {
  const { habit, day, entries } = row;
  const [open, setOpen] = useState(false);
  const isBool = habit.trackingType === T.BOOLEAN;
  const isAbst = habit.trackingType === T.ABSTINENCE;
  const existing = entries[0] || null;
  const clean = Boolean(existing) && existing.delta >= 1;
  const slipped = Boolean(existing) && existing.delta === 0;

  const symbol = state === 'done' ? '✓' : state === 'bad' ? '✗' : final ? '✗' : '○';
  const label = state === 'done' ? 'Completed' : state === 'bad' ? 'Not completed' : 'Not done yet';

  let note = noteText(habit, day);
  if (!note && state === 'done' && day.status === 'pending') note = 'Within limit so far';
  if (!note && isAbst && !existing) note = 'Not checked in';

  return (
    <li className={`ci-row ci-row--${state}`}>
      <div className="ci-row__main">
        <span aria-hidden="true">{habit.icon}</span>
        <span className="ci-row__name">
          <Link to={`/habits/${habit.habitId}`}>{habit.name}</Link>
        </span>
        <span className="ci-row__value">{valueText(habit, day)}</span>
        <span className="ci-row__mark" aria-label={label}>{symbol}</span>
      </div>

      <div className="ci-row__sub">
        <span className="muted small">{note}</span>
        <div className="ci-actions">
          {isBool && (
            <button className={`btn ${clean ? 'btn--done' : 'btn--primary'}`} aria-pressed={clean} disabled={busy}
              onClick={() => (clean ? onClear(existing.entryId) : onMark(habit, 1))}>
              {clean ? '☑ Done' : '☐ Mark done'}
            </button>
          )}

          {isAbst && (
            <>
              <button className={`btn ${clean ? 'btn--done' : 'btn--primary'}`} aria-pressed={clean} disabled={busy}
                onClick={() => (clean ? onClear(existing.entryId) : onMark(habit, 1))}>
                {clean ? '☑ Clean' : '☐ Clean'}
              </button>
              {slipped ? (
                <button className="btn btn--small" disabled={busy} onClick={() => onClear(existing.entryId)}>Clear slip</button>
              ) : (
                !clean && <button className="btn btn--danger btn--small" disabled={busy} onClick={() => onMark(habit, 0)}>Slipped</button>
              )}
            </>
          )}

          {!isBool && !isAbst && (
            <button className="btn btn--small" aria-expanded={open} onClick={() => setOpen(!open)}>
              {open ? 'Close' : 'Edit'}
            </button>
          )}
        </div>
      </div>

      {open && !isBool && !isAbst && (
        <EntryEditor key={`${habit.habitId}-${date}`} habit={habit} date={date} day={day} entries={entries} />
      )}
    </li>
  );
}