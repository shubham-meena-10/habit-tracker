// Single place for all app configuration.
export const CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbwA1G6InkjdpFKwBxbNzWZ_L_hjyqd9Ctthnjv_WzufEBw_m1nmV1GqRCO14m2GczLS/exec',
  API_TOKEN: 'f60f713069c94a41b3b35bb53247b8b1fa6d165c2668415faa1bad97b197a412',
  TIMEZONE: 'Asia/Kolkata',
  REQUEST_TIMEOUT_MS: 20000,
  APP_NAME: 'Habits',
  BOOTSTRAP_DAYS: 90,     // days of entries cached on first load
  SYNC_BATCH_SIZE: 100,   // max entries per addEntries call (server limit is 200)
};

// A token pasted in Settings is kept on the device and wins over one built into the app.
let runtimeToken = '';
export const setRuntimeToken = (t) => { runtimeToken = t || ''; };
export const getApiToken = () => runtimeToken || CONFIG.API_TOKEN;
/** 'device' | 'build' | 'none' */
export const tokenSource = () => (runtimeToken ? 'device' : CONFIG.API_TOKEN ? 'build' : 'none');

export const hasApiUrl = () => Boolean(CONFIG.API_URL) && !CONFIG.API_URL.includes('REPLACE_ME');
export const isApiConfigured = () => hasApiUrl() && Boolean(getApiToken());