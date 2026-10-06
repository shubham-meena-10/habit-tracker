// =====================================================================
// TESTS.GS — run from the editor. Test data is created, then removed.
// =====================================================================
const TEST_HABIT_NAME_ = "__API_TEST__";

function testProgression() {
  const check = (label, got, want) => {
    if (got !== want)
      throw new Error(
        "FAILED " + label + ": got " + got + ", expected " + want,
      );
    Logger.log("✓ " + label + " → " + got);
  };
  const run = (habit, anchors, date) => computeTarget_(habit, anchors, date);

  // Your example: start 1 Oct, 5 reps, +5 every 14 days
  const push = {
    goalDirection: "INCREASE",
    progressionEnabled: true,
    progressionAmount: 5,
    progressionInterval: 14,
    progressionUnit: "days",
    endTarget: null,
    startDate: "2026-10-01",
    startingTarget: 5,
  };
  const a1 = [
    { effectiveDate: "2026-10-01", target: 5, reason: "start", createdAt: "" },
  ];
  check("pushups 5 Oct", run(push, a1, "2026-10-05").target, 5);
  check("pushups 14 Oct", run(push, a1, "2026-10-14").target, 5);
  check("pushups 15 Oct", run(push, a1, "2026-10-15").target, 10);
  check("pushups 29 Oct", run(push, a1, "2026-10-29").target, 15);
  check(
    "pushups days until increase (5 Oct)",
    run(push, a1, "2026-10-05").daysUntilIncrease,
    10,
  );

  // Plank: 30s, +10s every 7 days
  const plank = Object.assign({}, push, {
    progressionAmount: 10,
    progressionInterval: 7,
    startingTarget: 30,
  });
  const a2 = [
    { effectiveDate: "2026-10-01", target: 30, reason: "start", createdAt: "" },
  ];
  check("plank week 1", run(plank, a2, "2026-10-07").target, 30);
  check("plank week 2", run(plank, a2, "2026-10-08").target, 40);
  check("plank week 4", run(plank, a2, "2026-10-22").target, 60);

  // Tea: decrease 4 → 1, one cup per week, floor at 1
  const tea = Object.assign({}, push, {
    goalDirection: "DECREASE",
    progressionAmount: 1,
    progressionInterval: 7,
    endTarget: 1,
    startingTarget: 4,
  });
  const a3 = [
    { effectiveDate: "2026-10-01", target: 4, reason: "start", createdAt: "" },
  ];
  check("tea week 1", run(tea, a3, "2026-10-01").target, 4);
  check("tea week 3", run(tea, a3, "2026-10-15").target, 2);
  check("tea floor reached", run(tea, a3, "2026-10-29").target, 1);
  check("tea capped flag", run(tea, a3, "2026-10-29").capped, true);

  // Pause freezes progression; resume restarts the clock
  const a4 = [
    { effectiveDate: "2026-10-01", target: 5, reason: "start", createdAt: "" },
    { effectiveDate: "2026-10-15", target: 10, reason: "pause", createdAt: "" },
  ];
  check("paused stays frozen", run(push, a4, "2026-11-30").target, 10);
  a4.push({
    effectiveDate: "2026-12-01",
    target: 10,
    reason: "resume",
    createdAt: "",
  });
  check(
    "after resume, before interval",
    run(push, a4, "2026-12-14").target,
    10,
  );
  check("after resume, one interval", run(push, a4, "2026-12-15").target, 15);

  // Monthly steps with day clamping (Jan 31 + 1 month = Feb 28)
  const monthly = Object.assign({}, push, {
    progressionAmount: 1,
    progressionInterval: 1,
    progressionUnit: "months",
    startingTarget: 1,
  });
  const a5 = [
    { effectiveDate: "2026-01-31", target: 1, reason: "start", createdAt: "" },
  ];
  check("monthly 27 Feb", run(monthly, a5, "2026-02-27").target, 1);
  check("monthly 28 Feb", run(monthly, a5, "2026-02-28").target, 2);
  check("monthly 30 Mar", run(monthly, a5, "2026-03-30").target, 2);
  check("monthly 31 Mar", run(monthly, a5, "2026-03-31").target, 3);

  Logger.log("ALL PROGRESSION TESTS PASSED");
}

function testPlanSnapshots() {
  const check = (label, got, want) => {
    if (got !== want)
      throw new Error(
        "FAILED " + label + ": got " + got + ", expected " + want,
      );
    Logger.log("✓ " + label + " → " + got);
  };
  const habit7 = {
    goalDirection: "INCREASE",
    progressionEnabled: true,
    progressionAmount: 5,
    progressionInterval: 7,
    progressionUnit: "days",
    endTarget: null,
    startDate: "2026-10-01",
    startingTarget: 5,
  };
  const plan14 = {
    enabled: true,
    amount: 5,
    interval: 14,
    unit: "days",
    end: null,
    direction: "INCREASE",
  };
  const anchors = [
    {
      effectiveDate: "2026-10-01",
      target: 5,
      reason: "start",
      createdAt: "",
      plan: plan14,
    },
    {
      effectiveDate: "2026-10-20",
      target: 10,
      reason: "manual",
      createdAt: "1",
      plan: planOf_(habit7),
    },
  ];
  check(
    "past day keeps the old 14-day plan",
    computeTarget_(habit7, anchors, "2026-10-19").target,
    10,
  );
  check(
    "new plan: 6 days in, no step yet",
    computeTarget_(habit7, anchors, "2026-10-26").target,
    10,
  );
  check(
    "new plan: 7 days in, one step",
    computeTarget_(habit7, anchors, "2026-10-27").target,
    15,
  );
  check(
    "legacy anchor falls back to current settings",
    computeTarget_(
      habit7,
      [
        {
          effectiveDate: "2026-10-01",
          target: 5,
          reason: "start",
          createdAt: "",
        },
      ],
      "2026-10-19",
    ).target,
    15,
  );
  check(
    "plan with progression off is frozen",
    computeTarget_(
      habit7,
      [
        {
          effectiveDate: "2026-10-01",
          target: 5,
          reason: "start",
          createdAt: "",
          plan: Object.assign({}, plan14, { enabled: false }),
        },
      ],
      "2026-12-01",
    ).target,
    5,
  );
  Logger.log("ALL PLAN TESTS PASSED");
}

function testApi() {
  const token =
    PropertiesService.getScriptProperties().getProperty("API_TOKEN");
  if (!token)
    throw new Error("No API token yet. Run generateApiToken() first.");
  const today = today_();

  const call = (action, data, extra, method) => {
    const res = handleRequest_(
      Object.assign(
        { token: token, action: action, data: data || {} },
        extra || {},
      ),
      method || "POST",
    );
    Logger.log(
      "%s → %s",
      action,
      res.ok
        ? "OK"
        : "ERROR " +
            res.status +
            " " +
            res.error.code +
            ": " +
            res.error.message,
    );
    return res;
  };
  const check = (cond, msg) => {
    if (!cond) throw new Error("TEST FAILED: " + msg);
    Logger.log("   ✓ " + msg);
  };

  try {
    check(
      handleRequest_({ token: "wrong", action: "ping" }, "POST").status === 401,
      "wrong token is rejected (401)",
    );
    const ping = call("ping");
    check(
      ping.ok && ping.data.schemaOk,
      "ping works and sheet headers match the schema",
    );
    check(call("nope").status === 404, "unknown action returns 404");
    check(
      handleRequest_({ token: token, action: "saveHabit", data: {} }, "GET")
        .status === 405,
      "writes are blocked over GET (405)",
    );

    const boot = call("bootstrap");
    check(
      boot.ok &&
        boot.data.habits.length >= 1 &&
        boot.data.categories.length >= 1,
      "bootstrap returns habits and categories",
    );
    const since = boot.data.serverTime;

    const created = call("saveHabit", {
      habit: {
        name: TEST_HABIT_NAME_,
        trackingType: "COUNT",
        goalDirection: "INCREASE",
        unit: "reps",
        startingTarget: 5,
        progressionEnabled: true,
        progressionAmount: 5,
        progressionInterval: 14,
        progressionUnit: "days",
      },
    });
    check(
      created.ok &&
        created.data.created &&
        created.data.targetChanges.length === 1,
      "habit created with a start anchor",
    );
    const id = created.data.habit.habitId;
    check(
      call("saveHabit", {
        habit: {
          name: TEST_HABIT_NAME_.toLowerCase(),
          trackingType: "COUNT",
          startingTarget: 1,
        },
      }).status === 409,
      "duplicate habit name rejected (409)",
    );

    const e1 = {
      entryId: "test_" + id + "_a",
      habitId: id,
      date: today,
      delta: 5,
      source: "tap",
    };
    check(
      call("addEntries", { entries: [e1] }).data.results[0].status ===
        "created",
      "entry created",
    );
    check(
      call("addEntries", { entries: [e1] }).data.results[0].status ===
        "duplicate",
      "same entryId again is a no-op (idempotent)",
    );

    const e2 = Object.assign({}, e1, {
      entryId: "test_" + id + "_b",
      delta: 3,
    });
    const mixed = call("addEntries", {
      entries: [e2, { entryId: "bad id!", habitId: id, date: today, delta: 1 }],
    });
    check(
      mixed.data.counts.created === 1 && mixed.data.counts.error === 1,
      "one bad entry does not block the good one",
    );

    check(
      call("getTotals", { from: today, to: today }).data.habits[id].total === 8,
      "totals sum all deltas (5 + 3)",
    );
    check(
      call("deleteEntry", { entryId: e2.entryId }).data.status === "deleted",
      "entry soft-deleted",
    );
    check(
      call("getTotals", { from: today, to: today }).data.habits[id].total === 5,
      "deleted entries are excluded from totals",
    );
    check(
      call("getEntries", { from: today, to: today, habitId: id }).data.count ===
        1,
      "getEntries filters by habit and ignores deleted",
    );

    const rid = "test_req_" + id;
    const e3 = Object.assign({}, e1, {
      entryId: "test_" + id + "_c",
      delta: 2,
    });
    const first = call("addEntries", { entries: [e3] }, { requestId: rid });
    const second = call("addEntries", { entries: [e3] }, { requestId: rid });
    check(
      first.data.results[0].status === "created" && second.replayed === true,
      "same requestId is replayed from cache",
    );

    const p1 = call("getProgression", { habitId: id }).data.progression[0];
    check(
      p1.target === 5 && p1.nextTarget === 10,
      "progression: 5 now, next target 10",
    );
    check(
      call("setTarget", { habitId: id, reason: "manual", target: 12 }).data
        .progression.target === 12,
      "manual target applied",
    );

    const paused = call("setHabitStatus", { habitId: id, status: "paused" });
    check(
      paused.data.habit.status === "paused" &&
        paused.data.targetChanges[0].reason === "pause",
      "pausing writes a pause anchor",
    );
    check(
      call("setTarget", {
        habitId: id,
        effectiveDate: addDays_(today, -5),
        target: 1,
      }).status === 409,
      "target history is append-only (409)",
    );
    const resumed = call("setHabitStatus", { habitId: id, status: "active" });
    check(
      resumed.data.targetChanges[0].reason === "resume" &&
        resumed.data.targetChanges[0].target === 12,
      "resuming re-anchors at the frozen target",
    );

    const edited = call("saveHabit", {
      habit: { habitId: id, name: TEST_HABIT_NAME_, progressionInterval: 7 },
    });
    check(
      edited.ok && edited.data.targetChanges.length === 1,
      "changing progression settings re-anchors history",
    );
    check(
      edited.data.targetChanges[0].plan &&
        edited.data.targetChanges[0].plan.interval === 7,
      "the new anchor carries the new plan",
    );

    check(
      call("closeDay", { date: "2000-01-01", notes: "api test" }).data.dayStatus
        .closed === true,
      "closeDay stores a closed day",
    );
    check(
      call("saveSettings", { settings: { testKey: "x" } }).data.settings
        .testKey === "x",
      "saveSettings upserts",
    );

    const pull = call("pull", { since: since });
    check(
      pull.data.habits.some((h) => h.habitId === id) &&
        pull.data.entries.length >= 1,
      "pull returns changes since a timestamp",
    );
    const ex = call("exportAll");
    check(
      ex.ok && ex.data.tables.entries.length >= 1,
      "exportAll returns every table",
    );

    Logger.log("ALL API TESTS PASSED");
  } finally {
    cleanupTestData();
    Logger.log("Test data removed.");
  }
}

/** Removes only rows created by testApi() (habit named __API_TEST__, DayStatus 2000-01-01, key testKey). */
function cleanupTestData() {
  const lock = LockService.getScriptLock();
  lock.waitLock(CONFIG.LOCK_WAIT_MS);
  try {
    const ids = Object.create(null);
    readTable_(SHEETS.HABITS)
      .filter((r) => r.name === TEST_HABIT_NAME_)
      .forEach((r) => {
        ids[String(r.habitId)] = true;
      });
    deleteRowsWhere_(SHEETS.ENTRIES, (r) => ids[String(r.habitId)] === true);
    deleteRowsWhere_(SHEETS.TARGETS, (r) => ids[String(r.habitId)] === true);
    deleteRowsWhere_(SHEETS.HABITS, (r) => r.name === TEST_HABIT_NAME_);
    deleteRowsWhere_(SHEETS.DAYS, (r) => r.date === "2000-01-01");
    deleteRowsWhere_(SHEETS.SETTINGS, (r) => r.key === "testKey");
  } finally {
    lock.releaseLock();
  }
}
