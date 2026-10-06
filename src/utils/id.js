/** Unique ID for entries/habits. crypto.randomUUID needs a secure context (HTTPS/localhost). */
export function newId(prefix = '') {
  const raw =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return prefix ? `${prefix}_${raw}` : raw;
}