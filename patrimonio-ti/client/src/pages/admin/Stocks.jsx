import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, Loader2, X, Filter, Package } from 'lucide-react';
import PageTitle from '@/components/shared/PageTitle';
import Modal from '@/components/shared/Modal';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import Pagination from '@/components/shared/Pagination';
import EmptyState from '@/components/shared/EmptyState';
import { listStocks, createStock, updateStock, deleteStock } from '@/services/stockService';
import { listUsers } from '@/services/userService';
import { useDebounce } from '@/hooks/useDebounce';
import { toast } from '@/store/toastStore';
import { cn } from '@/utils/cn';

function UserSearch({ value, onChange, placeholder = 'Buscar responsável...' }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const ref = useRef(null);
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!debouncedQuery) { setResults([]); return; }
    setLoading(true);
    listUsers({ search: debouncedQuery, isActive: 'true', limit: 15 })
      .then((r) => setResults(r.data || []))
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [debouncedQuery]);

  const handleSelect = (u) => {
    setSelected(u);
    setQuery(`${u.displayName} (${u.username})`);
    onChange(u._id);
    setOpen(false);
  };

  const handleClear = () => { setSelected(null); setQuery(''); onChange(null); };

  return (
    <div ref={ref} className="relative">
      <input
        className="input pr-8"
        placeholder={placeholder}
        value={query}
        onChange={(e) => { setQuery(e.target.value); setSelected(null); onChange(null); setOpen(true); }}
        onFocus={() => setOpen(true)}
      />
      {selected && (
        <button type="button" onClick={handleClear} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
          <X size={14} />
        </button>
      )}
      {open && query && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-3"><Loader2 size={16} className="animate-spin text-gray-400" /></div>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-400">Nenhum usuário encontrado.</p>
          ) : (
            results.map((u) => (
              <button
                key={u._id}
                type="button"
                onClick={() => handleSelect(u)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-primary-50 hover:text-primary-700"
              >
                <span className="font-medium">{u.displayName}</span>
                <span className="text-xs text-gray-400 ml-1">({u.username})</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function StockForm({ initial, onSubmit, onCancel, loading }) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    description: initial?.description || '',
    manager: initial?.manager?._id || initial?.manager || null,
    isActive: initial?.isActive !== undefined ? initial.isActive : true,
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
          placeholder="Ex: Estoque GETIC, Almoxarifado Central..."
          required
        />
      </div>

      <div>
        <label className="label">Descrição</label>
        <textarea
          className="input resize-none"
          rows={2}
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder="Localização física, observações..."
        />
      </div>

      <div>
        <label className="label">Responsável</label>
        <UserSearch value={form.manager} onChange={(id) => set('manager', id)} />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isActiveStock"
          checked={form.isActive}
          onChange={(e) => set('isActive', e.target.checked)}
          className="w-4 h-4 rounded border-gray-300 text-primary-600"
        />
        <label htmlFor="isActiveStock" className="text-sm text-gray-700 cursor-pointer">Estoque ativo</label>
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

export default function Stocks() {
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get('search') || '';
  const page   = parseInt(searchParams.get('page') || '1');
  const limit  = parseInt(searchParams.get('limit') || '20');

  const [searchInput, setSearchInput] = useState(search);
  const debouncedSearch = useDebounce(searchInput, 300);

  const [data, setData]           = useState([]);
  const [pagination, setPagination] = useState(null);
  const [stats, setStats]         = useState(null);
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
      const res = await listStocks({ page, limit, search: search || undefined });
      setData(res.data);
      setPagination(res.pagination);
    } finally { setLoading(false); }
  }, [page, limit, search]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    listStocks({ limit: 1 }).then((all) => setStats({ total: all.pagination.total }));
  }, []);

  const setPage = (p) => setSearchParams((prev) => {
    const next = new URLSearchParams(prev);
    next.set('page', String(p));
    return next;
  }, { replace: true });

  const handleSave = async (form) => {
    setSaving(true);
    try {
      if (modal.mode === 'create') {
        await createStock(form);
        toast.success('Estoque criado com sucesso!');
      } else {
        await updateStock(modal.item._id, form);
        toast.success('Estoque atualizado.');
      }
      setModal(null); load();
    } catch (err) {
      const code = err.response?.data?.code;
      if (code === 'STOCK_DUPLICATE') {
        toast.error('Já existe um estoque com este nome.');
      } else {
        toast.error(err.response?.data?.message || 'Erro ao salvar.');
      }
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await deleteStock(confirm._id);
      toast.success('Estoque excluído.');
      setConfirm(null); load();
    } catch (err) {
      const code = err.response?.data?.code;
      if (code === 'STOCK_IN_USE') {
        toast.error('Não é possível excluir: existem equipamentos neste estoque.');
      } else {
        toast.error(err.response?.data?.message || 'Erro ao excluir.');
      }
      setConfirm(null);
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <PageTitle
        title="Estoques"
        action={
          <button className="btn-primary" onClick={() => setModal({ mode: 'create' })}>
            <Plus size={16} /> Novo Estoque
          </button>
        }
      />

      {/* Cards de resumo */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-2xl font-bold text-gray-700">{stats.total}</p>
            <p className="text-xs font-medium mt-0.5 text-gray-500">Total de estoques</p>
          </div>
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
            <p className="text-2xl font-bold text-indigo-700">
              {data.reduce((sum, s) => sum + (s.equipmentCount || 0), 0)}
            </p>
            <p className="text-xs font-medium mt-0.5 text-indigo-600">Itens em estoque (pág. atual)</p>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex-1 min-w-48">
          <input
            className="input"
            placeholder="Buscar por nome ou descrição..."
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
            message={activeCount > 0 ? 'Nenhum estoque encontrado com esses filtros.' : 'Nenhum estoque cadastrado.'}
            action={activeCount > 0 ? <button className="btn-secondary mt-3" onClick={clearFilters}>Limpar filtros</button> : null}
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Nome</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Responsável</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Equipamentos</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 w-28" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.map((item) => (
                <tr key={item._id} className={cn('hover:bg-gray-50', !item.isActive && 'opacity-60')}>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <div className="flex items-center gap-2">
                      <Package size={14} className="text-indigo-500 shrink-0" />
                      <Link to={`/admin/stocks/${item._id}`} className="text-blue-600 hover:underline font-medium">
                        {item.name}
                      </Link>
                    </div>
                    {item.description && <p className="text-xs text-gray-400 mt-0.5 ml-5">{item.description}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell text-xs">{item.manager?.displayName || '—'}</td>
                  <td className="px-4 py-3">
                    {item.equipmentCount > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 rounded-full px-2 py-0.5">
                        <Package size={11} /> {item.equipmentCount}
                      </span>
                    ) : (
                      <span className="text-gray-300 text-xs">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('badge text-xs', item.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
                      {item.isActive ? 'Ativo' : 'Inativo'}
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
          {(page - 1) * limit + 1}–{Math.min(page * limit, pagination.total)} de {pagination.total} estoques
        </p>
      )}
      <Pagination pagination={pagination} onPageChange={setPage} />

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.mode === 'create' ? 'Novo Estoque' : 'Editar Estoque'}
        size="lg"
      >
        {modal && (
          <StockForm
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
        title="Excluir Estoque"
        message={`Excluir o estoque "${confirm?.name}"? Esta ação é bloqueada se houver equipamentos vinculados.`}
        loading={saving}
      />
    </div>
  );
}
