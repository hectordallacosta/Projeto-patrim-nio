import api from './api';

const BASE = '/saved-ous';

export const listSavedOUs = (params) => api.get(BASE, { params }).then((r) => r.data);
export const listAllSavedOUs = () => api.get(`${BASE}/all`).then((r) => r.data.data);
export const createSavedOU = (data) => api.post(BASE, data).then((r) => r.data.data);
export const updateSavedOU = (id, data) => api.put(`${BASE}/${id}`, data).then((r) => r.data.data);
export const deleteSavedOU = (id) => api.delete(`${BASE}/${id}`).then((r) => r.data);
