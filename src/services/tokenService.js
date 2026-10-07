import { getMeta, setMeta } from '../db/idb';
import { setRuntimeToken } from '../config';

/** Loads the token stored on this device (if any) into memory. Call once, before the first sync. */
export async function loadStoredToken() {
  const t = await getMeta('apiToken');
  setRuntimeToken(typeof t === 'string' ? t : '');
}

export async function storeToken(token) {
  await setMeta('apiToken', token);
  setRuntimeToken(token);
  window.dispatchEvent(new Event('token-changed'));
}

export async function clearStoredToken() {
  await setMeta('apiToken', '');
  setRuntimeToken('');
  window.dispatchEvent(new Event('token-changed'));
}