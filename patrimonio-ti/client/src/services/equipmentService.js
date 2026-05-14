import api from './api';

const BASE = '/equipment';

export const listEquipment = (params) => api.get(BASE, { params }).then((r) => r.data);
export const getEquipment = (id) => api.get(`${BASE}/${id}`).then((r) => r.data.data);
export const createEquipment = (data) => api.post(BASE, data).then((r) => r.data.data);
export const updateEquipment = (id, data) => api.put(`${BASE}/${id}`, data).then((r) => r.data.data);
export const assignEquipment = (id, data) => api.patch(`${BASE}/${id}/assign`, data).then((r) => r.data.data);
export const unassignEquipment = (id, { stockId, note = '' }) => api.patch(`${BASE}/${id}/unassign`, { stockId, note }).then((r) => r.data.data);
export const sendEquipmentToStock = (id, stockId) => api.patch(`${BASE}/${id}/send-to-stock`, { stockId }).then((r) => r.data.data);
export const changeEquipmentStatus = (id, status) => api.patch(`${BASE}/${id}/status`, { status }).then((r) => r.data.data);
export const deleteEquipment = (id) => api.delete(`${BASE}/${id}`).then((r) => r.data);

export const getAnalyticsBySector     = () => api.get(`${BASE}/analytics/by-sector`).then((r) => r.data.data);
export const getAnalyticsByType       = () => api.get(`${BASE}/analytics/by-type`).then((r) => r.data.data);
export const getAnalyticsByModelSector = () => api.get(`${BASE}/analytics/by-model-sector`).then((r) => r.data.data);
export const getAnalyticsRecent       = () => api.get(`${BASE}/analytics/recent`).then((r) => r.data.data);
