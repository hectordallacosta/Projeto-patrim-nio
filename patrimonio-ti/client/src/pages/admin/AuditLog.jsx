import { useState, useEffect, useCallback } from 'react';
import { Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import PageTitle from '@/components/shared/PageTitle';
import Pagination from '@/components/shared/Pagination';
import EmptyState from '@/components/shared/EmptyState';
import { listAuditLogs } from '@/services/auditLogService';
import { usePagination } from '@/hooks/usePagination';
import { formatDateTime } from '@/utils/formatters';
import { cn } from '@/utils/cn';

const ACTION_COLORS = {
  CREATE: 'bg-green-100 text-green-800',
  UPDATE: 'bg-blue-100 text-blue-800',
  DELETE: 'bg-red-100 text-red-800',
  ASSIGN: 'bg-purple-100 text-purple-800',
  UNASSIGN: 'bg-orange-100 text-orange-800',
  STATUS_CHANGE: 'bg-yellow-100 text-yellow-800',
  IMPORT_AD: 'bg-teal-100 text-teal-800',
  SYNC_AD: 'bg-teal-100 text-teal-800',
};

const ENTITIES = ['Equipment', 'User', 'Sector', 'SectorType', 'EquipmentType'];
const ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'ASSIGN', 'UNASSIGN', 'STATUS_CHANGE', 'IMPORT_AD', 'SYNC_AD'];

function DiffRow({ label, before, after }) {
  if (before === after) return null;
  const beforeStr = before == null ? '—' : JSON.stringify(before);
  const afterStr = after == null ? '—' : JSON.stringify(after);
  return (
    <tr>
      <td className="py-1 pr-3 text-gray-500 align-top font-mono text-xs">{label}</td>
      <td className="py-1 pr-3 text-red-600 align-top font-mono text-xs line-through">{beforeStr}</td>
      <td className="py-1 text-green-700 align-top font-mono text-xs">{afterStr}</td>
    </tr>
  );
}

function DiffViewer({ before, after }) {
  if (!before && !after) return <p className="text-xs text-gray-400 italic">Sem dados de diff.</p>;

  const keys = Array.from(new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ])).filter((k) => !['__v', 'assignmentHistory', 'updatedAt'].includes(k));

  const changed = keys.filter((k) => JSON.stringify((before ?? {})[k]) !== JSON.stringify((after ?? {})[k]));

  if (!changed.length) return <p className="text-xs text-gray-400 italic">Nenhuma alteração detectada.</p>;

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-gray-400">
          <th className="text-left py-1 pr-3 font-medium">Campo</th>
          <th className="text-left py-1 pr-3 font-medium">Antes</th>
          <th className="text-left py-1 font-medium">Depois</th>
        </tr>
      </thead>
      <tbody>
        {changed.map((k) => (
          <DiffRow key={k} label={k} before={(before ?? {})[k]} after={(after ?? {})[k]} />
        ))}
      </tbody>
    </table>
  );
}

function LogRow({ log }) {
  const [open, setOpen] = useState(false);
  const hasDiff = log.before || log.after;

  return (
    <>
      <tr
        className={cn('hover:bg-gray-50 cursor-pointer', open && 'bg-gray-50')}
        onClick={() => hasDiff && setOpen((o) => !o)}
      >
        <td className="px-4 py-3">
          <span className={cn('badge', ACTION_COLORS[log.action] ?? 'bg-gray-100 text-gray-600')}>
            {log.action}
          </span>
        </td>
        <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{log.entity}</td>
        <td className="px-4 py-3 font-mono text-xs text-gray-400 hidden lg:table-cell">
          {String(log.entityId).slice(-8)}
        </td>
        <td className="px-4 py-3 text-gray-600 hidden md:table-cell">
          {log.performedBy?.displayName ?? log.performedBy?.username ?? '—'}
        </td>
        <td className="px-4 py-3 text-gray-400 text-xs hidden xl:table-cell">
          {log.ip ?? '—'}
        </td>
        <td className="px-4 py-3 text-gray-400 text-xs">{formatDateTime(log.createdAt)}</td>
        <td className="px-4 py-3 w-8 text-gray-300">
          {hasDiff && (open ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
        </td>
      </tr>
      {open && hasDiff && (
        <tr className="bg-gray-50 border-b">
          <td colSpan={7} className="px-6 py-3">
            <DiffViewer before={log.before} after={log.after} />
          </td>
        </tr>
      )}
    </>
  );
}

export default function AuditLog() {
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const { page, limit, setPage, reset } = usePagination(50);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listAuditLogs({
        page, limit,
        entity: entityFilter || undefined,
        action: actionFilter || undefined,
        from: from || undefined,
        to: to || undefined,
      });
      setData(res.data);
      setPagination(res.pagination);
    } finally {
      setLoading(false);
    }
  }, [page, limit, entityFilter, actionFilter, from, to]);

  useEffect(() => { load(); }, [load]);

  const handleFilter = (setter) => (e) => { setter(e.target.value); reset(); };

  return (
    <div>
      <PageTitle title="Audit Log" subtitle="Histórico de todas as operações do sistema" />

      <div className="flex flex-wrap gap-3 mb-4">
        <select className="input w-auto" value={entityFilter} onChange={handleFilter(setEntityFilter)}>
          <option value="">Todas as entidades</option>
          {ENTITIES.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <select className="input w-auto" value={actionFilter} onChange={handleFilter(setActionFilter)}>
          <option value="">Todas as ações</option>
          {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <input type="date" className="input w-auto" value={from} onChange={handleFilter(setFrom)} title="De" />
          <span className="text-gray-400 text-sm">até</span>
          <input type="date" className="input w-auto" value={to} onChange={handleFilter(setTo)} title="Até" />
        </div>
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-primary-600" size={24} />
          </div>
        ) : data.length === 0 ? (
          <EmptyState message="Nenhum registro encontrado." />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Ação</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Entidade</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">ID</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Usuário</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden xl:table-cell">IP</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Data/Hora</th>
                <th className="px-4 py-3 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.map((log) => <LogRow key={log._id} log={log} />)}
            </tbody>
          </table>
        )}
      </div>

      <Pagination pagination={pagination} onPageChange={setPage} />
    </div>
  );
}
