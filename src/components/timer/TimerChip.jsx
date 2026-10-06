import { useNow } from '../../hooks/useNow';
import { elapsedMs } from '../../engine/timer';
import { formatClock } from '../../utils/format';

/** Live "03:12" (or "03:12 paused") for a running timer, used on Home cards. */
export default function TimerChip({ timer }) {
  const running = timer.status === 'running';
  const now = useNow(running, 1000);
  return <span>{formatClock(Math.floor(elapsedMs(timer, now) / 1000))}{running ? '' : ' paused'}</span>;
}