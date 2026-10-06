// =====================================================================
// SETUP.GS — builds the Google Sheet database. Safe to re-run.
// Phase 3 reuses SCHEMA from this file, so keep it in the project.
// =====================================================================

const SETUP_TIMEZONE = 'Asia/Kolkata';

// ---------- SCHEMA (single source of truth for column order) ----------
const SCHEMA = {
  Settings: {
    headers: ['key', 'value', 'updatedAt'],
    text: ['key', 'value', 'updatedAt'],
  },
  Categories: {
    headers: ['categoryId', 'name', 'icon', 'sortOrder', 'active'],
    text: ['categoryId', 'name', 'icon'],
  },
  Habits: {
    headers: [
      'habitId', 'name', 'icon', 'categoryId', 'description',
      'trackingType', 'goalDirection', 'unit', 'unitFactor',
      'startingTarget', 'minTarget', 'endTarget', 'startDate',
      'weekdays', 'scheduleTime', 'reminderTime',
      'progressionEnabled', 'progressionAmount', 'progressionInterval', 'progressionUnit',
      'quickAdds', 'status', 'sortOrder', 'createdAt', 'updatedAt',
    ],
    text: [
      'habitId', 'name', 'icon', 'categoryId', 'description', 'trackingType',
      'goalDirection', 'unit', 'startDate', 'weekdays', 'scheduleTime',
      'reminderTime', 'progressionUnit', 'quickAdds', 'status', 'createdAt', 'updatedAt',
    ],
  },
  TargetChanges: {
    headers: ['changeId', 'habitId', 'effectiveDate', 'target', 'reason', 'createdAt', 'plan'],
    text: ['changeId', 'habitId', 'effectiveDate', 'reason', 'createdAt', 'plan'],
  },
  Entries: {
    headers: [
      'entryId', 'habitId', 'date', 'delta', 'source', 'durationSec',
      'note', 'deleted', 'createdAt', 'deviceId', 'updatedAt',
    ],
    text: ['entryId', 'habitId', 'date', 'source', 'note', 'createdAt', 'deviceId', 'updatedAt'],
  },
  DayStatus: {
    headers: ['date', 'closed', 'closedAt', 'notes', 'updatedAt'],
    text: ['date', 'closedAt', 'notes', 'updatedAt'],
  },
};

// ---------- ENTRY POINT ----------
function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setSpreadsheetTimeZone(SETUP_TIMEZONE);

  Object.keys(SCHEMA).forEach((name) => ensureSheet_(ss, name, SCHEMA[name]));

  const today = Utilities.formatDate(new Date(), SETUP_TIMEZONE, 'yyyy-MM-dd');
  const nowIso = new Date().toISOString();
  seedCategories_(ss);
  seedSettings_(ss, nowIso);
  seedHabits_(ss, today, nowIso);

  applyValidation_(ss);
  setupAnalytics_(ss);

  const blank = ss.getSheetByName('Sheet1');
  if (blank && blank.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(blank);

  SpreadsheetApp.flush();
  Logger.log('Database ready. Habits seeded: ' + (ss.getSheetByName('Habits').getLastRow() - 1));
}

// ---------- SHEET CREATION ----------
function ensureSheet_(ss, name, def) {
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  const n = def.headers.length;
  if (sh.getMaxColumns() < n) sh.insertColumnsAfter(sh.getMaxColumns(), n - sh.getMaxColumns());

  // Plain-text format BEFORE any data is written, so '2026-10-05' and '07:30'
  // stay strings and are never auto-converted into Date objects.
  def.text.forEach((h) => {
    const c = def.headers.indexOf(h) + 1;
    sh.getRange(2, c, Math.max(1, sh.getMaxRows() - 1), 1).setNumberFormat('@');
  });

  sh.getRange(1, 1, 1, n)
    .setValues([def.headers])
    .setFontWeight('bold')
    .setBackground('#0f766e')
    .setFontColor('#ffffff');
  sh.setFrozenRows(1);
  return sh;
}

// ---------- SEED DATA (ordinary records, nothing hardcoded in app logic) ----------
function newId_(prefix) {
  return prefix + '_' + Utilities.getUuid().replace(/-/g, '').slice(0, 12);
}

function writeRows_(sh, rows) {
  if (!rows.length) return;
  sh.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
}

function seedCategories_(ss) {
  const sh = ss.getSheetByName('Categories');
  if (sh.getLastRow() > 1) return;
  const cats = [
    ['Exercise', '🏋️'], ['Health', '❤️'], ['Nutrition', '🥗'], ['Study', '📚'],
    ['Work', '💼'], ['Mind', '🧠'], ['Reading', '📖'], ['Lifestyle', '🌿'],
    ['Personal', '⭐'], ['Sleep', '😴'], ['Other', '📌'],
  ];
  writeRows_(sh, cats.map((c, i) => ['cat_' + c[0].toLowerCase(), c[0], c[1], i + 1, true]));
}

function seedSettings_(ss, nowIso) {
  const sh = ss.getSheetByName('Settings');
  if (sh.getLastRow() > 1) return;
  const s = [
    ['schemaVersion', '1'],
    ['profileName', 'Me'],
    ['timezone', SETUP_TIMEZONE],
    ['weekStartsOn', '1'],            // 0 = Sunday, 1 = Monday
    ['dayCloseTime', '23:59'],        // after this time, unlogged habits count as missed
    ['units', 'metric'],
    ['waterUnit', 'L'],
    ['defaultWaterIncrementMl', '250'],
    ['theme', 'system'],              // system | light | dark
    ['notifications', 'false'],
    ['defaultProgressionAmount', '5'],
    ['defaultProgressionInterval', '14'],
    ['defaultProgressionUnit', 'days'],
  ];
  writeRows_(sh, s.map((r) => [r[0], r[1], nowIso]));
}

function seedHabits_(ss, today, nowIso) {
  const sh = ss.getSheetByName('Habits');
  if (sh.getLastRow() > 1) return;
  const H = SCHEMA.Habits.headers;
  const ALL = '0,1,2,3,4,5,6';

  const base = {
    description: '', unitFactor: 1, minTarget: '', endTarget: '', startDate: today,
    weekdays: ALL, scheduleTime: '', reminderTime: '', progressionEnabled: false,
    progressionAmount: '', progressionInterval: '', progressionUnit: '',
    quickAdds: '', status: 'active',
  };

  // All numeric values are in BASE units: ml, seconds, reps, pages, cups...
  // 'unit' + 'unitFactor' only control how values are DISPLAYED (L = ml / 1000).
  const defs = [
    { name: 'Pushups', icon: '💪', categoryId: 'cat_exercise', trackingType: 'COUNT', goalDirection: 'INCREASE',
      unit: 'reps', startingTarget: 5, scheduleTime: '07:30', reminderTime: '07:30',
      progressionEnabled: true, progressionAmount: 5, progressionInterval: 14, progressionUnit: 'days',
      quickAdds: '[1,5,10]' },
    { name: 'Squats', icon: '🦵', categoryId: 'cat_exercise', trackingType: 'COUNT', goalDirection: 'INCREASE',
      unit: 'reps', startingTarget: 10, scheduleTime: '07:30',
      progressionEnabled: true, progressionAmount: 5, progressionInterval: 14, progressionUnit: 'days',
      quickAdds: '[1,5,10]' },
    { name: 'Plank', icon: '🧱', categoryId: 'cat_exercise', trackingType: 'TIMER', goalDirection: 'INCREASE',
      unit: 'sec', startingTarget: 30, scheduleTime: '07:30',
      progressionEnabled: true, progressionAmount: 10, progressionInterval: 7, progressionUnit: 'days' },
    { name: 'Wall Sit', icon: '🪑', categoryId: 'cat_exercise', trackingType: 'TIMER', goalDirection: 'INCREASE',
      unit: 'sec', startingTarget: 20, scheduleTime: '07:30',
      progressionEnabled: true, progressionAmount: 10, progressionInterval: 7, progressionUnit: 'days' },
    { name: 'Water', icon: '💧', categoryId: 'cat_health', trackingType: 'QUANTITY', goalDirection: 'INCREASE',
      unit: 'L', unitFactor: 1000, startingTarget: 3000, quickAdds: '[250,500,1000]' },
    { name: 'Meditation', icon: '🧘', categoryId: 'cat_mind', trackingType: 'TIMER', goalDirection: 'INCREASE',
      unit: 'min', unitFactor: 60, startingTarget: 900, scheduleTime: '07:00', reminderTime: '07:00' },
    { name: 'Yoga', icon: '🤸', categoryId: 'cat_exercise', trackingType: 'BOOLEAN', goalDirection: 'INCREASE',
      unit: '', startingTarget: 1, scheduleTime: '07:45' },
    { name: 'Sun Exposure', icon: '☀️', categoryId: 'cat_health', trackingType: 'TIMER', goalDirection: 'INCREASE',
      unit: 'min', unitFactor: 60, startingTarget: 900, scheduleTime: '09:00' },
    { name: 'Tea', icon: '🍵', categoryId: 'cat_nutrition', trackingType: 'LIMIT', goalDirection: 'DECREASE',
      unit: 'cups', startingTarget: 4, endTarget: 1,
      progressionEnabled: true, progressionAmount: 1, progressionInterval: 7, progressionUnit: 'days',
      quickAdds: '[1,-1]' },
    { name: 'Rotis', icon: '🫓', categoryId: 'cat_nutrition', trackingType: 'LIMIT', goalDirection: 'MAINTAIN',
      unit: 'rotis', startingTarget: 6, quickAdds: '[1,2,-1]' },
    { name: 'Reading', icon: '📖', categoryId: 'cat_reading', trackingType: 'COUNT', goalDirection: 'INCREASE',
      unit: 'pages', startingTarget: 10, scheduleTime: '22:00', reminderTime: '22:00',
      quickAdds: '[1,5,10]' },
    { name: 'Study', icon: '📚', categoryId: 'cat_study', trackingType: 'TIMER', goalDirection: 'INCREASE',
      unit: 'min', unitFactor: 60, startingTarget: 7200, scheduleTime: '10:00' },
    { name: 'Work', icon: '💼', categoryId: 'cat_work', trackingType: 'TIMER', goalDirection: 'INCREASE',
      unit: 'min', unitFactor: 60, startingTarget: 28800, scheduleTime: '09:30', weekdays: '1,2,3,4,5' },
    { name: 'Walking', icon: '🚶', categoryId: 'cat_exercise', trackingType: 'TIMER', goalDirection: 'INCREASE',
      unit: 'min', unitFactor: 60, startingTarget: 1800, scheduleTime: '18:00' },
    { name: 'Porn-free', icon: '🛡️', categoryId: 'cat_lifestyle', trackingType: 'ABSTINENCE', goalDirection: 'AVOID',
      unit: '', startingTarget: 0 },
    { name: 'Masturbation-free', icon: '🛡️', categoryId: 'cat_lifestyle', trackingType: 'ABSTINENCE', goalDirection: 'AVOID',
      unit: '', startingTarget: 0 },
  ];

  const habitRows = [];
  const changeRows = [];
  defs.forEach((d, i) => {
    const o = Object.assign({}, base, d, {
      habitId: newId_('h'), sortOrder: i + 1, createdAt: nowIso, updatedAt: nowIso,
    });
    habitRows.push(H.map((k) => (o[k] === undefined ? '' : o[k])));
    changeRows.push([newId_('tc'), o.habitId, today, o.startingTarget, 'start', nowIso]);
  });

  writeRows_(sh, habitRows);
  writeRows_(ss.getSheetByName('TargetChanges'), changeRows);
}

// ---------- VALIDATION (dropdowns + checkboxes) ----------
function applyValidation_(ss) {
  const list = (sheetName, header, values) => {
    const sh = ss.getSheetByName(sheetName);
    const c = SCHEMA[sheetName].headers.indexOf(header) + 1;
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(values, true).setAllowInvalid(false).build();
    sh.getRange(2, c, sh.getMaxRows() - 1, 1).setDataValidation(rule);
  };
  const checkbox = (sheetName, header) => {
    const sh = ss.getSheetByName(sheetName);
    const c = SCHEMA[sheetName].headers.indexOf(header) + 1;
    sh.getRange(2, c, sh.getMaxRows() - 1, 1)
      .setDataValidation(SpreadsheetApp.newDataValidation().requireCheckbox().build());
  };

  list('Habits', 'trackingType', ['BOOLEAN', 'COUNT', 'DURATION', 'QUANTITY', 'TIMER', 'LIMIT', 'ABSTINENCE']);
  list('Habits', 'goalDirection', ['INCREASE', 'DECREASE', 'MAINTAIN', 'AVOID']);
  list('Habits', 'progressionUnit', ['days', 'weeks', 'months']);
  list('Habits', 'status', ['active', 'paused', 'archived']);
  list('TargetChanges', 'reason', ['start', 'manual', 'pause', 'resume', 'reset']);
  list('Entries', 'source', ['tap', 'timer', 'manual', 'checkin', 'import']);

  const habits = ss.getSheetByName('Habits');
  const catCol = SCHEMA.Habits.headers.indexOf('categoryId') + 1;
  habits.getRange(2, catCol, habits.getMaxRows() - 1, 1).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInRange(ss.getSheetByName('Categories').getRange('A2:A'), true)
      .setAllowInvalid(false).build()
  );

  checkbox('Habits', 'progressionEnabled');
  checkbox('Categories', 'active');
  checkbox('Entries', 'deleted');
  checkbox('DayStatus', 'closed');
}

// ---------- ANALYTICS (read-only formulas; the app does NOT depend on them) ----------
function setupAnalytics_(ss) {
  // ---- DailyTotals: one row per habit per date ----
  const dt = ss.getSheetByName('DailyTotals') || ss.insertSheet('DailyTotals');
  dt.clear();
  dt.getRange('A1').setFormula(
    `=IFERROR(QUERY(Entries!$A:$K,"select B, C, sum(D) where B<>'' and H=false group by B, C order by B, C label B 'habitId', C 'date', sum(D) 'total'",1),{"habitId","date","total"})`
  );
  dt.getRange('D1').setValue('month');
  dt.getRange('D2').setFormula('=ARRAYFORMULA(IF(B2:B="","",LEFT(B2:B,7)))');
  dt.getRange('E1').setValue('year');
  dt.getRange('E2').setFormula('=ARRAYFORMULA(IF(B2:B="","",LEFT(B2:B,4)))');
  dt.getRange('A1:E1').setFontWeight('bold');
  dt.setFrozenRows(1);

  // ---- MonthlyMatrix / YearlyMatrix ----
  const mm = ss.getSheetByName('MonthlyMatrix') || ss.insertSheet('MonthlyMatrix');
  mm.clear();
  mm.getRange('A1').setFormula(
    `=IFERROR(QUERY(DailyTotals!$A:$D,"select A, sum(C) where A<>'' group by A pivot D label A 'habitId'",1),"No data yet")`
  );
  const ym = ss.getSheetByName('YearlyMatrix') || ss.insertSheet('YearlyMatrix');
  ym.clear();
  ym.getRange('A1').setFormula(
    `=IFERROR(QUERY({DailyTotals!$A:$C,DailyTotals!$E:$E},"select Col1, sum(Col3) where Col1<>'' group by Col1 pivot Col4 label Col1 'habitId'",1),"No data yet")`
  );

  // ---- Analytics: per-habit summary ----
  const an = ss.getSheetByName('Analytics') || ss.insertSheet('Analytics');
  an.clear();

  const dateFmt = '"yyyy-mm-dd"';
  const inputs = [
    ['As of', `=TEXT(TODAY(),${dateFmt})`, ''],
    ['Week (Mon-Sun)', `=TEXT(TODAY()-WEEKDAY(TODAY(),3),${dateFmt})`, `=TEXT(TODAY()-WEEKDAY(TODAY(),3)+6,${dateFmt})`],
    ['This month', `=TEXT(EOMONTH(TODAY(),-1)+1,${dateFmt})`, `=TEXT(EOMONTH(TODAY(),0),${dateFmt})`],
    ['This year', '=YEAR(TODAY())&"-01-01"', '=YEAR(TODAY())&"-12-31"'],
    ['Previous month', `=TEXT(EOMONTH(TODAY(),-2)+1,${dateFmt})`, `=TEXT(EOMONTH(TODAY(),-1),${dateFmt})`],
  ];
  an.getRange(1, 1, inputs.length, 3).setFormulas(inputs);
  an.getRange('A1:A5').setFontWeight('bold');

  const headers = [
    'habitId', 'Habit', 'UnitFactor', 'Today', 'Week', 'Month', 'PrevMonth', 'Month vs prev %',
    'Year', 'All-time', 'Days logged', 'Avg / logged day', 'Best day', 'Worst logged day',
    'Current streak', 'Longest streak', 'Missed days', 'Month consistency %', 'First log', 'Last log',
  ];
  an.getRange(7, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold').setBackground('#0f766e').setFontColor('#ffffff');
  an.setFrozenRows(7);

  const FIRST = 8;
  const LAST = 107;
  const formulas = [];
  for (let r = FIRST; r <= LAST; r++) formulas.push(analyticsRow_(r));
  an.getRange(FIRST, 1, formulas.length, headers.length).setFormulas(formulas);

  an.getRange(FIRST, 8, formulas.length, 1).setNumberFormat('0.0%');
  an.getRange(FIRST, 18, formulas.length, 1).setNumberFormat('0.0%');
  an.getRange(FIRST, 4, formulas.length, 3).setNumberFormat('0.##');
  an.getRange(FIRST, 9, formulas.length, 2).setNumberFormat('0.##');
  an.getRange(FIRST, 12, formulas.length, 3).setNumberFormat('0.##');

  ['Analytics', 'DailyTotals', 'MonthlyMatrix', 'YearlyMatrix'].forEach((n) => {
    const sh = ss.getSheetByName(n);
    sh.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach((p) => p.remove());
    sh.protect().setWarningOnly(true);
  });
}

function analyticsRow_(r) {
  // Sum of Entries.delta for this habit under an extra QUERY condition, in display units.
  const q = (cond) =>
    `IFERROR(SUM(QUERY(Entries!$A:$K,"select sum(D) where B='"&$A${r}&"' and H=false${cond} label sum(D) ''",1))/$C${r},0)`;
  const habitLookup = (col) => `INDEX(Habits!$${col}:$${col},MATCH($A${r},Habits!$A:$A,0))`;
  const positiveDates = (order) =>
    `SORT(ARRAYFORMULA(DATEVALUE(FILTER(DailyTotals!$B$2:$B,DailyTotals!$A$2:$A=$A${r},DailyTotals!$C$2:$C>0))),1,${order})`;

  return [
    // A habitId (active + paused habits, in sheet order)
    `=IFERROR(INDEX(FILTER(Habits!$A$2:$A,Habits!$A$2:$A<>"",Habits!$V$2:$V<>"archived"),ROW()-7),"")`,
    // B name
    `=IF($A${r}="","",${habitLookup('B')})`,
    // C unitFactor
    `=IF($A${r}="","",${habitLookup('I')})`,
    // D today
    `=IF($A${r}="","",${q(` and C='"&$B$1&"'`)})`,
    // E week
    `=IF($A${r}="","",${q(` and C>='"&$B$2&"' and C<='"&$C$2&"'`)})`,
    // F month
    `=IF($A${r}="","",${q(` and C>='"&$B$3&"' and C<='"&$C$3&"'`)})`,
    // G previous month
    `=IF($A${r}="","",${q(` and C>='"&$B$5&"' and C<='"&$C$5&"'`)})`,
    // H month vs previous month %
    `=IF($A${r}="","",IF(G${r}=0,"",(F${r}-G${r})/G${r}))`,
    // I year
    `=IF($A${r}="","",${q(` and C>='"&$B$4&"' and C<='"&$C$4&"'`)})`,
    // J all-time
    `=IF($A${r}="","",${q('')})`,
    // K days logged (days with a positive total)
    `=IF($A${r}="","",COUNTIFS(DailyTotals!$A:$A,$A${r},DailyTotals!$C:$C,">0"))`,
    // L average per logged day
    `=IF($A${r}="","",IF(K${r}=0,"",J${r}/K${r}))`,
    // M best day
    `=IF($A${r}="","",IFERROR(MAXIFS(DailyTotals!$C:$C,DailyTotals!$A:$A,$A${r})/$C${r},""))`,
    // N worst logged day
    `=IF($A${r}="","",IF(K${r}=0,"",MINIFS(DailyTotals!$C:$C,DailyTotals!$A:$A,$A${r},DailyTotals!$C:$C,">0")/$C${r}))`,
    // O current streak (consecutive days ending today or yesterday)
    `=IF($A${r}="","",IFERROR(LET(d,${positiveDates('FALSE')},a,IF(INDEX(d,1)=TODAY(),TODAY(),TODAY()-1),ok,d=a-SEQUENCE(ROWS(d),1,0),IFERROR(MATCH(FALSE,ok,0)-1,ROWS(d))),0))`,
    // P longest streak
    `=IF($A${r}="","",IFERROR(LET(d,${positiveDates('TRUE')},MAX(SCAN(0,SEQUENCE(ROWS(d)),LAMBDA(a,i,IF(i=1,1,IF(INDEX(d,i)-INDEX(d,i-1)=1,a+1,1)))))),0))`,
    // Q missed days since start date
    `=IF($A${r}="","",MAX(0,TODAY()-DATEVALUE(${habitLookup('M')})+1-K${r}))`,
    // R month consistency = logged days this month / days elapsed this month
    `=IF($A${r}="","",IFERROR(SUM(QUERY(DailyTotals!$A:$D,"select count(B) where A='"&$A${r}&"' and D='"&LEFT($B$3,7)&"' and C>0 label count(B) ''",1))/DAY(TODAY()),0))`,
    // S first log
    `=IF($A${r}="","",IFERROR(INDEX(SORT(FILTER(DailyTotals!$B$2:$B,DailyTotals!$A$2:$A=$A${r},DailyTotals!$C$2:$C>0),1,TRUE),1),""))`,
    // T last log
    `=IF($A${r}="","",IFERROR(INDEX(SORT(FILTER(DailyTotals!$B$2:$B,DailyTotals!$A$2:$A=$A${r},DailyTotals!$C$2:$C>0),1,FALSE),1),""))`,
  ];
}