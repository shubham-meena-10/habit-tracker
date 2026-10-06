import { elapsedMs, historyStats, newTimer, pauseTimer, resumeTimer, sessionSeconds, timerView } from './timer';
import { formatClock } from '../utils/format';

export function runTimerTests() {
  const results = [];
  const t = (name, got, want) => results.push({ name, got, want, pass: got === want });
  const S = 1000;
  const t0 = 1000000;
  const make = (extra) => newTimer({ habitId: 'p', date: '2026-10-05', targetSec: 30, loggedSec: 0, now: t0, ...extra });

  const tm = make();
  t('timer goal is the full target', tm.goalSec, 30);
  t('27 s in → 3 s left', timerView(tm, t0 + 27 * S).remainingSec, 3);
  t('26.5 s in rounds the countdown up', timerView(tm, t0 + 26500).remainingSec, 4);
  t('not met at 29 s', timerView(tm, t0 + 29 * S).targetMet, false);
  t('met at 30 s', timerView(tm, t0 + 30 * S).targetMet, true);
  t('45 s → extra 15', timerView(tm, t0 + 45 * S).extraSec, 15);

  const paused = pauseTimer(tm, t0 + 10 * S);
  t('paused timer keeps 10 s for an hour', elapsedMs(paused, t0 + 3600 * S), 10 * S);
  t('pausing twice changes nothing', pauseTimer(paused, t0 + 999 * S) === paused, true);
  const resumed = resumeTimer(paused, t0 + 100 * S);
  t('resume then +5 s = 15 s', elapsedMs(resumed, t0 + 105 * S), 15 * S);
  t('resuming a running timer changes nothing', resumeTimer(tm, t0 + 5 * S) === tm, true);

  const partial = make({ targetSec: 900, loggedSec: 600 });
  t('goal is what remains today', partial.goalSec, 300);
  t('extra counts time already logged', timerView(partial, t0 + 360 * S).extraSec, 60);

  const met = make({ loggedSec: 40 });
  t('already met: no countdown', met.goalSec, 0);
  t('already met: target met at start', timerView(met, t0).targetMet, true);
  t('already met: extra is 10', timerView(met, t0).extraSec, 10);

  t('clock moved backwards clamps to 0', elapsedMs(tm, t0 - 5 * S), 0);
  t('session clamps to 16 h', sessionSeconds(tm, t0 + 20 * 3600 * S), 16 * 3600);
  t('session rounds to nearest second', sessionSeconds(tm, t0 + 44600), 45);
  t('clock format mm:ss', formatClock(27), '00:27');
  t('clock format h:mm:ss', formatClock(3725), '1:02:05');

  const byDate = new Map([
    ['2026-10-02', { total: 60, count: 1 }],
    ['2026-10-04', { total: 45, count: 2 }],
    ['2026-10-05', { total: 99, count: 1 }],
  ]);
  const h = historyStats(byDate, '2026-10-05', '2026-10-04');
  t('yesterday total', h.yesterday, 45);
  t('best excludes today', h.best.total, 60);
  t('best date', h.best.date, '2026-10-02');
  t('no entries yesterday → null', historyStats(byDate, '2026-10-05', '2026-10-03').yesterday, null);
  return results;
}