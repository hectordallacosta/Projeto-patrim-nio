import api from './api';

const BASE = '/sectors';

export const listSectors = (params) => api.get(BASE, { params }).then((r) => r.data);
export const getSector = (id) => api.get(`${BASE}/${id}`).then((r) => r.data.data);
export const deleteSector = (id) => api.delete(`${BASE}/${id}`).then((r) => r.data);
