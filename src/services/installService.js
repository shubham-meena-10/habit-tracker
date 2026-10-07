// Captures the browser's install prompt (Chrome/Edge/Android) as early as possible.
let deferred = null;
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();          // we show our own button in Settings
    deferred = e;
    emit();
  });
  window.addEventListener('appinstalled', () => { deferred = null; emit(); });
}

export const canPrompt = () => Boolean(deferred);
export const subscribeInstall = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

export async function promptInstall() {
  if (!deferred) return 'unavailable';
  const evt = deferred;
  deferred = null;
  evt.prompt();
  const { outcome } = await evt.userChoice;
  emit();
  return outcome;   // 'accepted' | 'dismissed'
}

export const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true);

export const isIos = () =>
  typeof navigator !== 'undefined' &&
  (/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));