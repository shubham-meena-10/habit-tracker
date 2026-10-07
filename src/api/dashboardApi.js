import { request } from './api';

export const ping = () => request('ping');
export const bootstrap = ({ days } = {}) => request('bootstrap', { days });
export const pull = (since) => request('pull', { since });
export const exportAll = () => request('exportAll', {}, { timeoutMs: 90000 });
export const importStructure = (payload) => request('importStructure', payload, { timeoutMs: 90000 });
export const saveSettings = (settings, requestId) => request('saveSettings', { settings }, { requestId });
export const resetAll = () => request('resetAll', { confirm: 'RESET' }, { timeoutMs: 90000 });