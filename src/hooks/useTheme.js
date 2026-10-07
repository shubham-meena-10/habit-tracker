import { useEffect } from 'react';
import { useAppState } from '../store/AppContext';

export const THEMES = ['system', 'light', 'dark'];
const BAR = { light: '#0f766e', dark: '#0b0f14' };

/** Applies a theme to the page and mirrors it to localStorage (read by the inline script in index.html). */
export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') root.setAttribute('data-theme', theme);
  else root.removeAttribute('data-theme');
  const dark = theme === 'dark' || (theme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? BAR.dark : BAR.light);
  try { localStorage.setItem('theme', theme); } catch { /* storage unavailable */ }
}

/** Keeps the page in step with the synced `theme` setting, and with the OS while it is on "system". */
export function useTheme() {
  const { ready, settings } = useAppState();
  const theme = THEMES.includes(settings.theme) ? settings.theme : null;

  useEffect(() => {
    if (ready && theme) applyTheme(theme);
  }, [ready, theme]);

  useEffect(() => {
    if (theme !== 'system') return undefined;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);
}