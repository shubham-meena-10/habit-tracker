import { useEffect, useState } from 'react';
import { nowMinutes, todayStr } from '../utils/date';

const read = () => ({ today: todayStr(), minutes: nowMinutes() });

/** { today, minutes } in the configured timezone. Re-renders only when the date or minute changes. */
export function useClock(intervalMs = 20000) {
  const [clock, setClock] = useState(read);

  useEffect(() => {
    const tick = () =>
      setClock((prev) => {
        const next = read();
        return next.today === prev.today && next.minutes === prev.minutes ? prev : next;
      });
    const onVisible = () => { if (document.visibilityState === 'visible') tick(); };
    const id = setInterval(tick, intervalMs);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', tick);
    tick();
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', tick);
    };
  }, [intervalMs]);

  return clock;
}