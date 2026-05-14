import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Package, UserPlus, PackageOpen, PackagePlus, Plus } from 'lucide-react';
import Pagination from '@/components/shared/Pagination';
import EmptyState from '@/components/shared/EmptyState';
import Modal from '@/components/shared/Modal';
import RetrieveForm from '@/components/shared/RetrieveForm';
import SendToStockForm from '@/components/shared/SendToStockForm';
import { getStock, listStockEquipment, retrieveEquipment } from '@/services/stockService';
import { createEquipment, assignEquipment, sendEquipmentToStock } from '@/services/equipmentService';
import { listAllEquipmentModels } from '@/services/equipmentModelService';
import { listUsers } from '@/services/userService';
import { listSectors } from '@/services/sectorService';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDate } from '@/utils/formatters';
import { toast } from '@/store/toastStore';
import { cn } from '@/utils/cn';

// ---------- Autocomplete genérico ----------
function Autocomplete({ items, value, onChange, getLabel, placeholder }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const filtered = items.filter((i) => getLabel(i).toLowerCase().includes(search.toLowerCase()));
  const selected = items.find((i) => i._id === value);

  useEffect(() => {
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <input
        className="input"
        placeholder={selected ? getLabel(selected) : placeholder}
        value={open ? search : (selected ? getLabel(selected) : '')}
        onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
        onFocus={() => { setOpen(true); setSearch(''); }}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.slice(0, 30).map((item) => (
            <button
              key={item._id}
              type="button"
              onClick={() => { onChange(item._id); setOpen(false); setSearch(''); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-primary-50 hover:text-primary-700"
            >
              {getLabel(item)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- StockEquipmentForm (cadastro com estoque pré-selecionado) ----------
function StockEquipmentForm({ equipmentModels, onSubmit, onCancel, loading }) {
  const [form, setForm] = useState({ equipmentModel: '', serialNumber: '', patrimonyNumber: '', notes: '' });
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const selectedModel = equipmentModels.find((m) => m._id === form.equipmentModel);
  const modelLabel = (m) => `${m.brand} ${m.model}${m.lot ? ` — ${m.lot}` : ''}`;

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
      <div>
        <label className="label">Modelo *</label>
        <Autocomplete
          items={equipmentModels}
          value={form.equipmentModel}
          onChange={(id) => set('equipmentModel', id)}
          getLabel={modelLabel}
          placeholder="Selecione o modelo de equipamento..."
        />
      </div>

      {selectedModel && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm space-y-1">
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">Dados herdados do modelo</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-blue-800">
            <span><span className="text-blue-500 text-xs">Tipo:</span> {selectedModel.type?.name || '—'}</span>
            <span><span className="text-blue-500 text-xs">Marca:</span> {selectedModel.brand}</span>
            <span><span className="text-blue-500 text-xs">Modelo:</span> {selectedModel.model}</span>
            {selectedModel.lot && <span><span className="text-blue-500 text-xs">Lote:</span> {selectedModel.lot}</span>}
            {selectedModel.warrantyExpiry && (
              <span><span className="text-blue-500 text-xs">Garantia até:</span> {formatDate(selectedModel.warrantyExpiry)}</span>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Nº Série</label>
          <input className="input font-mono" value={form.serialNumber} onChange={(e) => set('serialNumber', e.target.value)} placeholder="Ex: 1A2B3C4D" />
        </div>
        <div>
          <label className="label">Nº Patrimônio *</label>
          <input className="input font-mono" value={form.patrimonyNumber} onChange={(e) => set('patrimonyNumber', e.target.value)} placeholder="Ex: 001234" required />
        </div>
        <div className="col-span-2">
          <label className="label">Observações</label>
          <textarea className="input resize-none" rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Opcional" />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancelar</button>
        <button type="submit" className="btn-primary" disabled={loading || !form.equipmentModel || !form.patrimonyNumber}>
          {loading && <Loader2 size={14} className="animate-spin" />} Salvar
        </button>
      </div>
    </form>
  );
}

// ---------- AssignForm simplificado para StockDetail ----------
function AssignForm({ equipment, sectors, onSubmit, onCancel, loading }) {
  const [target, setTarget]           = useState('user');
  const [assignedTo, setAssignedTo]   = useState('');
  const [assignedSector, setAssignedSector] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [note, setNote]               = useState('');
  const [userQuery, setUserQuery]     = useState('');
  const [userResults, setUserResults] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const debouncedQuery = useDebounce(userQuery, 300);
  const userRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (!userRef.current?.contains(e.target)) setDropdownOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!debouncedQuery) { setUserResults([]); setHasSearched(false); return; }
    setLoadingUsers(true); setHasSearched(true);
    listUsers({ search: debouncedQuery, isActive: 'true', limit: 20 })
      .then((r) => setUserResults(r.data || []))
      .catch(() => setUserResults([]))
      .finally(() => setLoadingUsers(false));
  }, [debouncedQuery]);

  const handleSelectUser = (u) => {
    setSelectedUser(u); setAssignedTo(u._id);
    setUserQuery(`${u.displayName} (${u.username})`);
    setDropdownOpen(false);
  };

  const em = equipment.equipmentModel;
  const selectedSectorObj = sectors.find((s) => s._id === assignedSector);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      assignedTo: target === 'user' ? assignedTo : null,
      assignedSector: target === 'sector' ? assignedSector : null,
      note,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm border border-gray-200">
        <p className="font-semibold text-gray-800">{em?.brand} {em?.model}</p>
        <p className="text-gray-500 font-mono text-xs mt-0.5">PAT: {equipment.patrimonyNumber}</p>
      </div>

      <div>
        <label className="label">Vincular a</label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="radio" value="user" checked={target === 'user'} onChange={() => setTarget('user')} /> Usuário
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="radio" value="sector" checked={target === 'sector'} onChange={() => setTarget('sector')} /> Setor
          </label>
        </div>
      </div>

      {target === 'user' ? (
        <div>
          <label className="label">Usuário *</label>
          <div ref={userRef} className="relative">
            <input
              className="input"
              placeholder="Buscar usuário por nome ou login..."
              value={userQuery}
              onChange={(e) => { setUserQuery(e.target.value); setSelectedUser(null); setAssignedTo(''); setDropdownOpen(true); }}
              onFocus={() => setDropdownOpen(true)}
            />
            {dropdownOpen && (
              <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {loadingUsers ? (
                  <div className="flex justify-center py-3"><Loader2 size={16} className="animate-spin text-gray-400" /></div>
                ) : !hasSearched ? (
                  <p className="px-3 py-2 text-sm text-gray-400">Digite o nome ou usuário para buscar...</p>
                ) : userResults.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-gray-400">Nenhum usuário encontrado.</p>
                ) : (
                  userResults.map((u) => (
                    <button
                      key={u._id}
                      type="button"
                      onClick={() => handleSelectUser(u)}
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
        </div>
      ) : (
        <div>
          <label className="label">Setor *</label>
          <select className="input" value={assignedSector} onChange={(e) => setAssignedSector(e.target.value)}>
            <option value="">Selecione o setor...</option>
            {sectors.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
          </select>
        </div>
      )}

      {(selectedUser || selectedSectorObj) && (
        <div className="bg-primary-50 border border-primary-200 rounded-lg px-3 py-2 text-sm text-primary-800">
          Vincular <strong>{em?.brand} {em?.model}</strong> ({equipment.patrimonyNumber}) para{' '}
          <strong>{selectedUser ? `${selectedUser.displayName} (${selectedUser.username})` : selectedSectorObj?.name}</strong>
        </div>
      )}

      <div>
        <label className="label">Observação</label>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opcional" />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancelar</button>
        <button
          type="submit"
          className="btn-primary"
          disabled={loading || (target === 'user' ? !assignedTo : !assignedSector)}
        >
          {loading && <Loader2 size={14} className="animate-spin" />} Vincular
        </button>
      </div>
    </form>
  );
}

// ---------- Página ----------
export default function StockDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [stock, setStock]             = useState(null);
  const [data, setData]               = useState([]);
  const [pagination, setPagination]   = useState(null);
  const [loading, setLoading]         = useState(true);
  const [stockLoading, setStockLoading] = useState(true);
  const [page, setPage]               = useState(1);
  const [modal, setModal]             = useState(null);
  const [sectors, setSectors]         = useState([]);
  const [equipmentModels, setEquipmentModels] = useState([]);
  const [saving, setSaving]           = useState(false);

  useEffect(() => {
    getStock(id)
      .then(setStock)
      .catch(() => navigate('/admin/stocks'))
      .finally(() => setStockLoading(false));
    listSectors({ limit: 200 }).then((r) => setSectors(r.data));
    listAllEquipmentModels().then(setEquipmentModels);
  }, [id]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listStockEquipment(id, { page, limit: 20 });
      setData(res.data);
      setPagination(res.pagination);
    } finally { setLoading(false); }
  }, [id, page]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (form) => {
    setSaving(true);
    try {
      await createEquipment({ ...form, stock: id });
      toast.success('Equipamento cadastrado no estoque!');
      setModal(null); load();
    } catch (err) {
      const code = err.response?.data?.code;
      if (code === 'PATRIMONY_NUMBER_DUPLICATE') {
        toast.error('Número de patrimônio já está em uso por outro equipamento.');
      } else if (code === 'SERIAL_NUMBER_DUPLICATE') {
        toast.error('Número de série já está em uso por outro equipamento.');
      } else {
        toast.error(err.response?.data?.message || 'Erro ao cadastrar equipamento.');
      }
    } finally { setSaving(false); }
  };

  const handleAssign = async (form) => {
    setSaving(true);
    try {
      await assignEquipment(modal.item._id, form);
      toast.success('Equipamento atribuído com sucesso!');
      setModal(null); load();
    } catch (err) {
      const code = err.response?.data?.code;
      if (code === 'USER_INACTIVE') toast.error('Este usuário está desativado.');
      else toast.error(err.response?.data?.message || 'Erro ao atribuir.');
    } finally { setSaving(false); }
  };

  const handleRetrieve = async (sectorId) => {
    setSaving(true);
    try {
      await retrieveEquipment(modal.item._id, sectorId);
      toast.success('Equipamento retirado do estoque e disponível no setor.');
      setModal(null); load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro ao retirar do estoque.');
    } finally { setSaving(false); }
  };

  const handleSendToStock = async (stockId) => {
    setSaving(true);
    try {
      await sendEquipmentToStock(modal.item._id, stockId);
      toast.success('Equipamento movido para outro estoque.');
      setModal(null); load();
    } catch (err) {
      const code = err.response?.data?.code;
      if (code === 'EQUIPMENT_ALREADY_IN_STOCK') {
        toast.error('O equipamento já está neste estoque.');
      } else {
        toast.error(err.response?.data?.message || 'Erro ao mover para estoque.');
      }
    } finally { setSaving(false); }
  };

  const equipName = (item) => {
    const em = item.equipmentModel;
    if (!em) return '—';
    return `${em.brand} ${em.model}`;
  };

  if (stockLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary-600" size={28} /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/admin/stocks')} className="p-1.5 text-gray-400 hover:text-gray-700 rounded">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <Package size={20} className="text-indigo-500" /> {stock?.name}
            </h1>
            {stock?.manager?.displayName && (
              <p className="text-sm text-gray-500 mt-0.5">
                <span>Responsável: {stock.manager.displayName}</span>
              </p>
            )}
            {stock?.description && <p className="text-xs text-gray-400 mt-0.5">{stock.description}</p>}
          </div>
        </div>
        <button className="btn-primary" onClick={() => setModal({ mode: 'create' })}>
          <Plus size={16} /> Novo Equipamento
        </button>
      </div>

      {pagination && (
        <p className="text-xs text-gray-500">
          {pagination.total} equipamento(s) em estoque
        </p>
      )}

      <div className="card overflow-x-auto">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary-600" size={24} /></div>
        ) : data.length === 0 ? (
          <EmptyState message="Nenhum equipamento neste estoque." />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Patrimônio</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Modelo</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Série</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Notas</th>
                <th className="px-4 py-3 w-24" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.map((item) => (
                <tr key={item._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{item.patrimonyNumber || '—'}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <p>{equipName(item)}</p>
                    <p className="text-xs text-gray-400">{item.equipmentModel?.type?.name || ''}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs hidden md:table-cell">{item.serialNumber || '—'}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs hidden lg:table-cell">{item.notes || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => setModal({ mode: 'assign', item })}
                        className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
                        title="Atribuir a usuário/setor"
                      >
                        <UserPlus size={15} />
                      </button>
                      <button
                        onClick={() => setModal({ mode: 'retrieve', item })}
                        className="p-1.5 text-gray-400 hover:text-indigo-600 rounded"
                        title="Retirar do estoque"
                      >
                        <PackageOpen size={15} />
                      </button>
                      <button
                        onClick={() => setModal({ mode: 'sendToStock', item })}
                        className="p-1.5 text-gray-400 hover:text-violet-600 rounded"
                        title="Mover para outro estoque"
                      >
                        <PackagePlus size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Pagination pagination={pagination} onPageChange={setPage} />

      <Modal open={modal?.mode === 'create'} onClose={() => setModal(null)} title="Novo Equipamento" size="lg">
        {modal?.mode === 'create' && (
          <StockEquipmentForm
            equipmentModels={equipmentModels}
            onSubmit={handleCreate}
            onCancel={() => setModal(null)}
            loading={saving}
          />
        )}
      </Modal>

      <Modal open={modal?.mode === 'assign'} onClose={() => setModal(null)} title="Atribuir Equipamento">
        {modal?.mode === 'assign' && (
          <AssignForm
            equipment={modal.item}
            sectors={sectors}
            onSubmit={handleAssign}
            onCancel={() => setModal(null)}
            loading={saving}
          />
        )}
      </Modal>

      <Modal open={modal?.mode === 'retrieve'} onClose={() => setModal(null)} title="Retirar do Estoque" size="sm">
        {modal?.mode === 'retrieve' && (
          <RetrieveForm
            equipment={modal.item}
            sectors={sectors}
            onSubmit={handleRetrieve}
            onCancel={() => setModal(null)}
            loading={saving}
          />
        )}
      </Modal>

      <Modal open={modal?.mode === 'sendToStock'} onClose={() => setModal(null)} title="Mover para Outro Estoque" size="sm">
        {modal?.mode === 'sendToStock' && (
          <SendToStockForm
            equipment={modal.item}
            onSubmit={handleSendToStock}
            onCancel={() => setModal(null)}
            loading={saving}
          />
        )}
      </Modal>
    </div>
  );
}
