import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Users, Monitor, ChevronRight } from 'lucide-react';
import Pagination from '@/components/shared/Pagination';
import EmptyState from '@/components/shared/EmptyState';
import StatusBadge from '@/components/shared/StatusBadge';
import { getSectorById, getSectorEquipment, getSectorUsers } from '@/services/sectorService';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDate } from '@/utils/formatters';
import { cn } from '@/utils/cn';

const TABS = [
  { key: 'equipment', label: 'Equipamentos', icon: Monitor },
  { key: 'users', label: 'Usuários', icon: Users },
];

// ---------- Aba Equipamentos ----------
function EquipmentTab({ sectorId }) {
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput, 300);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getSectorEquipment(sectorId, { page, limit: 20, search: search || undefined });
      setData(res.data);
      setPagination(res.pagination);
    } finally {
      setLoading(false);
    }
  }, [sectorId, page, search]);

  useEffect(() => { setPage(1); }, [search]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-3">
      <input
        className="input max-w-xs"
        placeholder="Buscar por patrimônio ou modelo..."
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
      />

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-primary-600" size={24} />
          </div>
        ) : data.length === 0 ? (
          <EmptyState message="Nenhum equipamento atribuído a este setor." />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Patrimônio</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Modelo</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Tipo</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Usuário</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.map((item) => {
                const em = item.equipmentModel;
                return (
                  <tr key={item._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{item.patrimonyNumber || '—'}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {em ? `${em.brand} ${em.model}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs hidden md:table-cell">
                      {em?.type?.name || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">
                      {item.assignedTo
                        ? item.assignedTo.displayName
                        : <span className="text-gray-400 italic">— (setor)</span>}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <StatusBadge status={item.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {pagination && (
        <p className="text-xs text-gray-400">
          {pagination.total} equipamento{pagination.total !== 1 ? 's' : ''}
        </p>
      )}
      <Pagination pagination={pagination} onPageChange={setPage} />
    </div>
  );
}

// ---------- Aba Usuários ----------
function UsersTab({ sectorId }) {
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [isActive, setIsActive] = useState('');
  const search = useDebounce(searchInput, 300);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getSectorUsers(sectorId, {
        page,
        limit: 20,
        search: search || undefined,
        isActive: isActive !== '' ? isActive : undefined,
      });
      setData(res.data);
      setPagination(res.pagination);
    } finally {
      setLoading(false);
    }
  }, [sectorId, page, search, isActive]);

  useEffect(() => { setPage(1); }, [search, isActive]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input
          className="input flex-1 min-w-48"
          placeholder="Buscar por nome ou usuário..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <select className="input w-auto" value={isActive} onChange={(e) => setIsActive(e.target.value)}>
          <option value="">Todos</option>
          <option value="true">Ativos</option>
          <option value="false">Inativos</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-primary-600" size={24} />
          </div>
        ) : data.length === 0 ? (
          <EmptyState message="Nenhum usuário neste setor." />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Nome</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Usuário</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">E-mail</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Último acesso</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.map((user) => (
                <tr key={user._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{user.displayName}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500 hidden sm:table-cell">{user.username}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs hidden lg:table-cell">{user.email || '—'}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs hidden md:table-cell">
                    {user.lastLogin ? formatDate(user.lastLogin) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'badge text-xs',
                      user.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                    )}>
                      {user.isActive ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pagination && (
        <p className="text-xs text-gray-400">
          {pagination.total} usuário{pagination.total !== 1 ? 's' : ''}
        </p>
      )}
      <Pagination pagination={pagination} onPageChange={setPage} />
    </div>
  );
}

// ---------- Página principal ----------
export default function SectorDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('equipment');

  useEffect(() => {
    getSectorById(id)
      .then(setDetail)
      .catch((err) => {
        const code = err.response?.data?.code;
        if (code === 'SECTOR_NOT_FOUND' || err.response?.status === 404) {
          navigate('/admin/sectors');
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-primary-600" size={28} />
      </div>
    );
  }

  if (!detail) {
    return (
      <EmptyState
        message="Setor não encontrado."
        action={
          <Link to="/admin/sectors" className="btn-secondary mt-3">
            Voltar para Setores
          </Link>
        }
      />
    );
  }

  const { sector, userCount, equipmentCount } = detail;

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-gray-500">
        <Link to="/admin/sectors" className="hover:text-gray-700">Setores</Link>
        <ChevronRight size={14} />
        <span className="text-gray-900 font-medium">{sector.name}</span>
      </div>

      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/admin/sectors')}
            className="p-1.5 text-gray-400 hover:text-gray-700 rounded"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-gray-900">{sector.name}</h1>
              <span className={cn(
                'badge text-xs',
                sector.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
              )}>
                {sector.isActive ? 'Ativo' : 'Inativo'}
              </span>
              {sector.origin === 'ad' && (
                <span className="badge text-xs bg-blue-100 text-blue-700">AD</span>
              )}
            </div>
            {sector.description && (
              <p className="text-sm text-gray-500 mt-0.5">{sector.description}</p>
            )}
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
              {sector.manager?.displayName && (
                <span>Gestor: <span className="text-gray-600">{sector.manager.displayName}</span></span>
              )}
              <span className="flex items-center gap-1">
                <Monitor size={12} /> {equipmentCount} equipamento{equipmentCount !== 1 ? 's' : ''}
              </span>
              <span className="flex items-center gap-1">
                <Users size={12} /> {userCount} usuário{userCount !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Abas */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-0">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
                tab === key
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              )}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Conteúdo da aba */}
      {tab === 'equipment' && <EquipmentTab sectorId={id} />}
      {tab === 'users' && <UsersTab sectorId={id} />}
    </div>
  );
}
