import api from './api';

const BASE = '/stocks';

export const listStocks = (params) => api.get(BASE, { params }).then((r) => r.data);
export const listAllStocks = () => api.get(`${BASE}/all`).then((r) => r.data.data);
export const getStock = (id) => api.get(`${BASE}/${id}`).then((r) => r.data.data);
export const listStockEquipment = (id, params) => api.get(`${BASE}/${id}/equipment`, { params }).then((r) => r.data);
export const createStock = (data) => api.post(BASE, data).then((r) => r.data.data);
export const updateStock = (id, data) => api.put(`${BASE}/${id}`, data).then((r) => r.data.data);
export const deleteStock = (id) => api.delete(`${BASE}/${id}`).then((r) => r.data);
export const retrieveEquipment = (equipmentId, sectorId) =>
  api.patch(`/equipment/${equipmentId}/retrieve`, { sectorId }).then((r) => r.data.data);
