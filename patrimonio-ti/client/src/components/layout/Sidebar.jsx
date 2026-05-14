import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Monitor, Users, Building2, Cpu, ScrollText, X, Package, Warehouse, Network,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/utils/cn';

const adminLinks = [
  { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/equipment', icon: Monitor, label: 'Ativos em Uso' },
  { to: '/admin/equipment-models', icon: Package, label: 'Modelos' },
  { to: '/admin/stocks', icon: Warehouse, label: 'Estoques' },
  { to: '/admin/users', icon: Users, label: 'Usuários' },
  { to: '/admin/sectors', icon: Building2, label: 'Setores' },
  { to: '/admin/saved-ous', icon: Network, label: 'OUs Salvas' },
  { to: '/admin/equipment-types', icon: Cpu, label: 'Tipos de Equipamento' },
  { to: '/admin/audit-log', icon: ScrollText, label: 'Audit Log' },
];

const userLinks = [
  { to: '/meus-equipamentos', icon: Monitor, label: 'Meus Equipamentos' },
  { to: '/perfil', icon: Users, label: 'Meu Perfil' },
];

export default function Sidebar({ open, onClose }) {
  const { isAdmin } = useAuth();
  const links = isAdmin ? adminLinks : userLinks;

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed top-0 left-0 h-full w-60 bg-primary-900 text-white z-30 flex flex-col transition-transform duration-200',
          'lg:static lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between px-5 h-14 border-b border-primary-700 shrink-0">
          <span className="font-semibold text-sm tracking-wide">Patrimônio TI</span>
          <button onClick={onClose} className="lg:hidden text-primary-300 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {links.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary-700 text-white'
                    : 'text-primary-200 hover:bg-primary-800 hover:text-white'
                )
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}
