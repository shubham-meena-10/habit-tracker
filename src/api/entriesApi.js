import { request } from './api';

export const addEntries = (entries) => request('addEntries', { entries });
export const deleteEntry = (entryId, requestId) => request('deleteEntry', { entryId }, { requestId });
export const closeDay = (payload, requestId) => request('closeDay', payload, { requestId });
export const getEntries = ({ from, to, habitId, includeDeleted }) =>
  request('getEntries', { from, to, habitId, includeDeleted });
export const getTotals = ({ from, to }) => request('getTotals', { from, to });