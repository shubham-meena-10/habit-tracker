# Habit Tracker

A personal, local-first habit and goal tracker. React PWA on the front, Google Sheets as the database, Google Apps Script as the API. No login system: it is built for one person.

## Features

- Fully dynamic habits: Yes/No, Count, Timer, Duration, Quantity, Limit and Quit/Avoid. Nothing is hardcoded.
- Automatic target progression (increase or decrease), with pause, skip, reset and manual targets. Past days keep the targets they had.
- One-tap logging, a built-in timer that survives screen lock, and water extras kept above 100%.
- Streaks, completion, best/worst days, weekly/monthly/yearly summaries, a colour-coded calendar with back-filling.
- End-of-day check-in, schedule with overdue warnings, reminders (in-app, optional email).
- Works offline: every action is stored locally and synced idempotently.
- Installable PWA, JSON/CSV export, additive import, light/dark theme.

## Tech stack

React 19 + Vite · React Router (HashRouter) · `idb` (IndexedDB) · `vite-plugin-pwa` (Workbox) · Google Apps Script (V8) · Google Sheets. No chart or state libraries.

## Architecture

```text
React PWA ──reads/writes──▶ IndexedDB (what the UI shows)
                               │
                        Sync queue (idempotent)
                               │  POST text/plain JSON + token
                               ▼
                 Apps Script router (doPost) ──LockService──▶ Google Sheets
```

Entries are an append-only ledger of deltas with unique IDs, so retries and offline replays can never double count.

## Folder structure

```text
apps-script/   Setup, Config, Router, Utils, Db, Progression, Habits, Entries,
               Summaries, Import, Reminders, Cache, Tests   (paste into one Apps Script project)
public/        icons, sw-notify.js
src/
  api/         one fetch client + habits/entries/dashboard wrappers
  db/          IndexedDB access, device-local timers
  engine/      progression, calculations, history, summaries, calendar, checkin,
               schedule, reminders, and the in-browser self-tests
  hooks/ services/ store/ utils/ constants/ styles/ pages/
  components/  common · dashboard · habits · timer · progress · calendar · checkin · settings
```

## Local development

```bash
npm install
cp .env.example .env     # then fill it in (below)
npm run dev
```

`.env` is read when the dev server or build **starts**: restart after editing it.

## Environment variables

| Variable | Meaning |
|---|---|
| `VITE_GOOGLE_APPS_SCRIPT_URL` | The Web App URL ending in `/exec`. The only value to change after deploying Apps Script. |
| `VITE_API_TOKEN` | Optional. Leave empty and paste the token in **Settings → Access** on each device (recommended). |
| `VITE_TIMEZONE` | Defaults to `Asia/Kolkata`. Must match `CONFIG.TIMEZONE` in `Config.gs` and `SETUP_TIMEZONE` in `Setup.gs`. |

## Google Sheets setup

1. Create a blank Google Sheet. Open **Extensions → Apps Script**.
2. Add the files from `apps-script/` (one file per `.gs`). Runtime must be **V8**.
3. Put your spreadsheet ID (from its URL) into `CONFIG.SPREADSHEET_ID` in `Config.gs`.
4. Run **`setupDatabase`**: it creates every tab, headers, dropdowns, checkboxes, seed habits and the Analytics formulas. Safe to re-run.
5. Run **`generateApiToken`** and copy the token from the log.
6. Run **`testProgression`**, **`testPlanSnapshots`**, **`testApi`**, **`testImport`** and **`testReadCache`**. Each ends with an "ALL … PASSED" line.

### Tabs

| Tab | Purpose |
|---|---|
| `Settings` | key / value / updatedAt |
| `Categories` | categoryId, name, icon, sortOrder, active |
| `Habits` | one row per habit (type, direction, unit, unitFactor, targets, schedule, progression, status…) |
| `TargetChanges` | target history: anchors with the progression plan in force |
| `Entries` | append-only ledger: entryId, habitId, date, delta, source, durationSec, note, deleted… |
| `DayStatus` | closed days |
| `Analytics`, `DailyTotals`, `MonthlyMatrix`, `YearlyMatrix` | read-only formula tabs (the app does not depend on them) |

Values are stored in **base units** (ml, seconds, reps). `unit` + `unitFactor` only change how they are displayed.

### Key formulas (tab `Analytics`, row 8; filled down by the setup script)

| Purpose | Formula |
|---|---|
| Today's total | `=IF($A8="","",IFERROR(SUM(QUERY(Entries!$A:$K,"select sum(D) where B='"&$A8&"' and H=false and C='"&$B$1&"' label sum(D) ''",1))/$C8,0))` |
| Days logged | `=IF($A8="","",COUNTIFS(DailyTotals!$A:$A,$A8,DailyTotals!$C:$C,">0"))` |
| Best day | `=IF($A8="","",IFERROR(MAXIFS(DailyTotals!$C:$C,DailyTotals!$A:$A,$A8)/$C8,""))` |
| Improvement vs last month | `=IF($A8="","",IF(G8=0,"",(F8-G8)/G8))` |
| One row per habit per day | `DailyTotals!A1`: `=IFERROR(QUERY(Entries!$A:$K,"select B, C, sum(D) where B<>'' and H=false group by B, C order by B, C label B 'habitId', C 'date', sum(D) 'total'",1),{"habitId","date","total"})` |

Streaks, completion % and "missed" are authoritative **in the app** (they need each day's historical target, weekdays, pauses and goal direction). The Sheet versions are simple approximations.

## Deploying Apps Script

1. **Deploy → New deployment → Web app**. Execute as **Me**, access **Anyone**.
2. Copy the `/exec` URL into `VITE_GOOGLE_APPS_SCRIPT_URL`.
3. After **any** code change: **Deploy → Manage deployments → ✏️ → Version: New version → Deploy**. The URL stays the same but serves old code until you do.
4. Optional email reminders: run `testReminderEmail`, then `installReminderTrigger`, deploy a new version, and switch it on under Settings → Reminders.

## API reference

POST a `text/plain` body of JSON: `{ "token": "...", "action": "...", "requestId": "optional", "data": {} }`.
Response: `{ ok, status, data, error: { code, message }, serverTime }`.

| Action | Type | `data` |
|---|---|---|
| `ping` | read | none |
| `bootstrap` | read | `{ days? }` |
| `pull` | read | `{ since }` |
| `getEntries` | read | `{ from, to, habitId?, includeDeleted? }` |
| `getTotals` | read | `{ from, to }` |
| `getProgression` | read | `{ date?, habitId? }` |
| `exportAll` | read | none |
| `saveHabit` | write | `{ habit }` |
| `setHabitStatus` | write | `{ habitId, status }` |
| `setTarget` | write | `{ habitId, reason?, target?, effectiveDate? }` |
| `saveCategory` | write | `{ name, icon?, categoryId?, sortOrder?, active? }` |
| `addEntries` | write | `{ entries: [{ entryId, habitId, date, delta, source?, durationSec?, note?, deviceId?, createdAt? }] }` |
| `deleteEntry` | write | `{ entryId }` |
| `closeDay` | write | `{ date, closed?, notes? }` |
| `saveSettings` | write | `{ settings: { key: value } }` |
| `importStructure` | write | `{ categories, habits, targetChanges, dayStatus }` |

Reads also work over GET (`?action=ping&token=...`) for quick tests; writes are POST only. Error codes: `UNAUTHORIZED` 401, `VALIDATION` 400, `NOT_FOUND` 404, `CONFLICT` 409, `TOO_LARGE` 413, `BUSY` 503, `INTERNAL` 500.

## Production deployment

```bash
npm run generate-pwa-assets   # once; commit the icons in public/
npm run build
```

Upload `dist/` to any static host (Netlify, Cloudflare Pages, Vercel, GitHub Pages). HTTPS is required for install and offline. `HashRouter` means no rewrite rules are needed. Under a sub-path (for example GitHub Pages), set `base: '/your-repo/'` in `vite.config.js`. Environment variables are baked in at **build** time.

## Installing the PWA

- **Android (Chrome):** menu ⋮ → **Install app**.
- **Desktop Chrome/Edge:** install icon in the address bar.
- **iPhone/iPad (Safari only):** Share → **Add to Home Screen**. Wait for "✓ Synced" first, because the Home Screen app has its own storage. Notifications work only for the Home Screen app, and only while it is running.

## Reminders: what browsers cannot do

A web app cannot be woken while it is closed or the phone is locked (that needs a push server). In-app reminders fire only while the app is running. For real background reminders, use the email option (Apps Script time trigger, 0–20 minutes late).

## Security

The Web App URL is public, and the token is the only lock. Prefer the **token-on-device** setup (leave `VITE_API_TOKEN` empty and paste the token in Settings → Access), keep the Sheet unshared, never commit `.env`, and rotate the token (`generateApiToken`) if it ever leaks.

## Data backup

**Settings → Data & backup:** export everything as JSON (all tables, including archived habits and deleted entries), or entries/habits as CSV. Import is additive: it adds what is missing and never overwrites or deletes. **Reset local cache** re-downloads from the Sheet and keeps unsynced actions. Your Sheet's own version history (File → Version history) is a second backup.

## Updating

Pull the new code, `npm run build`, upload `dist/`. Open the installed app and tap **Reload** on the "new version" banner when convenient. Update Apps Script by pasting changed files and deploying a **new version**.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| "Could not reach the server" / CORS error | Deployment access is not **Anyone**, or the URL ends in `/dev` instead of `/exec`. |
| "unexpected response" | Wrong URL, or code changed without deploying a **New version**. |
| "Token rejected" | Token differs from `generateApiToken()` output (re-running it rotates it). Paste the new one in Settings → Access. |
| "Not connected to your Sheet yet" banner | URL or token missing on this device. |
| Test connection: "sheet problem" | Run `setupDatabase` again after updating `Setup.gs`. |
| Habit edits fail offline | By design: habit/target changes are online-only. Logging works offline. |
| A hand edit in the Sheet doesn't show | Press **Full resync**. Rows deleted by hand are not detected by incremental pulls. |
| Targets look wrong after editing the Sheet | Edit progression in the app, not in `Habits` or `TargetChanges`. |
| Days older than 90 are view-only | Raise `BOOTSTRAP_DAYS` in `src/config.js` and Full resync. |
| No reminder arrived | The app was closed (see above); use email reminders. On iPhone, add the app to the Home Screen first. |
| App seems stuck on an old version | Close all tabs/windows of the app, or tap Reload on the update banner. |
| Everything looks wrong on one device | Settings → Reset local cache (unsynced actions are kept). |

## Extending

Everything is a configured record, so new trackers need no code: sleep (Timer or Duration), weight (Quantity, kg), mood or calories (Count), screen time (Limit). For genuinely new behaviour, add a tracking type in `constants/trackingTypes.js`, handle it in `engine/calculations.js` and `engine/history.js`, and mirror any server-side rule in `Habits.gs` / `Entries.gs`. Wearable or calendar integrations would write entries through `addEntries` with `source: 'import'`.