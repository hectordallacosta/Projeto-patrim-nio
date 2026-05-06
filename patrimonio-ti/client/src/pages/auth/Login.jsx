import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Monitor, Loader2 } from 'lucide-react';
import { login } from '@/services/authService';
import { useAuth } from '@/hooks/useAuth';

export default function Login() {
  const navigate = useNavigate();
  const { setAuth } = useAuth();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.username || !form.password) {
      setError('Preencha usuário e senha.');
      return;
    }
    setLoading(true);
    try {
      const { token, user } = await login(form.username, form.password);
      setAuth(token, user);
      navigate(user.role === 'admin' ? '/admin/dashboard' : '/meus-equipamentos');
    } catch (err) {
      setError(
        err.response?.data?.message || 'Não foi possível autenticar. Verifique suas credenciais.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-900 to-primary-700 px-4">
      <div className="w-full max-w-sm">
        <div className="card p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="bg-primary-600 text-white rounded-full p-3 mb-4">
              <Monitor size={28} />
            </div>
            <h1 className="text-xl font-semibold text-gray-900">Patrimônio TI</h1>
            <p className="text-sm text-gray-500 mt-1">Use suas credenciais de rede</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label" htmlFor="username">Usuário</label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                autoFocus
                className="input"
                placeholder="usuario.rede"
                value={form.username}
                onChange={handleChange}
              />
            </div>

            <div>
              <label className="label" htmlFor="password">Senha</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                className="input"
                placeholder="••••••••"
                value={form.password}
                onChange={handleChange}
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              {loading ? 'Autenticando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
