// // Single place for all app configuration.
// export const CONFIG = {
//   API_URL: import.meta.env.VITE_GOOGLE_APPS_SCRIPT_URL || '',
//   API_TOKEN: import.meta.env.VITE_API_TOKEN || 'f60f713069c94a41b3b35bb53247b8b1fa6d165c2668415faa1bad97b197a412',
//   TIMEZONE: import.meta.env.VITE_TIMEZONE || 'Asia/Kolkata',
//   REQUEST_TIMEOUT_MS: 20000,
//   APP_NAME: 'Habits',
// };

// export const isApiConfigured = () =>
//   CONFIG.API_URL && !CONFIG.API_URL.includes('REPLACE_ME');

// Single place for all app configuration.
export const CONFIG = {
  API_URL: import.meta.env.VITE_GOOGLE_APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbwA1G6InkjdpFKwBxbNzWZ_L_hjyqd9Ctthnjv_WzufEBw_m1nmV1GqRCO14m2GczLS/exec',
  API_TOKEN: import.meta.env.VITE_API_TOKEN || 'f60f713069c94a41b3b35bb53247b8b1fa6d165c2668415faa1bad97b197a412',
  TIMEZONE: import.meta.env.VITE_TIMEZONE || 'Asia/Kolkata',
  REQUEST_TIMEOUT_MS: 20000,
  APP_NAME: 'Habits',
  BOOTSTRAP_DAYS: 90,     // days of entries cached on first load
  SYNC_BATCH_SIZE: 100,   // max entries per addEntries call (server limit is 200)
};

export const isApiConfigured = () =>
  Boolean(CONFIG.API_URL) &&
  !CONFIG.API_URL.includes('REPLACE_ME') &&
  Boolean(CONFIG.API_TOKEN);