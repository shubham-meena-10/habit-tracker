import { useMemo } from 'react';
import { useAppState } from '../store/AppContext';
import { useAnchorsByHabit } from './useAnchors';
import { useClock } from './useClock';
import { isDayFinal } from '../engine/daily';
import { withWaterUnit } from '../utils/water';

/** Everything the statistics screens share: today, whether it is final, display habits, anchors. */
export function useStatsContext() {
  const { habits, categories, dayStatus, settings } = useAppState();
  const anchorsByHabit = useAnchorsByHabit();
  const { today, minutes } = useClock();

  const closed = dayStatus.some((d) => d.date === today && d.closed);
  const todayFinal = isDayFinal({ date: today, today, minutes, closeTime: settings.dayCloseTime, closed });
  const displayHabits = useMemo(
    () => habits.map((h) => withWaterUnit(h, settings.waterUnit)),
    [habits, settings.waterUnit]
  );
  const weekStartsOn = Number(settings.weekStartsOn ?? 1) === 0 ? 0 : 1;

  return { today, todayFinal, habits: displayHabits, categories, anchorsByHabit, weekStartsOn };
}