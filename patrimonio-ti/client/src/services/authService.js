import api from './api';

export const login = async (username, password) => {
  const { data } = await api.post('/auth/login', { username, password });
  return data.data;
};

export const getMe = async () => {
  const { data } = await api.get('/auth/me');
  return data.data;
};
