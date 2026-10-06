import { useMemo } from 'react';
import { useAppState } from '../store/AppContext';
import { groupAnchors } from '../engine/progression';

/** Map(habitId -> sorted target anchors). Recomputed only when anchors change. */
export function useAnchorsByHabit() {
  const { targetChanges } = useAppState();
  return useMemo(() => groupAnchors(targetChanges), [targetChanges]);
}