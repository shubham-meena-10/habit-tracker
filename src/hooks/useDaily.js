// import { useMemo } from 'react';
// import { useAppState } from '../store/AppContext';
// import { useAnchorsByHabit } from './useAnchors';
// import { useClock } from './useClock';
// import { buildDayTotals } from '../engine/calculations';
// import { buildDaily } from '../engine/daily';

// export function useDaily() {
//   const { habits, entries, dayStatus, settings } = useAppState();
//   const anchorsByHabit = useAnchorsByHabit();
//   const { today, minutes } = useClock();

//   const totals = useMemo(() => buildDayTotals(entries), [entries]);
//   const data = useMemo(
//     () => buildDaily({ habits, anchorsByHabit, totals, dayStatus, settings, today, minutes }),
//     [habits, anchorsByHabit, totals, dayStatus, settings, today, minutes]
//   );
//   return { today, minutes, data };
// }




import { useMemo } from 'react';
import { useAppState } from '../store/AppContext';
import { useAnchorsByHabit } from './useAnchors';
import { useClock } from './useClock';
import { buildDayTotals } from '../engine/calculations';
import { buildDaily } from '../engine/daily';
import { withWaterUnit } from '../utils/water';

export function useDaily() {
  const { habits, entries, dayStatus, settings } = useAppState();
  const anchorsByHabit = useAnchorsByHabit();
  const { today, minutes } = useClock();
  const waterUnit = settings.waterUnit;

  // Volume habits are shown in the chosen water unit. Only display fields change.
  const displayHabits = useMemo(() => habits.map((h) => withWaterUnit(h, waterUnit)), [habits, waterUnit]);
  const totals = useMemo(() => buildDayTotals(entries), [entries]);
  const data = useMemo(
    () => buildDaily({ habits: displayHabits, anchorsByHabit, totals, dayStatus, settings, today, minutes }),
    [displayHabits, anchorsByHabit, totals, dayStatus, settings, today, minutes]
  );
  return { today, minutes, data };
}