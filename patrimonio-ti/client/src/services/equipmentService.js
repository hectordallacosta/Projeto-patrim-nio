import api from './api';

const BASE = '/equipment';

export const listEquipment = (params) => api.get(BASE, { params }).then((r) => r.data);
export const getEquipment = (id) => api.get(`${BASE}/${id}`).then((r) => r.data.data);
export const createEquipment = (data) => api.post(BASE, data).then((r) => r.data.data);
export const updateEquipment = (id, data) => api.put(`${BASE}/${id}`, data).then((r) => r.data.data);
export const assignEquipment = (id, data) => api.patch(`${BASE}/${id}/assign`, data).then((r) => r.data.data);
export const unassignEquipment = (id, note) => api.patch(`${BASE}/${id}/unassign`, { note }).then((r) => r.data.data);
export const changeEquipmentStatus = (id, status) => api.patch(`${BASE}/${id}/status`, { status }).then((r) => r.data.data);
export const deleteEquipment = (id) => api.delete(`${BASE}/${id}`).then((r) => r.data);
