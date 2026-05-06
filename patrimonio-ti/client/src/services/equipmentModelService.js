import api from './api';

const BASE = '/equipment-models';

export const listEquipmentModels = (params) => api.get(BASE, { params }).then((r) => r.data);
export const listAllEquipmentModels = () => api.get(`${BASE}/all`).then((r) => r.data.data);
export const getEquipmentModel = (id) => api.get(`${BASE}/${id}`).then((r) => r.data.data);
export const createEquipmentModel = (data) => api.post(BASE, data).then((r) => r.data.data);
export const updateEquipmentModel = (id, data) => api.put(`${BASE}/${id}`, data).then((r) => r.data.data);
export const deleteEquipmentModel = (id) => api.delete(`${BASE}/${id}`).then((r) => r.data);
