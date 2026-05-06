import { useState, useEffect } from 'react';
import { Monitor, Building2, Loader2 } from 'lucide-react';
import PageTitle from '@/components/shared/PageTitle';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import { getMyEquipment } from '@/services/userService';
import { useAuth } from '@/hooks/useAuth';
import { formatDate } from '@/utils/formatters';
import { cn } from '@/utils/cn';

function OriginBadge({ item, userId }) {
  const mine = item.assignedTo?._id === userId || item.assignedTo === userId;
  return mine ? (
    <span className="badge bg-primary-100 text-primary-700 gap-1">
      <Monitor size={11} /> Seu equipamento
    </span>
  ) : (
    <span className="badge bg-purple-100 text-purple-700 gap-1">
      <Building2 size={11} /> Setor
    </span>
  );
}

export default function MyEquipment() {
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getMyEquipment()
      .then(setData)
      .catch(() => setError('Não foi possível carregar os equipamentos.'))
      .finally(() => setLoading(false));
  }, []);

  const mine = data.filter(
    (e) => e.assignedTo?._id === user?.id || e.assignedTo === user?.id
  );
  const sector = data.filter(
    (e) => e.assignedSector && e.assignedTo?._id !== user?.id && e.assignedTo !== user?.id
  );

  return (
    <div>
      <PageTitle
        title="Meus Equipamentos"
        subtitle="Equipamentos atribuídos a você e ao seu setor"
      />

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-primary-600" size={28} />
        </div>
      ) : data.length === 0 ? (
        <EmptyState message="Nenhum equipamento atribuído a você ou ao seu setor." />
      ) : (
        <div className="space-y-6">
          {mine.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                <Monitor size={15} /> Atribuídos a você ({mine.length})
              </h2>
              <EquipmentTable items={mine} userId={user?.id} />
            </section>
          )}

          {sector.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                <Building2 size={15} /> Do seu setor ({sector.length})
              </h2>
              <EquipmentTable items={sector} userId={user?.id} />
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function EquipmentTable({ items, userId }) {
  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Marca / Modelo</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Nº Série</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Patrimônio</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Origem</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600 hidden xl:table-cell">Atribuído em</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map((item) => {
            const em = item.equipmentModel;
            return (
              <tr key={item._id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500">{em?.type?.name || '—'}</td>
                <td className="px-4 py-3 font-medium text-gray-900">
                  {em ? `${em.brand} ${em.model}` : '—'}
                </td>
                <td className="px-4 py-3 text-gray-500 hidden md:table-cell font-mono text-xs">
                  {item.serialNumber}
                </td>
                <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">
                  {item.patrimonyNumber || '—'}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={item.status} />
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <OriginBadge item={item} userId={userId} />
                </td>
                <td className="px-4 py-3 text-gray-500 hidden xl:table-cell">
                  {formatDate(item.assignmentDate)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
