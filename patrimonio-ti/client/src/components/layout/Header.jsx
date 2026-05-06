import { useEffect, useState } from 'react';
import { LogOut, User, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import GlobalSearch from '@/components/shared/GlobalSearch';

export default function Header({ onMenuToggle }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-6 shrink-0">
        <button
          className="lg:hidden text-gray-500 hover:text-gray-700"
          onClick={onMenuToggle}
          aria-label="Menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <span className="font-semibold text-primary-700 hidden lg:block">Patrimônio TI</span>

        <button
          onClick={() => setSearchOpen(true)}
          className="flex items-center gap-2 text-sm text-gray-400 bg-gray-100 hover:bg-gray-200 rounded-lg px-3 py-1.5 transition-colors mx-auto lg:mx-0"
          aria-label="Busca global"
        >
          <Search size={15} />
          <span className="hidden sm:inline">Buscar...</span>
          <kbd className="hidden sm:inline text-xs bg-white px-1.5 py-0.5 rounded border border-gray-200 text-gray-400">Ctrl+K</kbd>
        </button>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <User size={16} />
            <span className="hidden sm:inline">{user?.displayName || user?.username}</span>
            {user?.role === 'admin' && (
              <span className="badge bg-primary-100 text-primary-700">Admin</span>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="btn-secondary px-3 py-1.5 text-xs"
            title="Sair"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </header>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
