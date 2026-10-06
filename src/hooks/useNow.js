import { useEffect, useState } from 'react';

/** Date.now() that refreshes while `active`, and immediately when the tab becomes visible again. */
export function useNow(active, intervalMs = 250) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, intervalMs);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('focus', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('focus', tick);
    };
  }, [active, intervalMs]);
  return now;
}