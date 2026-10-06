import { request } from './api';

export const ping = () => request('ping');
export const bootstrap = ({ days } = {}) => request('bootstrap', { days });
export const pull = (since) => request('pull', { since });
export const exportAll = () => request('exportAll');
export const saveSettings = (settings, requestId) => request('saveSettings', { settings }, { requestId });