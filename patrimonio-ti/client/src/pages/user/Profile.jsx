import { useState, useEffect } from 'react';
import { User, Building2, Shield, Clock, Tag, Loader2 } from 'lucide-react';
import PageTitle from '@/components/shared/PageTitle';
import { getMe } from '@/services/authService';
import { formatDateTime, roleLabel } from '@/utils/formatters';
import { cn } from '@/utils/cn';

function InfoRow({ icon: Icon, label, value, mono = false }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b last:border-0">
      <div className="mt-0.5 text-gray-400 shrink-0">
        <Icon size={16} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-400 mb-0.5">{label}</p>
        <p className={cn('text-sm text-gray-900 break-all', mono && 'font-mono')}>{value || '—'}</p>
      </div>
    </div>
  );
}

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getMe()
      .then(setProfile)
      .catch(() => setError('Não foi possível carregar o perfil.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageTitle title="Meu Perfil" subtitle="Dados sincronizados com o Active Directory" />

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-primary-600" size={28} />
        </div>
      ) : profile ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* avatar + nome */}
          <div className="card p-6 flex flex-col items-center text-center gap-3">
            <div className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center">
              <User size={36} className="text-primary-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-lg">{profile.displayName}</p>
              <p className="text-sm text-gray-500">{profile.username}</p>
            </div>
            <span
              className={cn(
                'badge',
                profile.role === 'admin'
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-gray-100 text-gray-600'
              )}
            >
              {roleLabel[profile.role] ?? profile.role}
            </span>
            <span
              className={cn(
                'badge',
                profile.isActive
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-700'
              )}
            >
              {profile.isActive ? 'Ativo' : 'Inativo'}
            </span>
          </div>

          {/* detalhes */}
          <div className="card p-5 md:col-span-2">
            <h2 className="text-sm font-semibold text-gray-700 mb-1">Informações da conta</h2>
            <InfoRow icon={User} label="Nome completo" value={profile.displayName} />
            <InfoRow icon={User} label="Usuário de rede" value={profile.username} mono />
            <InfoRow icon={Tag} label="E-mail" value={profile.email} mono />
            <InfoRow
              icon={Building2}
              label="Setor"
              value={
                profile.sector
                  ? `${profile.sector.name}${profile.sector.type?.name ? ` · ${profile.sector.type.name}` : ''}`
                  : null
              }
            />
            <InfoRow icon={Tag} label="Departamento (AD)" value={profile.adDepartment} />
            <InfoRow icon={Shield} label="Perfil de acesso" value={roleLabel[profile.role] ?? profile.role} />
            <InfoRow
              icon={Clock}
              label="Último login"
              value={formatDateTime(profile.lastLogin)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
