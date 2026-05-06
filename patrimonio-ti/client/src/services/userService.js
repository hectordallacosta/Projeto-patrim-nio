import api from './api';

const BASE = '/users';

export const listUsers = (params) => api.get(BASE, { params }).then((r) => r.data);
export const getUser = (id) => api.get(`${BASE}/${id}`).then((r) => r.data.data);
export const updateUser = (id, data) => api.put(`${BASE}/${id}`, data).then((r) => r.data.data);
export const deactivateUser = (id) => api.patch(`${BASE}/${id}/deactivate`).then((r) => r.data.data);
export const activateUser = (id) => api.patch(`${BASE}/${id}/activate`).then((r) => r.data.data);
export const syncUserFromAD = (username) => api.post(`${BASE}/sync/${username}`).then((r) => r.data.data);
export const searchADUsers = (q) => api.get(`${BASE}/search-ad`, { params: { q } }).then((r) => r.data.data);
export const importUsersFromAD = (usernames) => api.post(`${BASE}/import-ad`, { usernames }).then((r) => r.data.data);
export const syncADBulk = (ouPath) => api.post(`${BASE}/sync-ad-bulk`, { ouPath }).then((r) => r.data.data);
export const getUserEquipment = (id) => api.get(`${BASE}/${id}/equipment`).then((r) => r.data.data);
export const getMyEquipment = () => api.get(`${BASE}/me/equipment`).then((r) => r.data.data);
