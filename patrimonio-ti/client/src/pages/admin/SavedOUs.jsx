import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, Loader2, X, Filter, Network } from 'lucide-react';
import PageTitle from '@/components/shared/PageTitle';
import Modal from '@/components/shared/Modal';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import Pagination from '@/components/shared/Pagination';
import EmptyState from '@/components/shared/EmptyState';
import { listSavedOUs, createSavedOU, updateSavedOU, deleteSavedOU } from '@/services/savedOUService';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDateTime } from '@/utils/formatters';
import { toast } from '@/store/toastStore';
import { cn } from '@/utils/cn';

function OUForm({ initial, onSubmit, onCancel, loading }) {
  const [form, setForm] = useState({
    name: '',
    ouPath: '',
    description: '',
    isActive: true,
    ...initial,
  });
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
      <div>
        <label className="label">Nome *</label>
        <input
          className="input"
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="Ex: Usuários GETIC, Almoxarifado Central..."
          required
        />
        <p className="text-xs text-gray-400 mt-1">Nome amigável para identificar esta OU.</p>
      </div>

      <div>
        <label className="label">Caminho da OU (Distinguished Name) *</label>
        <input
          className="input font-mono text-sm"
          value={form.ouPath}
          onChange={(e) => set('ouPath', e.target.value)}
          placeholder="Ex: OU=GETIC,OU=Usuarios,DC=empresa,DC=com,DC=br"
          required
        />
        <p className="text-xs text-gray-400 mt-1">DN completo da OU no Active Directory.</p>
      </div>

      <div>
        <label className="label">Descrição</label>
        <textarea
          className="input resize-none"
          rows={2}
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder="Observações opcionais sobre esta OU"
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isActive"
          checked={form.isActive}
          onChange={(e) => set('isActive', e.target.checked)}
          className="w-4 h-4 rounded border-gray-300 text-primary-600"
        />
        <label htmlFor="isActive" className="text-sm text-gray-700 cursor-pointer">
          OU ativa (aparece no seletor de sincronização)
        </label>
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

export default function SavedOUs() {
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get('search') || '';
  const page   = parseInt(searchParams.get('page') || '1');
  const limit  = parseInt(searchParams.get('limit') || '20');

  const [searchInput, setSearchInput] = useState(search);
  const debouncedSearch = useDebounce(searchInput, 300);

  const [data, setData]           = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState(null);
  const [confirm, setConfirm]     = useState(null);
  const [saving, setSaving]       = useState(false);

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

  const clearFilters = () => setSearchParams({}, { replace: true });
  const activeCount = [search].filter(Boolean).length;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listSavedOUs({ page, limit, search: search || undefined });
      setData(res.data);
      setPagination(res.pagination);
    } finally { setLoading(false); }
  }, [page, limit, search]);

  useEffect(() => { load(); }, [load]);

  const setPage = (p) => setSearchParams((prev) => {
    const next = new URLSearchParams(prev);
    next.set('page', String(p));
    return next;
  }, { replace: true });

  const handleSave = async (form) => {
    setSaving(true);
    try {
      if (modal.mode === 'create') {
        await createSavedOU(form);
        toast.success('OU salva com sucesso!');
      } else {
        await updateSavedOU(modal.item._id, form);
        toast.success('OU atualizada.');
      }
      setModal(null); load();
    } catch (err) {
      const code = err.response?.data?.code;
      if (code === 'SAVED_OU_DUPLICATE') {
        toast.error('Já existe uma OU com este nome.');
      } else {
        toast.error(err.response?.data?.message || 'Erro ao salvar.');
      }
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await deleteSavedOU(confirm._id);
      toast.success('OU excluída.');
      setConfirm(null); load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro ao excluir.');
      setConfirm(null);
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <PageTitle
        title="OUs Salvas"
        action={
          <button className="btn-primary" onClick={() => setModal({ mode: 'create' })}>
            <Plus size={16} /> Nova OU
          </button>
        }
      />

      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
        Cadastre as Unidades Organizacionais do Active Directory com nomes amigáveis para facilitar a sincronização em lote.
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex-1 min-w-48">
          <input
            className="input"
            placeholder="Buscar por nome, DN ou descrição..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        {activeCount > 0 && (
          <button onClick={clearFilters} className="flex items-center gap-1.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg px-3 py-2 transition-colors">
            <Filter size={14} />
            {activeCount} filtro{activeCount > 1 ? 's' : ''} ativo{activeCount > 1 ? 's' : ''}
            <X size={13} />
          </button>
        )}
      </div>

      {/* Tabela */}
      <div className="card overflow-x-auto">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary-600" size={24} /></div>
        ) : data.length === 0 ? (
          <EmptyState
            message={activeCount > 0 ? 'Nenhuma OU encontrada com esses filtros.' : 'Nenhuma OU salva. Clique em "Nova OU" para começar.'}
            action={activeCount > 0 ? <button className="btn-secondary mt-3" onClick={clearFilters}>Limpar filtros</button> : null}
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Nome</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">DN da OU</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Descrição</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden xl:table-cell">Última Sync</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.map((item) => (
                <tr key={item._id} className={cn('hover:bg-gray-50', !item.isActive && 'opacity-60')}>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <div className="flex items-center gap-2">
                      <Network size={14} className="text-primary-500 shrink-0" />
                      {item.name}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500 hidden md:table-cell max-w-xs truncate">
                    {item.ouPath}
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden lg:table-cell text-xs">{item.description || '—'}</td>
                  <td className="px-4 py-3 hidden xl:table-cell text-xs text-gray-400">
                    {item.lastSyncAt ? (
                      <div>
                        <p>{formatDateTime(item.lastSyncAt)}</p>
                        {item.lastSyncResult?.total != null && (
                          <p className="text-gray-400">
                            {item.lastSyncResult.imported} novo(s), {item.lastSyncResult.updated} atualizado(s)
                          </p>
                        )}
                      </div>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('badge text-xs', item.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
                      {item.isActive ? 'Ativa' : 'Inativa'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setModal({ mode: 'edit', item })} className="p-1.5 text-gray-400 hover:text-primary-600 rounded" title="Editar">
                        <Pencil size={15} />
                      </button>
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
          {(page - 1) * limit + 1}–{Math.min(page * limit, pagination.total)} de {pagination.total} OUs
        </p>
      )}
      <Pagination pagination={pagination} onPageChange={setPage} />

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.mode === 'create' ? 'Nova OU Salva' : 'Editar OU Salva'}
        size="lg"
      >
        {modal && (
          <OUForm
            initial={modal.item}
            onSubmit={handleSave}
            onCancel={() => setModal(null)}
            loading={saving}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={handleDelete}
        title="Excluir OU"
        message={`Excluir a OU "${confirm?.name}"? Esta ação não pode ser desfeita.`}
        loading={saving}
      />
    </div>
  );
}
