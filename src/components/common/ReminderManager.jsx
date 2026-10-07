import { useEffect, useState } from 'react';
import { useAppState } from '../../store/AppContext';
import { useDaily } from '../../hooks/useDaily';
import { dueReminders } from '../../engine/reminders';
import { claimKeys, deliverReminder, isRemindersOn } from '../../services/reminderService';

/** Mounted once in the layout, so reminders work on every page. Renders in-app banners when needed. */
export default function ReminderManager() {
  const { ready, settings, dayStatus, sync } = useAppState();
  const { today, minutes, data } = useDaily();
  const [on, setOn] = useState(false);
  const [banners, setBanners] = useState([]);
  const closed = dayStatus.some((d) => d.date === today && d.closed);

  useEffect(() => {
    let alive = true;
    const load = () => isRemindersOn().then((v) => { if (alive) setOn(v); }).catch(() => {});
    load();
    window.addEventListener('reminders-changed', load);
    return () => { alive = false; window.removeEventListener('reminders-changed', load); };
  }, []);

  useEffect(() => {
    const onBanner = (e) =>
      setBanners((list) => [...list.filter((b) => b.key !== e.detail.key), e.detail].slice(-3));
    window.addEventListener('app-reminder', onBanner);
    return () => window.removeEventListener('app-reminder', onBanner);
  }, []);

  useEffect(() => {
    // Wait for a sync in progress, so a habit completed on another device isn't reminded.
    if (!on || !ready || sync.phase === 'syncing') return;
    const due = dueReminders({ items: data.items, minutes, today, checkinTime: settings.checkinTime, closed });
    if (!due.length) return;
    claimKeys(today, due.map((d) => d.key)).then((fresh) => {
      due.filter((d) => fresh.includes(d.key)).forEach((d) => deliverReminder(d));
    });
  }, [on, ready, sync.phase, data.items, minutes, today, settings.checkinTime, closed]);

  if (!banners.length) return null;
  const dismiss = (key) => setBanners((list) => list.filter((b) => b.key !== key));
  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {banners.map((b) => (
        <div key={b.key} className="toast">
          <div className="toast__text">
            <strong>{b.title}</strong>
            {b.body && <div className="small">{b.body}</div>}
          </div>
          <a href={b.url || '#/'} onClick={() => dismiss(b.key)}>Open</a>
          <button className="btn btn--small" aria-label="Dismiss" onClick={() => dismiss(b.key)}>✕</button>
        </div>
      ))}
    </div>
  );
}