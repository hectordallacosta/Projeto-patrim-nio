import api from './api';

const BASE = '/equipment-types';

export const listEquipmentTypes = () => api.get(BASE).then((r) => r.data.data);
export const createEquipmentType = (data) => api.post(BASE, data).then((r) => r.data.data);
export const updateEquipmentType = (id, data) => api.put(`${BASE}/${id}`, data).then((r) => r.data.data);
export const deleteEquipmentType = (id) => api.delete(`${BASE}/${id}`).then((r) => r.data);
