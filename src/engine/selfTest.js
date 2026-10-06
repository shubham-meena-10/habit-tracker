// Runs in the browser (Settings → Engine self-test). Mirrors Tests.gs on the server.
import { computeTarget, previewLevels } from "./progression";
import { calcDay, compareValues, isScheduledOn } from "./calculations";
import { runDailyTests } from "./dailySelfTest";
import { runTimerTests } from "./timerSelfTest";
import { runStatsTests } from "./statsSelfTest";
import { runPlanTests } from "./planSelfTest";
import { runHistoryTests } from "./historySelfTest";
import { runCalendarTests } from "./calendarSelfTest";
import { runCheckinTests } from "./checkinSelfTest";

export function runEngineTests() {
  const results = [];
  const t = (name, got, want) =>
    results.push({ name, got, want, pass: got === want });
  const anchor = (date, target, reason = "start") => ({
    effectiveDate: date,
    target,
    reason,
    createdAt: "",
  });
  const run = (h, a, d) => computeTarget(h, a, d);

  const base = {
    goalDirection: "INCREASE",
    progressionEnabled: true,
    progressionAmount: 5,
    progressionInterval: 14,
    progressionUnit: "days",
    endTarget: null,
    startDate: "2026-10-01",
    startingTarget: 5,
    minTarget: null,
    weekdays: [0, 1, 2, 3, 4, 5, 6],
  };

  // Pushups: 5, +5 every 14 days
  const a1 = [anchor("2026-10-01", 5)];
  t("pushups 5 Oct", run(base, a1, "2026-10-05").target, 5);
  t("pushups 14 Oct", run(base, a1, "2026-10-14").target, 5);
  t("pushups 15 Oct", run(base, a1, "2026-10-15").target, 10);
  t("pushups 29 Oct", run(base, a1, "2026-10-29").target, 15);
  t(
    "pushups days until increase",
    run(base, a1, "2026-10-05").daysUntilIncrease,
    10,
  );

  const levels = previewLevels(base, "2026-10-01", 5, 3);
  t("preview levels", levels.map((l) => l.target).join(","), "5,10,15");
  t("preview first range ends 14 Oct", levels[0].to, "2026-10-14");
  t("preview second range starts 15 Oct", levels[1].from, "2026-10-15");

  // Plank: 30 s, +10 s weekly
  const plank = {
    ...base,
    progressionAmount: 10,
    progressionInterval: 7,
    startingTarget: 30,
  };
  const a2 = [anchor("2026-10-01", 30)];
  t("plank week 1", run(plank, a2, "2026-10-07").target, 30);
  t("plank week 2", run(plank, a2, "2026-10-08").target, 40);
  t("plank week 4", run(plank, a2, "2026-10-22").target, 60);

  // Tea: 4 → 1, one cup per week
  const tea = {
    ...base,
    goalDirection: "DECREASE",
    progressionAmount: 1,
    progressionInterval: 7,
    endTarget: 1,
    startingTarget: 4,
    trackingType: "LIMIT",
  };
  const a3 = [anchor("2026-10-01", 4)];
  t("tea week 3", run(tea, a3, "2026-10-15").target, 2);
  t("tea floor", run(tea, a3, "2026-10-29").target, 1);
  t("tea capped flag", run(tea, a3, "2026-10-29").capped, true);

  // Pause / resume
  const a4 = [anchor("2026-10-01", 5), anchor("2026-10-15", 10, "pause")];
  t("paused is frozen", run(base, a4, "2026-11-30").target, 10);
  a4.push(anchor("2026-12-01", 10, "resume"));
  t("resume before interval", run(base, a4, "2026-12-14").target, 10);
  t("resume after interval", run(base, a4, "2026-12-15").target, 15);

  // Monthly steps with day clamping
  const monthly = {
    ...base,
    progressionAmount: 1,
    progressionInterval: 1,
    progressionUnit: "months",
    startingTarget: 1,
  };
  const a5 = [anchor("2026-01-31", 1)];
  t("monthly 27 Feb", run(monthly, a5, "2026-02-27").target, 1);
  t("monthly 28 Feb", run(monthly, a5, "2026-02-28").target, 2);
  t("monthly 31 Mar", run(monthly, a5, "2026-03-31").target, 3);

  // A manual target above the end target is never pulled backwards
  const capped = { ...base, endTarget: 20 };
  t(
    "manual target above cap kept",
    run(capped, [anchor("2026-10-01", 25, "manual")], "2026-10-30").target,
    25,
  );

  // Calculations
  const water = {
    trackingType: "QUANTITY",
    goalDirection: "INCREASE",
    minTarget: null,
  };
  const w = calcDay(water, 3000, 3800, 3);
  t("water 3.8/3 L → 127%", Math.round(w.percentage), 127);
  t("water extra 800 ml", w.extra, 800);
  t("water exceeded", w.state, "exceeded");

  const plankCalc = calcDay(
    { trackingType: "TIMER", goalDirection: "INCREASE", minTarget: null },
    30,
    45,
    1,
  );
  t("plank 45/30 → 150%", plankCalc.percentage, 150);
  t("plank extra 15", plankCalc.extra, 15);

  const work = calcDay(
    { trackingType: "TIMER", goalDirection: "INCREASE", minTarget: null },
    28800,
    27900,
    1,
  );
  t("work 7h45m → 96.9%", work.percentage, 96.9);
  t("work remaining 15 min", work.remaining, 900);
  t("work not complete", work.completed, false);

  const teaHabit = { trackingType: "LIMIT", goalDirection: "DECREASE" };
  const under = calcDay(teaHabit, 3, 2, 2);
  t("tea 2/3 within", under.state, "within");
  t("tea 2/3 → 100%", under.percentage, 100);
  t("tea 1 better than limit", under.better, 1);
  const over = calcDay(teaHabit, 3, 4, 4);
  t("tea 4/3 over by 1", over.over, 1);
  t("tea 4/3 → 75%", over.percentage, 75);
  t("tea 4/3 not complete", over.completed, false);

  const abst = { trackingType: "ABSTINENCE", goalDirection: "AVOID" };
  t("abstinence pending", calcDay(abst, 0, 0, 0).state, "pending");
  t("abstinence success", calcDay(abst, 0, 1, 1).state, "success");
  t("abstinence slip", calcDay(abst, 0, 0, 1).state, "slip");
  t(
    "boolean done",
    calcDay({ trackingType: "BOOLEAN", goalDirection: "INCREASE" }, 1, 1, 1)
      .completed,
    true,
  );

  const withMin = {
    trackingType: "COUNT",
    goalDirection: "INCREASE",
    minTarget: 6,
  };
  t("min target met → complete", calcDay(withMin, 10, 7, 1).completed, true);
  t("min target met → still 70%", calcDay(withMin, 10, 7, 1).percentage, 70);
  t("below min target → partial", calcDay(withMin, 10, 5, 1).state, "partial");

  t("compare tea 2 vs 3 is good", compareValues(teaHabit, 2, 3).good, true);
  t(
    "compare pushups 12 vs 10 is good",
    compareValues({ trackingType: "COUNT", goalDirection: "INCREASE" }, 12, 10)
      .diff,
    2,
  );

  const work5 = { startDate: "2026-10-01", weekdays: [1, 2, 3, 4, 5] };
  t("weekday habit not on Saturday", isScheduledOn(work5, "2026-10-10"), false);
  t("weekday habit on Monday", isScheduledOn(work5, "2026-10-12"), true);
  t(
    "not scheduled before start date",
    isScheduledOn(work5, "2026-09-30"),
    false,
  );

  return [
    ...results,
    ...runDailyTests(),
    ...runTimerTests(),
    ...runStatsTests(),
    ...runPlanTests(),
    ...runHistoryTests(),
    ...runCalendarTests(),
    ...runCheckinTests(),
  ];
}
