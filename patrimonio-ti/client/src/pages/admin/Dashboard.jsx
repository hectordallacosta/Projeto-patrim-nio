import { useState, useEffect } from 'react';
import { Monitor, UserCheck, Wrench, Users, Warehouse } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from 'recharts';
import PageTitle from '@/components/shared/PageTitle';
import { listEquipment } from '@/services/equipmentService';
import { listUsers } from '@/services/userService';
import {
  getAnalyticsBySector,
  getAnalyticsByType,
  getAnalyticsByModelSector,
  getAnalyticsRecent,
} from '@/services/equipmentService';
import { toast } from '@/store/toastStore';
import { formatDate } from '@/utils/formatters';

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#14b8a6', '#8b5cf6'];

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className={`rounded-full p-3 ${color}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-semibold text-gray-900">{value ?? '—'}</p>
      </div>
    </div>
  );
}

function ChartSkeleton() {
  return <div className="h-[300px] animate-pulse rounded-xl bg-gray-100" />;
}

function EmptyChart({ message = 'Sem dados para exibir' }) {
  return (
    <div className="h-[300px] flex items-center justify-center text-sm text-gray-400">
      {message}
    </div>
  );
}

function transformModelSectorData(rawData) {
  const top5Sectors = rawData.slice(0, 5);
  const modelTotals = {};
  top5Sectors.forEach(({ models }) => {
    models.forEach(({ model, total }) => {
      modelTotals[model] = (modelTotals[model] || 0) + total;
    });
  });
  const topModels = Object.entries(modelTotals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([model]) => model);

  const chartData = top5Sectors.map(({ sector, models }) => {
    const row = { sector };
    const modelMap = Object.fromEntries(models.map(({ model, total }) => [model, total]));
    topModels.forEach((m) => { row[m] = modelMap[m] || 0; });
    return row;
  });

  return { chartData, topModels };
}

export default function Dashboard() {
  const [stats, setStats] = useState({});
  const [loadingStats, setLoadingStats] = useState(true);

  const [bySectorData, setBySectorData]           = useState([]);
  const [byTypeData, setByTypeData]               = useState([]);
  const [byModelSectorData, setByModelSectorData] = useState({ chartData: [], topModels: [] });
  const [recentData, setRecentData]               = useState([]);
  const [loadingCharts, setLoadingCharts]         = useState(true);

  useEffect(() => {
    Promise.all([
      listEquipment({ limit: 1 }),
      listEquipment({ limit: 1, status: 'assigned' }),
      listEquipment({ limit: 1, status: 'maintenance' }),
      listEquipment({ limit: 1, status: 'in_stock' }),
      listUsers({ limit: 1 }),
    ]).then(([all, assigned, maintenance, inStock, users]) => {
      setStats({
        total: all.pagination?.total,
        assigned: assigned.pagination?.total,
        maintenance: maintenance.pagination?.total,
        in_stock: inStock.pagination?.total,
        users: users.pagination?.total,
      });
    }).finally(() => setLoadingStats(false));
  }, []);

  useEffect(() => {
    async function loadAnalytics() {
      try {
        const [sector, type, modelSector, recent] = await Promise.all([
          getAnalyticsBySector(),
          getAnalyticsByType(),
          getAnalyticsByModelSector(),
          getAnalyticsRecent(),
        ]);
        setBySectorData(sector || []);
        setByTypeData(type || []);
        setByModelSectorData(transformModelSectorData(modelSector || []));
        setRecentData(recent || []);
      } catch {
        toast.error('Erro ao carregar dados analíticos do dashboard.');
      } finally {
        setLoadingCharts(false);
      }
    }
    loadAnalytics();
  }, []);

  return (
    <div className="space-y-6">
      <PageTitle title="Dashboard" subtitle="Visão geral do patrimônio de TI" />

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard icon={Monitor}   label="Ativos em Uso"          value={loadingStats ? '…' : stats.total}       color="bg-primary-600" />
        <StatCard icon={UserCheck} label="Atribuídos"            value={loadingStats ? '…' : stats.assigned}    color="bg-green-500" />
        <StatCard icon={Warehouse} label="Em Estoque"            value={loadingStats ? '…' : stats.in_stock}    color="bg-indigo-500" />
        <StatCard icon={Wrench}    label="Em Manutenção"         value={loadingStats ? '…' : stats.maintenance} color="bg-yellow-500" />
        <StatCard icon={Users}     label="Usuários"              value={loadingStats ? '…' : stats.users}       color="bg-purple-500" />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico 1 — Ativos por Setor */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Ativos por Setor</h3>
          {loadingCharts ? <ChartSkeleton /> : bySectorData.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={bySectorData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="sector" width={90} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => [`${value} ativos`, 'Total']} />
                <Bar dataKey="total" fill="#6366f1" radius={[0, 4, 4, 0]}>
                  {bySectorData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Gráfico 2 — Distribuição por Tipo */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Distribuição por Tipo de Equipamento</h3>
          {loadingCharts ? <ChartSkeleton /> : byTypeData.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={byTypeData}
                  dataKey="total"
                  nameKey="type"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  label={({ type, percent }) => `${type} (${(percent * 100).toFixed(0)}%)`}
                  labelLine={false}
                >
                  {byTypeData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name) => [`${value} equipamentos`, name]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Gráfico 3 — Modelos por Setor */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Modelos Atribuídos por Setor (top 5)</h3>
        {loadingCharts ? <ChartSkeleton /> : byModelSectorData.chartData.length === 0 ? <EmptyChart /> : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={byModelSectorData.chartData} margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="sector" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              {byModelSectorData.topModels.map((modelName, i) => (
                <Bar key={modelName} dataKey={modelName} stackId="a" fill={COLORS[i % COLORS.length]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Tabela — Últimos 10 Equipamentos Atribuídos */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Últimos 10 Equipamentos Atribuídos</h3>
        {loadingCharts ? (
          <div className="h-40 animate-pulse rounded-xl bg-gray-100" />
        ) : recentData.length === 0 ? (
          <EmptyChart message="Nenhum equipamento atribuído recentemente." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Patrimônio</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Modelo</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Atribuído a</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentData.map((eq) => (
                  <tr key={eq._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">{eq.patrimonyNumber}</td>
                    <td className="px-4 py-3">
                      {eq.equipmentModel ? `${eq.equipmentModel.brand} ${eq.equipmentModel.model}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {eq.assignedTo?.displayName ?? eq.assignedSector?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {formatDate(eq.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
