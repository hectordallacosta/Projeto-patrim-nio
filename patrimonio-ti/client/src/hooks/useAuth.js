import useAuthStore from '@/store/authStore';

export function useAuth() {
  const { token, user, setAuth, logout, updateUser } = useAuthStore();

  const isAuthenticated = Boolean(token && user);
  const isAdmin = user?.role === 'admin';

  return { token, user, isAuthenticated, isAdmin, setAuth, logout, updateUser };
}
