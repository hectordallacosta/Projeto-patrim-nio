import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, Loader2, X, Filter, Package } from 'lucide-react';
import PageTitle from '@/components/shared/PageTitle';
import Modal from '@/components/shared/Modal';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import Pagination from '@/components/shared/Pagination';
import EmptyState from '@/components/shared/EmptyState';
import { listEquipmentModels, createEquipmentModel, updateEquipmentModel, deleteEquipmentModel } from '@/services/equipmentModelService';
import { listEquipmentTypes } from '@/services/equipmentTypeService';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDate } from '@/utils/formatters';
import { toast } from '@/store/toastStore';
import { cn } from '@/utils/cn';

function ModelForm({ initial, types, onSubmit, onCancel, loading }) {
  const [form, setForm] = useState({
    type: '', brand: '', model: '', lot: '',
    purchaseDate: '', warrantyExpiry: '', notes: '', isActive: true,
    ...initial,
    type: initial?.type?._id || initial?.type || '',
    purchaseDate: initial?.purchaseDate ? initial.purchaseDate.slice(0, 10) : '',
    warrantyExpiry: initial?.warrantyExpiry ? initial.warrantyExpiry.slice(0, 10) : '',
  });
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="label">Tipo *</label>
          <select className="input" value={form.type} onChange={(e) => set('type', e.target.value)} required>
            <option value="">Selecione...</option>
            {types.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Marca *</label>
          <input className="input" value={form.brand} onChange={(e) => set('brand', e.target.value)} placeholder="Dell, HP, Lenovo..." required />
        </div>
        <div>
          <label className="label">Modelo *</label>
          <input className="input" value={form.model} onChange={(e) => set('model', e.target.value)} placeholder="OptiPlex 7010, ThinkPad E14..." required />
        </div>
        <div className="col-span-2">
          <label className="label">Lote / Processo</label>
          <input className="input" value={form.lot} onChange={(e) => set('lot', e.target.value)} placeholder="Ex: SEA 1212/2026" />
        </div>
        <div>
          <label className="label">Data de Compra</label>
          <input type="date" className="input" value={form.purchaseDate} onChange={(e) => set('purchaseDate', e.target.value)} />
        </div>
        <div>
          <label className="label">Garantia até</label>
          <input type="date" className="input" value={form.warrantyExpiry} onChange={(e) => set('warrantyExpiry', e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="label">Observações</label>
          <textarea className="input resize-none" rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </div>
        <div className="col-span-2 flex items-center gap-2">
          <input
            type="checkbox"
            id="isActive"
            checked={form.isActive}
            onChange={(e) => set('isActive', e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-primary-600"
          />
          <label htmlFor="isActive" className="text-sm text-gray-700 cursor-pointer">Modelo ativo (disponível para novos cadastros)</label>
        </div>
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

export default function EquipmentModels() {
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get('search') || '';
  const typeId = searchParams.get('type') || '';
  const page   = parseInt(searchParams.get('page') || '1');
  const limit  = parseInt(searchParams.get('limit') || '20');

  const [searchInput, setSearchInput] = useState(search);
  const debouncedSearch = useDebounce(searchInput, 300);

  const [data, setData]         = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [types, setTypes]       = useState([]);
  const [modal, setModal]       = useState(null);
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
  const activeCount = [search, typeId].filter(Boolean).length;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listEquipmentModels({
        page, limit,
        search: search || undefined,
        type: typeId || undefined,
      });
      setData(res.data);
      setPagination(res.pagination);
    } finally { setLoading(false); }
  }, [page, limit, search, typeId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { listEquipmentTypes().then(setTypes); }, []);

  const setPage = (p) => setSearchParams((prev) => {
    const next = new URLSearchParams(prev);
    next.set('page', String(p));
    return next;
  }, { replace: true });

  const handleSave = async (form) => {
    setSaving(true);
    try {
      if (modal.mode === 'create') {
        await createEquipmentModel(form);
        toast.success('Modelo cadastrado com sucesso!');
      } else {
        await updateEquipmentModel(modal.item._id, form);
        toast.success('Modelo atualizado.');
      }
      setModal(null); load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro ao salvar.');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await deleteEquipmentModel(confirm._id);
      toast.success('Modelo excluído.');
      setConfirm(null); load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro ao excluir.');
      setConfirm(null);
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <PageTitle
        title="Modelos de Equipamento"
        action={
          <button className="btn-primary" onClick={() => setModal({ mode: 'create' })}>
            <Plus size={16} /> Novo Modelo
          </button>
        }
      />

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex-1 min-w-48">
          <input
            className="input"
            placeholder="Buscar por marca, modelo ou lote..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <select className="input w-auto" value={typeId} onChange={(e) => setParam('type', e.target.value)}>
          <option value="">Todos os tipos</option>
          {types.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
        </select>
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
            message={activeCount > 0 ? 'Nenhum modelo encontrado com esses filtros.' : 'Nenhum modelo cadastrado.'}
            action={activeCount > 0 ? <button className="btn-secondary mt-3" onClick={clearFilters}>Limpar filtros</button> : null}
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Marca / Modelo</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Tipo</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Lote / Processo</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Garantia até</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden xl:table-cell">Equipamentos</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Status</th>
                <th className="px-4 py-3 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.map((item) => (
                <tr key={item._id} className={cn('hover:bg-gray-50', !item.isActive && 'opacity-60')}>
                  <td className="px-4 py-3 font-medium text-gray-900">{item.brand} {item.model}</td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell text-xs">{item.type?.name || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell text-xs font-mono">{item.lot || '—'}</td>
                  <td className="px-4 py-3 text-gray-400 hidden lg:table-cell text-xs">{formatDate(item.warrantyExpiry) || '—'}</td>
                  <td className="px-4 py-3 hidden xl:table-cell">
                    {item.equipmentCount > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs bg-primary-50 text-primary-700 rounded-full px-2 py-0.5">
                        <Package size={11} /> {item.equipmentCount}
                      </span>
                    ) : (
                      <span className="text-gray-300 text-xs">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
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
          {(page - 1) * limit + 1}–{Math.min(page * limit, pagination.total)} de {pagination.total} modelos
        </p>
      )}
      <Pagination pagination={pagination} onPageChange={setPage} />

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.mode === 'create' ? 'Novo Modelo de Equipamento' : 'Editar Modelo de Equipamento'}
        size="lg"
      >
        {modal && (
          <ModelForm
            initial={modal.item}
            types={types}
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
        title="Excluir Modelo"
        message={`Excluir "${confirm?.brand} ${confirm?.model}"? Esta ação não pode ser desfeita e só é permitida se não houver equipamentos vinculados.`}
        loading={saving}
      />
    </div>
  );
}
