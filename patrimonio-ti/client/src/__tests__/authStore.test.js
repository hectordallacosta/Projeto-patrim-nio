import { describe, it, expect, beforeEach } from 'vitest';
import useAuthStore from '@/store/authStore';

const token = 'eyJhbGciOiJIUzI1NiJ9.test';
const user = { id: '1', username: 'joao', role: 'admin', displayName: 'João' };

beforeEach(() => {
  useAuthStore.setState({ token: null, user: null });
});

describe('authStore', () => {
  it('inicia sem autenticação', () => {
    const { token, user } = useAuthStore.getState();
    expect(token).toBeNull();
    expect(user).toBeNull();
  });

  it('setAuth salva token e user', () => {
    useAuthStore.getState().setAuth(token, user);
    const state = useAuthStore.getState();
    expect(state.token).toBe(token);
    expect(state.user).toEqual(user);
  });

  it('logout limpa token e user', () => {
    useAuthStore.getState().setAuth(token, user);
    useAuthStore.getState().logout();
    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
  });

  it('updateUser mescla dados sem sobrescrever token', () => {
    useAuthStore.getState().setAuth(token, user);
    useAuthStore.getState().updateUser({ displayName: 'João Atualizado' });
    const state = useAuthStore.getState();
    expect(state.user.displayName).toBe('João Atualizado');
    expect(state.user.role).toBe('admin');
    expect(state.token).toBe(token);
  });
});
