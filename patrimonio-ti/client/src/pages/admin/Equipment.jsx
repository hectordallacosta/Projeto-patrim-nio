import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plus, Pencil, Trash2, Link, Unlink, Settings, Loader2,
  ChevronUp, ChevronDown, ChevronsUpDown, X, Filter, ArrowRightLeft,
} from 'lucide-react';
import PageTitle from '@/components/shared/PageTitle';
import Modal from '@/components/shared/Modal';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import Pagination from '@/components/shared/Pagination';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import {
  listEquipment, createEquipment, updateEquipment,
  assignEquipment, unassignEquipment, changeEquipmentStatus, deleteEquipment,
} from '@/services/equipmentService';
import { listAllEquipmentModels } from '@/services/equipmentModelService';
import { listEquipmentTypes } from '@/services/equipmentTypeService';
import { listUsers } from '@/services/userService';
import { listSectors } from '@/services/sectorService';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDate, statusLabel, statusColor } from '@/utils/formatters';
import { toast } from '@/store/toastStore';
import { cn } from '@/utils/cn';

const STATUS_OPTIONS = ['available', 'assigned', 'maintenance', 'decommissioned'];
const STATUS_CARD_COLOR = {
  available:     'border-green-200 bg-green-50 text-green-700',
  assigned:      'border-blue-200 bg-blue-50 text-blue-700',
  maintenance:   'border-yellow-200 bg-yellow-50 text-yellow-700',
  decommissioned:'border-gray-200 bg-gray-50 text-gray-600',
};

// ---------- SortIcon ----------
function SortIcon({ field, sort, sortDir }) {
  if (sort !== field) return <ChevronsUpDown size={13} className="text-gray-300" />;
  return sortDir === 'asc'
    ? <ChevronUp size={13} className="text-primary-600" />
    : <ChevronDown size={13} className="text-primary-600" />;
}

// ---------- Autocomplete genérico ----------
function Autocomplete({ items, value, onChange, getLabel, placeholder }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const filtered = items.filter((i) =>
    getLabel(i).toLowerCase().includes(search.toLowerCase())
  );
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

// ---------- EquipmentForm ----------
function EquipmentForm({ initial, equipmentModels, onSubmit, onCancel, loading }) {
  const [form, setForm] = useState({
    equipmentModel: '',
    serialNumber: '',
    patrimonyNumber: '',
    notes: '',
    ...initial,
    equipmentModel: initial?.equipmentModel?._id || initial?.equipmentModel || '',
    patrimonyNumber: initial?.patrimonyNumber || '',
  });
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const selectedModel = equipmentModels.find((m) => m._id === form.equipmentModel);

  const modelLabel = (m) => {
    let label = `${m.brand} ${m.model}`;
    if (m.lot) label += ` — ${m.lot}`;
    return label;
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
      {/* Seleção do modelo */}
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

      {/* Informações herdadas do modelo (somente leitura) */}
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
            {selectedModel.purchaseDate && (
              <span><span className="text-blue-500 text-xs">Compra:</span> {formatDate(selectedModel.purchaseDate)}</span>
            )}
          </div>
        </div>
      )}

      {/* Campos individuais do equipamento */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Nº Série</label>
          <input
            className="input font-mono"
            value={form.serialNumber}
            onChange={(e) => set('serialNumber', e.target.value)}
            placeholder="Ex: 1A2B3C4D"
          />
        </div>
        <div>
          <label className="label">Nº Patrimônio *</label>
          <input
            className="input font-mono"
            value={form.patrimonyNumber}
            onChange={(e) => set('patrimonyNumber', e.target.value)}
            placeholder="Ex: 001234"
            required
          />
        </div>
        <div className="col-span-2">
          <label className="label">Observações específicas deste equipamento</label>
          <textarea
            className="input resize-none"
            rows={2}
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Opcional — informações particulares deste ativo"
          />
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

// ---------- AssignForm ----------
function AssignForm({ equipment, sectors, onSubmit, onCancel, loading }) {
  const isTransfer = equipment.assignedTo || equipment.assignedSector;
  const [target, setTarget] = useState('user');
  const [assignedTo, setAssignedTo] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [assignedSector, setAssignedSector] = useState('');
  const [note, setNote] = useState('');

  const [userQuery, setUserQuery] = useState('');
  const [userResults, setUserResults] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const debouncedUserQuery = useDebounce(userQuery, 300);
  const userRef = useRef(null);

  useEffect(() => {
    if (!debouncedUserQuery) {
      setUserResults([]);
      setHasSearched(false);
      return;
    }
    setLoadingUsers(true);
    setHasSearched(true);
    listUsers({ search: debouncedUserQuery, isActive: 'true', limit: 20 })
      .then((r) => setUserResults(r.data || []))
      .catch(() => setUserResults([]))
      .finally(() => setLoadingUsers(false));
  }, [debouncedUserQuery]);

  useEffect(() => {
    const handler = (e) => { if (!userRef.current?.contains(e.target)) setUserDropdownOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    setAssignedTo(user._id);
    setUserQuery(`${user.displayName} (${user.username})`);
    setUserDropdownOpen(false);
  };

  const em = equipment.equipmentModel;
  const selectedSector = sectors.find((s) => s._id === assignedSector);

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
      {/* Info do equipamento */}
      <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm border border-gray-200">
        <p className="font-semibold text-gray-800">{em?.brand} {em?.model}</p>
        <p className="text-gray-500 font-mono text-xs mt-0.5">
          {equipment.patrimonyNumber && <span className="mr-3">PAT: {equipment.patrimonyNumber}</span>}
          SN: {equipment.serialNumber}
        </p>
      </div>

      {/* Alerta de transferência */}
      {isTransfer && (
        <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-sm text-yellow-800">
          <ArrowRightLeft size={15} className="shrink-0 mt-0.5" />
          <span>
            Atualmente vinculado a{' '}
            <strong>{equipment.assignedTo?.displayName || equipment.assignedSector?.name}</strong>.
            Selecione o novo destino para transferir.
          </span>
        </div>
      )}

      <div>
        <label className="label">Vincular a</label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="radio" value="user" checked={target === 'user'} onChange={() => setTarget('user')} />
            Usuário
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="radio" value="sector" checked={target === 'sector'} onChange={() => setTarget('sector')} />
            Setor
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
              onChange={(e) => { setUserQuery(e.target.value); setSelectedUser(null); setAssignedTo(''); setUserDropdownOpen(true); }}
              onFocus={() => setUserDropdownOpen(true)}
            />
            {userDropdownOpen && (
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
                      {u.sector?.name && <span className="text-xs text-gray-400 ml-1">· {u.sector.name}</span>}
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
          <Autocomplete
            items={sectors}
            value={assignedSector}
            onChange={setAssignedSector}
            getLabel={(s) => s.name}
            placeholder="Digite para buscar setor..."
          />
        </div>
      )}

      {/* Confirmação inline */}
      {(selectedUser || selectedSector) && (
        <div className="bg-primary-50 border border-primary-200 rounded-lg px-3 py-2 text-sm text-primary-800">
          {isTransfer ? 'Transferir' : 'Vincular'}{' '}
          <strong>{em?.brand} {em?.model}</strong>
          {equipment.patrimonyNumber && ` (${equipment.patrimonyNumber})`}
          {' '}para{' '}
          <strong>{selectedUser ? `${selectedUser.displayName} (${selectedUser.username})` : selectedSector?.name}</strong>?
        </div>
      )}

      <div>
        <label className="label">Observação</label>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opcional — registrado no histórico" />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancelar</button>
        <button
          type="submit"
          className="btn-primary"
          disabled={loading || (target === 'user' ? !assignedTo : !assignedSector)}
        >
          {loading && <Loader2 size={14} className="animate-spin" />}
          {isTransfer ? 'Transferir' : 'Vincular'}
        </button>
      </div>
    </form>
  );
}

// ---------- StatusForm ----------
function StatusForm({ current, onSubmit, onCancel, loading }) {
  const [status, setStatus] = useState(current);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(status); }} className="space-y-4">
      <div>
        <label className="label">Novo Status</label>
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{statusLabel[s]}</option>)}
        </select>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancelar</button>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading && <Loader2 size={14} className="animate-spin" />} Confirmar
        </button>
      </div>
    </form>
  );
}

// ---------- Page ----------
export default function Equipment() {
  const [searchParams, setSearchParams] = useSearchParams();

  const search  = searchParams.get('search') || '';
  const status  = searchParams.get('status') || '';
  const typeId  = searchParams.get('type') || '';
  const sectorId= searchParams.get('sector') || '';
  const sort    = searchParams.get('sort') || 'createdAt';
  const sortDir = searchParams.get('sortDir') || 'desc';
  const page    = parseInt(searchParams.get('page') || '1');
  const limit   = parseInt(searchParams.get('limit') || '20');

  const [searchInput, setSearchInput] = useState(search);
  const debouncedSearch = useDebounce(searchInput, 300);

  const [data, setData]         = useState([]);
  const [pagination, setPagination] = useState(null);
  const [stats, setStats]       = useState(null);
  const [loading, setLoading]   = useState(true);
  const [types, setTypes]       = useState([]);
  const [equipmentModels, setEquipmentModels] = useState([]);
  const [sectors, setSectors]   = useState([]);
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

  useEffect(() => {
    if (search !== searchInput) setSearchInput(search);
  }, [search]);

  const setParam = (key, value) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      next.delete('page');
      return next;
    }, { replace: true });
  };

  const setSort = (field) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (prev.get('sort') === field) {
        next.set('sortDir', prev.get('sortDir') === 'asc' ? 'desc' : 'asc');
      } else {
        next.set('sort', field);
        next.set('sortDir', 'asc');
      }
      return next;
    }, { replace: true });
  };

  const clearFilters = () => setSearchParams({}, { replace: true });
  const activeCount = [search, status, typeId, sectorId].filter(Boolean).length;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listEquipment({
        page, limit,
        search: search || undefined,
        status: status || undefined,
        type: typeId || undefined,
        assignedSector: sectorId || undefined,
        sort, sortDir,
      });
      setData(res.data);
      setPagination(res.pagination);
    } finally { setLoading(false); }
  }, [page, limit, search, status, typeId, sectorId, sort, sortDir]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    Promise.all([
      listEquipment({ limit: 1 }),
      listEquipment({ limit: 1, status: 'available' }),
      listEquipment({ limit: 1, status: 'assigned' }),
      listEquipment({ limit: 1, status: 'maintenance' }),
      listEquipment({ limit: 1, status: 'decommissioned' }),
    ]).then(([all, av, as, mt, dc]) => {
      setStats({
        total:         all.pagination.total,
        available:     av.pagination.total,
        assigned:      as.pagination.total,
        maintenance:   mt.pagination.total,
        decommissioned:dc.pagination.total,
      });
    });
  }, []);

  useEffect(() => {
    listEquipmentTypes().then(setTypes);
    listAllEquipmentModels().then(setEquipmentModels);
    listSectors({ limit: 200 }).then((r) => setSectors(r.data));
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
        await createEquipment(form);
        toast.success('Equipamento cadastrado com sucesso!');
      } else {
        await updateEquipment(modal.item._id, form);
        toast.success('Equipamento atualizado.');
      }
      setModal(null); load();
    } catch (err) {
      const code = err.response?.data?.code;
      if (code === 'PATRIMONY_NUMBER_DUPLICATE') {
        toast.error('Número de patrimônio já está em uso por outro equipamento.');
      } else if (code === 'SERIAL_NUMBER_DUPLICATE') {
        toast.error('Número de série já está em uso por outro equipamento.');
      } else {
        toast.error(err.response?.data?.message || 'Erro ao salvar.');
      }
    } finally { setSaving(false); }
  };

  const handleAssign = async (form) => {
    setSaving(true);
    try {
      await assignEquipment(modal.item._id, form);
      const isTransfer = modal.item.assignedTo || modal.item.assignedSector;
      toast.success(isTransfer ? 'Equipamento transferido com sucesso!' : 'Equipamento vinculado com sucesso!');
      setModal(null); load();
    } catch (err) {
      const code = err.response?.data?.code;
      if (code === 'USER_INACTIVE') {
        toast.error('Este usuário está desativado. Reative-o antes de atribuir equipamentos.');
      } else {
        toast.error(err.response?.data?.message || 'Erro ao vincular.');
      }
    } finally { setSaving(false); }
  };

  const handleUnassign = async () => {
    setSaving(true);
    try {
      await unassignEquipment(confirm.item._id, '');
      toast.success('Equipamento desvinculado.');
      setConfirm(null); load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro ao desvincular.');
      setConfirm(null);
    } finally { setSaving(false); }
  };

  const handleStatus = async (s) => {
    setSaving(true);
    try {
      await changeEquipmentStatus(modal.item._id, s);
      toast.success(`Status alterado para "${statusLabel[s]}".`);
      setModal(null); load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro ao alterar status.');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await deleteEquipment(confirm.item._id);
      toast.success('Equipamento excluído.');
      setConfirm(null); load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro ao excluir.');
      setConfirm(null);
    } finally { setSaving(false); }
  };

  const Th = ({ field, children, className }) => (
    <th
      className={cn('text-left px-4 py-3 font-medium text-gray-600 select-none', field && 'cursor-pointer hover:text-gray-900', className)}
      onClick={field ? () => setSort(field) : undefined}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {field && <SortIcon field={field} sort={sort} sortDir={sortDir} />}
      </span>
    </th>
  );

  // Helper para exibir nome do equipamento a partir do modelo populado
  const equipName = (item) => {
    const em = item.equipmentModel;
    if (!em) return '—';
    return `${em.brand} ${em.model}`;
  };

  return (
    <div className="space-y-4">
      <PageTitle
        title="Equipamentos"
        action={
          <button className="btn-primary" onClick={() => setModal({ mode: 'create' })}>
            <Plus size={16} /> Novo Equipamento
          </button>
        }
      />

      {/* Cards de resumo */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { key: null,            label: 'Total',      value: stats.total,          cls: 'border-gray-200 bg-white text-gray-700' },
            { key: 'available',     label: 'Disponível', value: stats.available,      cls: STATUS_CARD_COLOR.available },
            { key: 'assigned',      label: 'Atribuído',  value: stats.assigned,       cls: STATUS_CARD_COLOR.assigned },
            { key: 'maintenance',   label: 'Manutenção', value: stats.maintenance,    cls: STATUS_CARD_COLOR.maintenance },
            { key: 'decommissioned',label: 'Desativado', value: stats.decommissioned, cls: STATUS_CARD_COLOR.decommissioned },
          ].map(({ key, label, value, cls }) => (
            <button
              key={label}
              onClick={() => setParam('status', key === status ? '' : key)}
              className={cn(
                'rounded-xl border p-4 text-left transition-all hover:shadow-md',
                cls,
                key && key === status && 'ring-2 ring-offset-1 ring-current'
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
            placeholder="Buscar por série, patrimônio, marca, modelo ou lote..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <select className="input w-auto" value={status} onChange={(e) => setParam('status', e.target.value)}>
          <option value="">Todos os status</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{statusLabel[s]}</option>)}
        </select>
        <select className="input w-auto" value={typeId} onChange={(e) => setParam('type', e.target.value)}>
          <option value="">Todos os tipos</option>
          {types.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
        </select>
        <select className="input w-auto" value={sectorId} onChange={(e) => setParam('sector', e.target.value)}>
          <option value="">Todos os setores</option>
          {sectors.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
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
            message={activeCount > 0 ? 'Nenhum equipamento encontrado com esses filtros.' : 'Nenhum equipamento cadastrado.'}
            action={activeCount > 0 ? <button className="btn-secondary mt-3" onClick={clearFilters}>Limpar filtros</button> : null}
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <Th field="patrimonyNumber">Patrimônio</Th>
                <Th>Tipo</Th>
                <Th>Marca/Modelo</Th>
                <Th field="serialNumber" className="hidden md:table-cell">Nº Série</Th>
                <Th field="status">Status</Th>
                <Th className="hidden xl:table-cell">Vinculado a</Th>
                <Th className="hidden xl:table-cell">Lote</Th>
                <th className="px-4 py-3 w-32" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.map((item) => (
                <tr key={item._id} className="hover:bg-gray-50 group">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{item.patrimonyNumber || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{item.equipmentModel?.type?.name || '—'}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{equipName(item)}</td>
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs hidden md:table-cell">{item.serialNumber}</td>
                  <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                  <td className="px-4 py-3 text-gray-500 hidden xl:table-cell text-xs">
                    {item.assignedTo?.displayName || item.assignedSector?.name || '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-400 hidden xl:table-cell text-xs font-mono">
                    {item.equipmentModel?.lot || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setModal({ mode: 'edit', item })} className="p-1.5 text-gray-400 hover:text-primary-600 rounded" title="Editar">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => setModal({ mode: 'status', item })} className="p-1.5 text-gray-400 hover:text-yellow-600 rounded" title="Alterar status">
                        <Settings size={14} />
                      </button>
                      {item.assignedTo || item.assignedSector ? (
                        <>
                          <button onClick={() => setModal({ mode: 'assign', item })} className="p-1.5 text-gray-400 hover:text-blue-600 rounded" title="Transferir">
                            <ArrowRightLeft size={14} />
                          </button>
                          <button onClick={() => setConfirm({ action: 'unassign', item })} className="p-1.5 text-gray-400 hover:text-orange-600 rounded" title="Desvincular">
                            <Unlink size={14} />
                          </button>
                        </>
                      ) : (
                        item.status === 'available' && (
                          <button onClick={() => setModal({ mode: 'assign', item })} className="p-1.5 text-gray-400 hover:text-blue-600 rounded" title="Vincular">
                            <Link size={14} />
                          </button>
                        )
                      )}
                      <button onClick={() => setConfirm({ action: 'delete', item })} className="p-1.5 text-gray-400 hover:text-red-600 rounded" title="Excluir">
                        <Trash2 size={14} />
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
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>
            Exibindo {(page - 1) * limit + 1}–{Math.min(page * limit, pagination.total)} de {pagination.total} equipamentos
          </span>
          <div className="flex items-center gap-2">
            <span>Por página:</span>
            <select
              className="input w-auto py-1 text-xs"
              value={limit}
              onChange={(e) => setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                next.set('limit', e.target.value);
                next.delete('page');
                return next;
              }, { replace: true })}
            >
              {[10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
      )}
      <Pagination pagination={pagination} onPageChange={setPage} />

      {/* Modais */}
      <Modal
        open={modal?.mode === 'create' || modal?.mode === 'edit'}
        onClose={() => setModal(null)}
        title={modal?.mode === 'create' ? 'Novo Equipamento' : 'Editar Equipamento'}
        size="lg"
      >
        {(modal?.mode === 'create' || modal?.mode === 'edit') && (
          <EquipmentForm
            initial={modal.item}
            equipmentModels={equipmentModels}
            onSubmit={handleSave}
            onCancel={() => setModal(null)}
            loading={saving}
          />
        )}
      </Modal>

      <Modal
        open={modal?.mode === 'assign'}
        onClose={() => setModal(null)}
        title={modal?.item?.assignedTo || modal?.item?.assignedSector ? 'Transferir Equipamento' : 'Vincular Equipamento'}
      >
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

      <Modal open={modal?.mode === 'status'} onClose={() => setModal(null)} title="Alterar Status" size="sm">
        {modal?.mode === 'status' && (
          <StatusForm current={modal.item.status} onSubmit={handleStatus} onCancel={() => setModal(null)} loading={saving} />
        )}
      </Modal>

      <ConfirmDialog
        open={confirm?.action === 'unassign'}
        onClose={() => setConfirm(null)}
        onConfirm={handleUnassign}
        title="Desvincular Equipamento"
        message={`Desvincular "${equipName(confirm?.item || {})}" de ${confirm?.item?.assignedTo?.displayName || confirm?.item?.assignedSector?.name}? O histórico será registrado.`}
        loading={saving}
      />
      <ConfirmDialog
        open={confirm?.action === 'delete'}
        onClose={() => setConfirm(null)}
        onConfirm={handleDelete}
        title="Excluir Equipamento"
        message={`Excluir "${equipName(confirm?.item || {})}" (${confirm?.item?.serialNumber})? Esta ação não pode ser desfeita.`}
        loading={saving}
      />
    </div>
  );
}
