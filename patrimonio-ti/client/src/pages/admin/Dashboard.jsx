import { useState, useEffect } from 'react';
import { Monitor, UserCheck, Wrench, Users } from 'lucide-react';
import PageTitle from '@/components/shared/PageTitle';
import { listEquipment } from '@/services/equipmentService';
import { listUsers } from '@/services/userService';

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

export default function Dashboard() {
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      listEquipment({ limit: 1 }),
      listEquipment({ limit: 1, status: 'assigned' }),
      listEquipment({ limit: 1, status: 'maintenance' }),
      listUsers({ limit: 1 }),
    ]).then(([all, assigned, maintenance, users]) => {
      setStats({
        total: all.pagination?.total,
        assigned: assigned.pagination?.total,
        maintenance: maintenance.pagination?.total,
        users: users.pagination?.total,
      });
    }).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageTitle title="Dashboard" subtitle="Visão geral do patrimônio de TI" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Monitor} label="Total de Equipamentos" value={loading ? '…' : stats.total} color="bg-primary-600" />
        <StatCard icon={UserCheck} label="Atribuídos" value={loading ? '…' : stats.assigned} color="bg-green-500" />
        <StatCard icon={Wrench} label="Em Manutenção" value={loading ? '…' : stats.maintenance} color="bg-yellow-500" />
        <StatCard icon={Users} label="Usuários" value={loading ? '…' : stats.users} color="bg-purple-500" />
      </div>
    </div>
  );
}
