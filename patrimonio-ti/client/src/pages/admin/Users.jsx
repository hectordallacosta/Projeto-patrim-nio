import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RefreshCw, Pencil, UserX, UserCheck, Loader2, AlertTriangle, X, Filter, Monitor } from 'lucide-react';
import PageTitle from '@/components/shared/PageTitle';
import Modal from '@/components/shared/Modal';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import Pagination from '@/components/shared/Pagination';
import EmptyState from '@/components/shared/EmptyState';
import ADSyncModal from '@/components/shared/ADSyncModal';
import { listUsers, updateUser, deactivateUser, activateUser } from '@/services/userService';
import { listSectors } from '@/services/sectorService';
import { useDebounce } from '@/hooks/useDebounce';
import { roleLabel } from '@/utils/formatters';
import { toast } from '@/store/toastStore';
import { cn } from '@/utils/cn';

function UserEditForm({ user, sectors, onSubmit, onCancel, loading }) {
  const [form, setForm] = useState({
    role: user.role,
    sector: user.sector?._id || '',
  });
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
      <div>
        <label className="label">Nome</label>
        <input className="input" value={user.displayName} disabled />
      </div>
      <div>
        <label className="label">Usuário</label>
        <input className="input" value={user.username} disabled />
      </div>
      <div>
        <label className="label">Perfil</label>
        <select className="input" value={form.role} onChange={(e) => set('role', e.target.value)}>
          <option value="user">Usuário</option>
          <option value="admin">Administrador</option>
        </select>
      </div>
      <div>
        <label className="label">Setor</label>
        <select className="input" value={form.sector} onChange={(e) => set('sector', e.target.value || null)}>
          <option value="">Sem setor</option>
          {sectors.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
        </select>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancelar</button>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading && <Loader2 size={14} className="animate-spin" />} Salvar
        </button>
      </div>
    </form>
  );
}

export default function Users() {
  const [searchParams, setSearchParams] = useSearchParams();

  const search   = searchParams.get('search') || '';
  const role     = searchParams.get('role') || '';
  const isActive = searchParams.get('isActive') || '';
  const sector   = searchParams.get('sector') || '';
  const noSector = searchParams.get('noSector') || '';
  const page     = parseInt(searchParams.get('page') || '1');
  const limit    = parseInt(searchParams.get('limit') || '20');

  const [searchInput, setSearchInput] = useState(search);
  const debouncedSearch = useDebounce(searchInput, 300);

  const [data, setData]         = useState([]);
  const [pagination, setPagination] = useState(null);
  const [stats, setStats]       = useState(null);
  const [loading, setLoading]   = useState(true);
  const [sectors, setSectors]   = useState([]);
  const [modal, setModal]       = useState(null);
  const [adSyncOpen, setAdSyncOpen] = useState(false);
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
  const activeCount = [search, role, isActive, sector, noSector].filter(Boolean).length;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listUsers({
        page, limit,
        search: search || undefined,
        role: role || undefined,
        isActive: isActive !== '' ? isActive : undefined,
        sector: noSector === 'true' ? undefined : (sector || undefined),
        noSector: noSector === 'true' ? 'true' : undefined,
      });
      setData(res.data);
      setPagination(res.pagination);
    } finally { setLoading(false); }
  }, [page, limit, search, role, isActive, sector, noSector]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    Promise.all([
      listUsers({ limit: 1 }),
      listUsers({ limit: 1, isActive: 'true' }),
      listUsers({ limit: 1, isActive: 'false' }),
      listUsers({ limit: 1, noSector: 'true', isActive: 'true' }),
    ]).then(([all, active, inactive, noSect]) => {
      setStats({
        total:   all.pagination.total,
        active:  active.pagination.total,
        inactive:inactive.pagination.total,
        noSector:noSect.pagination.total,
      });
    });
    listSectors({ limit: 200 }).then((r) => setSectors(r.data));
  }, []);

  const setPage = (p) => setSearchParams((prev) => {
    const next = new URLSearchParams(prev);
    next.set('page', String(p));
    return next;
  }, { replace: true });

  const handleEdit = async (form) => {
    setSaving(true);
    try {
      await updateUser(modal.item._id, form);
      toast.success('Usuário atualizado com sucesso.');
      setModal(null); load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro ao salvar.');
    } finally { setSaving(false); }
  };

  const handleToggleActive = async () => {
    setSaving(true);
    try {
      if (confirm.action === 'deactivate') {
        await deactivateUser(confirm.item._id);
        toast.success(`${confirm.item.displayName} desativado.`);
      } else {
        await activateUser(confirm.item._id);
        toast.success(`${confirm.item.displayName} reativado.`);
      }
      setConfirm(null); load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro ao alterar status.');
      setConfirm(null);
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <PageTitle
        title="Usuários"
        action={
          <button className="btn-secondary" onClick={() => setAdSyncOpen(true)}>
            <RefreshCw size={15} /> Sincronizar AD
          </button>
        }
      />

      {/* Cards de resumo */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { key: null,    label: 'Total',     value: stats.total,    cls: 'border-gray-200 bg-white text-gray-700' },
            { key: 'active',label: 'Ativos',    value: stats.active,   cls: 'border-green-200 bg-green-50 text-green-700', paramKey: 'isActive', paramVal: 'true' },
            { key: 'inactive',label:'Inativos', value: stats.inactive, cls: 'border-red-200 bg-red-50 text-red-700', paramKey: 'isActive', paramVal: 'false' },
            { key: 'noSector',label:'Sem Setor',value: stats.noSector, cls: 'border-yellow-200 bg-yellow-50 text-yellow-700', paramKey: 'noSector', paramVal: 'true' },
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
            placeholder="Buscar por nome, usuário ou e-mail..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <select className="input w-auto" value={role} onChange={(e) => setParam('role', e.target.value)}>
          <option value="">Todos os perfis</option>
          <option value="admin">Administrador</option>
          <option value="user">Usuário</option>
        </select>
        <select className="input w-auto" value={isActive} onChange={(e) => setParam('isActive', e.target.value)}>
          <option value="">Todos os status</option>
          <option value="true">Ativos</option>
          <option value="false">Inativos</option>
        </select>
        <select className="input w-auto" value={sector} onChange={(e) => setParam('sector', e.target.value)}>
          <option value="">Todos os setores</option>
          {sectors.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
        </select>
        <button
          onClick={() => setParam('noSector', noSector === 'true' ? '' : 'true')}
          className={cn(
            'flex items-center gap-1.5 text-sm rounded-lg px-3 py-2 transition-colors border',
            noSector === 'true'
              ? 'bg-yellow-100 border-yellow-300 text-yellow-800'
              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
          )}
        >
          <AlertTriangle size={13} /> Sem setor
        </button>
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
            message={activeCount > 0 ? 'Nenhum usuário encontrado com esses filtros.' : 'Nenhum usuário cadastrado.'}
            action={activeCount > 0 ? <button className="btn-secondary mt-3" onClick={clearFilters}>Limpar filtros</button> : null}
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Nome</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Usuário</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Setor</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Perfil</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden xl:table-cell">Equipamentos</th>
                <th className="px-4 py-3 w-24" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.map((item) => (
                <tr
                  key={item._id}
                  className={cn(
                    'hover:bg-gray-50 transition-colors',
                    !item.isActive && 'opacity-50',
                    !item.sector && item.isActive && 'border-l-2 border-l-yellow-400'
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{item.displayName}</span>
                      {item.adImported && (
                        <span className="badge bg-blue-100 text-blue-700 text-xs">AD</span>
                      )}
                      {!item.sector && item.isActive && (
                        <span title="Sem setor atribuído"><AlertTriangle size={13} className="text-yellow-500" /></span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell font-mono text-xs">{item.username}</td>
                  <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">{item.sector?.name || <span className="text-yellow-600 text-xs">Sem setor</span>}</td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className={cn('badge', item.role === 'admin' ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600')}>
                      {roleLabel[item.role]}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className={cn('badge', item.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700')}>
                      {item.isActive ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden xl:table-cell">
                    {item.equipmentCount > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 rounded-full px-2 py-0.5">
                        <Monitor size={11} /> {item.equipmentCount} equip.
                      </span>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setModal({ mode: 'edit', item })} className="p-1.5 text-gray-400 hover:text-primary-600 rounded" title="Editar">
                        <Pencil size={15} />
                      </button>
                      {item.isActive ? (
                        <button onClick={() => setConfirm({ action: 'deactivate', item })} className="p-1.5 text-gray-400 hover:text-red-600 rounded" title="Desativar">
                          <UserX size={15} />
                        </button>
                      ) : (
                        <button onClick={() => setConfirm({ action: 'activate', item })} className="p-1.5 text-gray-400 hover:text-green-600 rounded" title="Ativar">
                          <UserCheck size={15} />
                        </button>
                      )}
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
          Exibindo {(page - 1) * limit + 1}–{Math.min(page * limit, pagination.total)} de {pagination.total} usuários
        </p>
      )}
      <Pagination pagination={pagination} onPageChange={setPage} />

      {/* Modal de edição */}
      <Modal open={modal?.mode === 'edit'} onClose={() => setModal(null)} title="Editar Usuário">
        {modal?.mode === 'edit' && (
          <UserEditForm user={modal.item} sectors={sectors} onSubmit={handleEdit} onCancel={() => setModal(null)} loading={saving} />
        )}
      </Modal>

      {/* Modal de sincronização AD */}
      <ADSyncModal
        open={adSyncOpen}
        onClose={() => setAdSyncOpen(false)}
        onImported={load}
      />

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={handleToggleActive}
        title={confirm?.action === 'deactivate' ? 'Desativar Usuário' : 'Reativar Usuário'}
        message={confirm?.action === 'deactivate'
          ? `Desativar "${confirm?.item?.displayName}"? Ele não poderá mais fazer login.`
          : `Reativar "${confirm?.item?.displayName}"?`}
        loading={saving}
      />
    </div>
  );
}
