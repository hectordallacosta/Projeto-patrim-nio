import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import PageTitle from '@/components/shared/PageTitle';
import Modal from '@/components/shared/Modal';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import EmptyState from '@/components/shared/EmptyState';
import { listEquipmentTypes, createEquipmentType, updateEquipmentType, deleteEquipmentType } from '@/services/equipmentTypeService';

function TypeForm({ initial, onSubmit, onCancel, loading }) {
  const [form, setForm] = useState({ name: '', description: '', ...initial });
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
      <div>
        <label className="label">Nome *</label>
        <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} required />
      </div>
      <div>
        <label className="label">Descrição</label>
        <textarea className="input resize-none" rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancelar</button>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading && <Loader2 size={14} className="animate-spin" />}
          Salvar
        </button>
      </div>
    </form>
  );
}

export default function EquipmentTypes() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await listEquipmentTypes()); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (form) => {
    setSaving(true); setError('');
    try {
      if (modal.mode === 'create') await createEquipmentType(form);
      else await updateEquipmentType(modal.item._id, form);
      setModal(null); load();
    } catch (err) {
      setError(err.response?.data?.message || 'Erro ao salvar.');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setSaving(true); setError('');
    try {
      await deleteEquipmentType(confirm._id);
      setConfirm(null); load();
    } catch (err) {
      setError(err.response?.data?.message || 'Erro ao excluir.');
      setConfirm(null);
    } finally { setSaving(false); }
  };

  return (
    <div>
      <PageTitle
        title="Tipos de Equipamento"
        action={
          <button className="btn-primary" onClick={() => setModal({ mode: 'create' })}>
            <Plus size={16} /> Novo Tipo
          </button>
        }
      />

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-4">{error}</p>}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary-600" size={24} /></div>
        ) : items.length === 0 ? (
          <EmptyState message="Nenhum tipo de equipamento cadastrado." />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Nome</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Descrição</th>
                <th className="px-4 py-3 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => (
                <tr key={item._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{item.description || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setModal({ mode: 'edit', item })} className="p-1.5 text-gray-400 hover:text-primary-600 rounded">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => setConfirm(item)} className="p-1.5 text-gray-400 hover:text-red-600 rounded">
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

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.mode === 'create' ? 'Novo Tipo de Equipamento' : 'Editar Tipo de Equipamento'} size="sm">
        {modal && <TypeForm initial={modal.item} onSubmit={handleSave} onCancel={() => setModal(null)} loading={saving} />}
      </Modal>

      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} onConfirm={handleDelete} title="Excluir Tipo de Equipamento" message={`Deseja excluir "${confirm?.name}"?`} loading={saving} />
    </div>
  );
}
