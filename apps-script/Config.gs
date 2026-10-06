// =====================================================================
// CONFIG.GS — configuration, sheet names, enums
// =====================================================================
const CONFIG = {
  // Paste the ID from your sheet URL: docs.google.com/spreadsheets/d/<THIS_PART>/edit
  // If left as the placeholder, the script falls back to the spreadsheet it is bound to.
  SPREADSHEET_ID: 'PASTE_SPREADSHEET_ID_HERE',
  TIMEZONE: 'Asia/Kolkata',
  SCHEMA_VERSION: 1,
  BOOTSTRAP_DAYS: 90,          // days of entries returned by bootstrap
  MAX_ENTRIES_PER_BATCH: 200,
  MAX_RANGE_DAYS: 800,         // max span for getEntries / getTotals
  LOCK_WAIT_MS: 20000,
  REPLAY_TTL_SEC: 600,         // how long a requestId response is cached
};

const SHEETS = {
  SETTINGS: 'Settings',
  CATEGORIES: 'Categories',
  HABITS: 'Habits',
  TARGETS: 'TargetChanges',
  ENTRIES: 'Entries',
  DAYS: 'DayStatus',
};

// Checkbox columns (used when new rows are added past the pre-formatted area)
const BOOL_COLS = {
  Habits: ['progressionEnabled'],
  Categories: ['active'],
  Entries: ['deleted'],
  DayStatus: ['closed'],
};

// Column that acts as "last modified" for each sheet (used by onEdit + pull)
const STAMP_COLUMNS = {
  Settings: 'updatedAt',
  Habits: 'updatedAt',
  Entries: 'updatedAt',
  DayStatus: 'updatedAt',
  TargetChanges: 'createdAt',
};

const TRACKING_TYPES_ = ['BOOLEAN', 'COUNT', 'DURATION', 'QUANTITY', 'TIMER', 'LIMIT', 'ABSTINENCE'];
const GOAL_DIRECTIONS_ = ['INCREASE', 'DECREASE', 'MAINTAIN', 'AVOID'];
const HABIT_STATUSES_ = ['active', 'paused', 'archived'];
const PROGRESSION_UNITS_ = ['days', 'weeks', 'months'];
const ENTRY_SOURCES_ = ['tap', 'timer', 'manual', 'checkin', 'import'];
const ANCHOR_REASONS_ = ['manual', 'pause', 'resume', 'reset']; // 'start' is server-only

/**
 * Run ONCE from the editor. Creates a random API token, stores it in Script
 * Properties (never in the sheet) and prints it. Copy it into .env as VITE_API_TOKEN.
 * Running it again rotates the token.
 */
function generateApiToken() {
  const token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty('API_TOKEN', token);
  Logger.log('API token saved. Put this in .env as VITE_API_TOKEN:\n\n' + token);
}