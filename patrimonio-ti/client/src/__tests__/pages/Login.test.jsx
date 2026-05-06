import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from '@/pages/auth/Login';
import useAuthStore from '@/store/authStore';

// mock do serviço e do navigate
vi.mock('@/services/authService', () => ({
  login: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => mockNavigate };
});

import { login } from '@/services/authService';

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ token: null, user: null });
});

describe('Login page', () => {
  it('renderiza campos de usuário e senha', () => {
    renderLogin();
    expect(screen.getByLabelText('Usuário')).toBeInTheDocument();
    expect(screen.getByLabelText('Senha')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument();
  });

  it('exibe erro ao submeter sem preencher campos', async () => {
    renderLogin();
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));
    await waitFor(() => {
      expect(screen.getByText('Preencha usuário e senha.')).toBeInTheDocument();
    });
    expect(login).not.toHaveBeenCalled();
  });

  it('chama login e redireciona admin para dashboard', async () => {
    login.mockResolvedValue({
      token: 'tok123',
      user: { id: '1', username: 'admin', role: 'admin', displayName: 'Admin' },
    });

    renderLogin();
    fireEvent.change(screen.getByLabelText('Usuário'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'senha' } });
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith('admin', 'senha');
      expect(mockNavigate).toHaveBeenCalledWith('/admin/dashboard');
    });

    expect(useAuthStore.getState().token).toBe('tok123');
  });

  it('chama login e redireciona usuário comum para meus-equipamentos', async () => {
    login.mockResolvedValue({
      token: 'tok456',
      user: { id: '2', username: 'user', role: 'user', displayName: 'Usuário' },
    });

    renderLogin();
    fireEvent.change(screen.getByLabelText('Usuário'), { target: { value: 'user' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'senha' } });
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/meus-equipamentos');
    });
  });

  it('exibe mensagem de erro da API quando login falha', async () => {
    login.mockRejectedValue({
      response: { data: { message: 'Credenciais inválidas' } },
    });

    renderLogin();
    fireEvent.change(screen.getByLabelText('Usuário'), { target: { value: 'user' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'errada' } });
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => {
      expect(screen.getByText('Credenciais inválidas')).toBeInTheDocument();
    });
  });
});
