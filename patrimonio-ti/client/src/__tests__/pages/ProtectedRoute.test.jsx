import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute, AdminRoute } from '@/components/shared/ProtectedRoute';
import useAuthStore from '@/store/authStore';

// Layout sem sidebar/header para simplificar os testes
vi.mock('@/components/layout/Layout', () => ({
  default: ({ children }) => <div>{children}</div>,
}));

const PrivatePage = () => <p>Página privada</p>;
const AdminPage = () => <p>Página admin</p>;
const LoginPage = () => <p>Login</p>;

function renderWithRouter(initialEntry, authState = {}) {
  useAuthStore.setState({ token: null, user: null, ...authState });

  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/meus-equipamentos" element={<p>Meus Equip.</p>} />
        <Route element={<ProtectedRoute />}>
          <Route path="/privado" element={<PrivatePage />} />
        </Route>
        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<AdminPage />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  useAuthStore.setState({ token: null, user: null });
});

describe('ProtectedRoute', () => {
  it('redireciona para /login quando não autenticado', () => {
    renderWithRouter('/privado');
    expect(screen.getByText('Login')).toBeInTheDocument();
    expect(screen.queryByText('Página privada')).not.toBeInTheDocument();
  });

  it('renderiza a página quando autenticado', () => {
    renderWithRouter('/privado', {
      token: 'tok',
      user: { id: '1', role: 'user', username: 'u', displayName: 'U' },
    });
    expect(screen.getByText('Página privada')).toBeInTheDocument();
  });
});

describe('AdminRoute', () => {
  it('redireciona para /login quando não autenticado', () => {
    renderWithRouter('/admin');
    expect(screen.getByText('Login')).toBeInTheDocument();
  });

  it('redireciona usuário comum para meus-equipamentos', () => {
    renderWithRouter('/admin', {
      token: 'tok',
      user: { id: '2', role: 'user', username: 'u', displayName: 'U' },
    });
    expect(screen.getByText('Meus Equip.')).toBeInTheDocument();
    expect(screen.queryByText('Página admin')).not.toBeInTheDocument();
  });

  it('renderiza a página para admin', () => {
    renderWithRouter('/admin', {
      token: 'tok',
      user: { id: '1', role: 'admin', username: 'a', displayName: 'A' },
    });
    expect(screen.getByText('Página admin')).toBeInTheDocument();
  });
});
