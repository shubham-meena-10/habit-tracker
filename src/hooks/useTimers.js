import { useEffect, useState } from 'react';
import { loadTimers, subscribeTimers } from '../db/timers';

/** { loaded, timers: Map(habitId -> timer) }, kept current across components and tabs. */
export function useTimers() {
  const [state, setState] = useState({ loaded: false, timers: new Map() });
  useEffect(() => {
    let alive = true;
    const refresh = () => {
      loadTimers()
        .then((timers) => { if (alive) setState({ loaded: true, timers }); })
        .catch(() => { if (alive) setState((s) => ({ ...s, loaded: true })); });
    };
    refresh();
    const unsubscribe = subscribeTimers(refresh);
    return () => { alive = false; unsubscribe(); };
  }, []);
  return state;
}