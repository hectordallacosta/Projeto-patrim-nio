import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Trash2, Loader2, Filter, X, Users, Monitor } from 'lucide-react';
import PageTitle from '@/components/shared/PageTitle';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import Pagination from '@/components/shared/Pagination';
import EmptyState from '@/components/shared/EmptyState';
import { listSectors, deleteSector } from '@/services/sectorService';
import { useDebounce } from '@/hooks/useDebounce';
import { toast } from '@/store/toastStore';
import { cn } from '@/utils/cn';

export default function Sectors() {
  const [searchParams, setSearchParams] = useSearchParams();

  const search    = searchParams.get('search') || '';
  const isActive  = searchParams.get('isActive') || '';
  const hasManager= searchParams.get('hasManager') || '';
  const page      = parseInt(searchParams.get('page') || '1');
  const limit     = parseInt(searchParams.get('limit') || '20');

  const [searchInput, setSearchInput] = useState(search);
  const debouncedSearch = useDebounce(searchInput, 300);

  const [data, setData]         = useState([]);
  const [pagination, setPagination] = useState(null);
  const [stats, setStats]       = useState(null);
  const [loading, setLoading]   = useState(true);
  const [confirm, setConfirm]   = useState(null);
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (debouncedSearch) next.set('search', debouncedSearch);
      else next.delete('search');
      next.delete('page');
      return next;
    }, { replace: true });
  }, [debouncedSearch]);

  useEffect(() => { if (search !== searchInput) setSearchInput(search); }, [search]);

  const setParam = (key, value) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      next.delete('page');
      return next;
    }, { replace: true });
  };

  const clearFilters = () => setSearchParams({}, { replace: true });
  const activeCount = [search, isActive, hasManager].filter(Boolean).length;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listSectors({
        page, limit,
        search: search || undefined,
        isActive: isActive !== '' ? isActive : undefined,
        hasManager: hasManager !== '' ? hasManager : undefined,
      });
      setData(res.data);
      setPagination(res.pagination);
    } finally { setLoading(false); }
  }, [page, limit, search, isActive, hasManager]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    Promise.all([
      listSectors({ limit: 1 }),
      listSectors({ limit: 1, isActive: 'true' }),
      listSectors({ limit: 1, isActive: 'false' }),
    ]).then(([all, active, inactive]) => {
      setStats({
        total:   all.pagination.total,
        active:  active.pagination.total,
        inactive:inactive.pagination.total,
      });
    });
  }, []);

  const setPage = (p) => setSearchParams((prev) => {
    const next = new URLSearchParams(prev);
    next.set('page', String(p));
    return next;
  }, { replace: true });

  const handleDelete = async () => {
    setSaving(true);
    try {
      await deleteSector(confirm._id);
      toast.success(`Setor "${confirm.name}" excluído.`);
      setConfirm(null); load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Não foi possível excluir.');
      setConfirm(null);
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <PageTitle title="Setores" />

      <div className="mb-4 rounded-md bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700">
        Os setores são criados e gerenciados automaticamente a partir do Active Directory.
        Para adicionar um setor, importe os usuários correspondentes via <strong>Usuários → Sincronizar com AD</strong>.
      </div>

      {/* Cards de resumo */}
      {stats && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total',    value: stats.total,    cls: 'border-gray-200 bg-white text-gray-700', paramKey: null },
            { label: 'Ativos',   value: stats.active,   cls: 'border-green-200 bg-green-50 text-green-700', paramKey: 'isActive', paramVal: 'true' },
            { label: 'Inativos', value: stats.inactive, cls: 'border-gray-200 bg-gray-50 text-gray-600', paramKey: 'isActive', paramVal: 'false' },
          ].map(({ label, value, cls, paramKey, paramVal }) => (
            <button
              key={label}
              onClick={() => paramKey && setParam(paramKey, searchParams.get(paramKey) === paramVal ? '' : paramVal)}
              className={cn(
                'rounded-xl border p-4 text-left transition-all hover:shadow-md',
                cls,
                paramKey && searchParams.get(paramKey) === paramVal && 'ring-2 ring-offset-1 ring-current'
              )}
            >
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-xs font-medium mt-0.5 opacity-80">{label}</p>
            </button>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex-1 min-w-48">
          <input
            className="input"
            placeholder="Buscar por nome do setor..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <select className="input w-auto" value={isActive} onChange={(e) => setParam('isActive', e.target.value)}>
          <option value="">Todos os status</option>
          <option value="true">Ativos</option>
          <option value="false">Inativos</option>
        </select>
        <select className="input w-auto" value={hasManager} onChange={(e) => setParam('hasManager', e.target.value)}>
          <option value="">Com ou sem gestor</option>
          <option value="true">Com gestor</option>
          <option value="false">Sem gestor</option>
        </select>
        {activeCount > 0 && (
          <button onClick={clearFilters} className="flex items-center gap-1.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg px-3 py-2 transition-colors">
            <Filter size={14} /> {activeCount} filtro{activeCount > 1 ? 's' : ''} ativo{activeCount > 1 ? 's' : ''} <X size={13} />
          </button>
        )}
      </div>

      {/* Tabela */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary-600" size={24} /></div>
        ) : data.length === 0 ? (
          <EmptyState
            message={activeCount > 0 ? 'Nenhum setor encontrado com esses filtros.' : 'Nenhum setor cadastrado.'}
            action={activeCount > 0 ? <button className="btn-secondary mt-3" onClick={clearFilters}>Limpar filtros</button> : null}
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Nome</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Descrição</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Gestor</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden xl:table-cell">Usuários</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden xl:table-cell">Equipamentos</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Status</th>
                <th className="px-4 py-3 w-16" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.map((item) => (
                <tr key={item._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs hidden md:table-cell">{item.description || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">{item.manager?.displayName || <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 hidden xl:table-cell">
                    {item.userCount > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 rounded-full px-2 py-0.5">
                        <Users size={11} /> {item.userCount}
                      </span>
                    ) : <span className="text-gray-300 text-xs">0</span>}
                  </td>
                  <td className="px-4 py-3 hidden xl:table-cell">
                    {item.equipmentCount > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 rounded-full px-2 py-0.5">
                        <Monitor size={11} /> {item.equipmentCount}
                      </span>
                    ) : <span className="text-gray-300 text-xs">0</span>}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className={cn('badge', item.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500')}>
                      {item.isActive ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <button onClick={() => setConfirm(item)} className="p-1.5 text-gray-400 hover:text-red-600 rounded" title="Excluir">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pagination && (
        <p className="text-xs text-gray-400">
          {pagination.total} setor{pagination.total !== 1 ? 'es' : ''} encontrado{pagination.total !== 1 ? 's' : ''}
        </p>
      )}
      <Pagination pagination={pagination} onPageChange={setPage} />

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={handleDelete}
        title="Excluir Setor"
        message={`Excluir "${confirm?.name}"? A operação será bloqueada se houver usuários ou equipamentos vinculados.`}
        loading={saving}
      />
    </div>
  );
}
