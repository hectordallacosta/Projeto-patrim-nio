export const formatDate = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
};

export const formatDateTime = (date) => {
  if (!date) return '—';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(date));
};

export const statusLabel = {
  available: 'Disponível',
  assigned: 'Atribuído',
  maintenance: 'Manutenção',
  decommissioned: 'Desativado',
  in_stock: 'Em Estoque',
};

export const statusColor = {
  available: 'bg-green-100 text-green-800',
  assigned: 'bg-blue-100 text-blue-800',
  maintenance: 'bg-yellow-100 text-yellow-800',
  decommissioned: 'bg-gray-100 text-gray-600',
  in_stock: 'bg-indigo-100 text-indigo-800',
};

export const roleLabel = {
  admin: 'Administrador',
  user: 'Usuário',
};
