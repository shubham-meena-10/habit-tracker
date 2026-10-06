import { useState } from 'react';
import { Link } from 'react-router';
import EntryEditor from './EntryEditor';
import { TRACKING_TYPES as T } from '../../constants/trackingTypes';
import { isCheckHabit, lowerIsBetter } from '../../engine/calculations';
import { dayTone } from '../../engine/calendar';
import { formatAmount, formatPair } from '../../utils/format';
import { formatLongDate } from '../../utils/date';

const MARK = {
  success: ['✓', 'Completed'],
  fail: ['✗', 'Not completed'],
  pending: ['…', 'In progress'],
  skip: ['–', 'Not scheduled'],
};

export function valueText(habit, day) {
  if (habit.trackingType === T.BOOLEAN) return day.actual >= 1 ? 'Done' : '—';
  if (habit.trackingType === T.ABSTINENCE) return day.state === 'success' ? 'Clean' : day.state === 'slip' ? 'Slipped' : '—';
  return formatPair(habit, day.actual, day.target);
}

export function noteText(habit, day) {
  if (habit.trackingType === T.ABSTINENCE) return day.state === 'slip' ? '' : day.status === 'fail' ? 'Not checked in' : '';
  if (habit.trackingType === T.BOOLEAN) return day.status === 'fail' ? 'Not completed' : '';
  const fa = (v) => formatAmount(habit, v);
  if (lowerIsBetter(habit)) {
    if (day.status === 'fail') return `${fa(day.actual - day.target)} over the limit`;
    if (day.status === 'success') return day.count === 0 ? 'Nothing logged · within limit' : 'Within limit';
    return '';
  }
  if (day.status === 'success') {
    if (day.extra > 0) return `+${fa(day.extra)} extra`;
    return day.percentage < 100 ? 'Minimum met' : '';
  }
  if (day.status === 'fail') return `${Math.round(day.percentage)}% of target`;
  return '';
}

export default function DayDetail({ date, detail, today, todayFinal, editable, lockedNote }) {
  const [openId, setOpenId] = useState(null);
  const live = date === today && !todayFinal;
  const tone = live ? 'none' : dayTone(detail.pct);

  let summary = 'Nothing scheduled';
  if (live) summary = detail.counted ? `In progress · ${detail.done}/${detail.counted} so far` : 'In progress';
  else if (detail.counted) summary = `${detail.done} of ${detail.counted} completed · ${Math.round(detail.pct)}%`;

  return (
    <section className="card day-detail" aria-label={formatLongDate(date)}>
      <div className="day-detail__head">
        <h2>{formatLongDate(date)}</h2>
        <span className={`day-pill day-pill--${tone}`}>{summary}</span>
      </div>

      {detail.rows.length === 0 ? (
        <p className="muted">No habits were scheduled on this day.</p>
      ) : (
        <ul className="day-list">
          {detail.rows.map(({ habit, day, entries }) => {
            const [symbol, text] = MARK[day.status];
            const note = noteText(habit, day);
            const open = openId === habit.habitId;
            return (
              <li key={habit.habitId} className={`day-row day-row--${day.status}`}>
                <div className="day-row__main">
                  <span aria-hidden="true">{habit.icon}</span>
                  <span className="day-row__name">
                    <Link to={`/habits/${habit.habitId}`}>{habit.name}</Link>
                    {habit.status === 'archived' && <span className="tag">Archived</span>}
                  </span>
                  <span className="day-row__value">{valueText(habit, day)}</span>
                  <span className="day-row__mark" aria-label={text}>{symbol}</span>
                </div>
                <div className="day-row__sub">
                  <span className="muted small">{note}</span>
                  {editable && (
                    <button className="btn btn--small" aria-expanded={open}
                      onClick={() => setOpenId(open ? null : habit.habitId)}>
                      {open ? 'Close' : isCheckHabit(habit) ? 'Change' : 'Edit'}
                    </button>
                  )}
                </div>
                {open && (
                  <EntryEditor key={`${habit.habitId}-${date}`} habit={habit} date={date} day={day} entries={entries} />
                )}
              </li>
            );
          })}
        </ul>
      )}

      {detail.hidden > 0 && (
        <p className="muted small">{detail.hidden} habit{detail.hidden === 1 ? '' : 's'} not scheduled on this day.</p>
      )}
      {!editable && lockedNote && <p className="muted small">{lockedNote}</p>}
    </section>
  );
}