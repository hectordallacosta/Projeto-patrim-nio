import { useState, useEffect } from 'react';
import { Loader2, Search, UserCheck, RefreshCw, AlertTriangle, Building2 } from 'lucide-react';
import Modal from './Modal';
import { useDebounce } from '@/hooks/useDebounce';
import { searchADUsers, importUsersFromAD, syncADBulk } from '@/services/userService';
import { toast } from '@/store/toastStore';
import { cn } from '@/utils/cn';

// ---------- Aba: Buscar por nome ----------
function SearchTab({ onImported }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState([]);
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [adError, setAdError] = useState('');
  const [importSummary, setImportSummary] = useState(null);

  const debouncedQuery = useDebounce(query, 400);

  useEffect(() => {
    if (debouncedQuery.trim().length < 2) {
      setResults([]);
      setAdError('');
      return;
    }
    setSearching(true);
    setAdError('');
    searchADUsers(debouncedQuery)
      .then(setResults)
      .catch((err) => {
        setResults([]);
        setAdError(err.response?.data?.message || 'Erro ao buscar no Active Directory.');
      })
      .finally(() => setSearching(false));
  }, [debouncedQuery]);

  const toggleSelect = (username) =>
    setSelected((prev) =>
      prev.includes(username) ? prev.filter((u) => u !== username) : [...prev, username]
    );

  const toggleAll = () => {
    if (selected.length === results.length) setSelected([]);
    else setSelected(results.map((u) => u.username));
  };

  const handleImport = async () => {
    if (!selected.length) return;
    setImporting(true);
    try {
      const result = await importUsersFromAD(selected);
      setImportSummary(result);
      const total = result.imported + result.updated;
      if (total > 0) {
        toast.success(`${result.imported} importado(s), ${result.updated} atualizado(s).`);
        onImported?.();
      }
      if (result.errors.length > 0) toast.error(`${result.errors.length} erro(s) na importação.`);
      setSelected([]);
      setQuery('');
      setResults([]);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro ao importar usuários.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="input pl-9"
          placeholder="Buscar por nome, usuário ou e-mail..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        {searching && (
          <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />
        )}
      </div>

      {!query && !importSummary && (
        <p className="text-sm text-gray-400 text-center py-4">
          Digite o nome ou username para buscar usuários no Active Directory.
        </p>
      )}

      {adError && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          {adError}
        </div>
      )}

      {query.trim().length === 1 && (
        <p className="text-xs text-gray-400 text-center">Digite ao menos 2 caracteres para buscar.</p>
      )}

      {importSummary && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm">
          <p className="font-semibold text-green-800 mb-1">Importação concluída</p>
          <ul className="text-green-700 space-y-0.5">
            <li>{importSummary.imported} usuário(s) novo(s) importado(s)</li>
            <li>{importSummary.updated} usuário(s) atualizado(s)</li>
            {importSummary.errors.length > 0 && (
              <li className="text-red-600">
                {importSummary.errors.length} erro(s): {importSummary.errors.map((e) => e.username).join(', ')}
              </li>
            )}
          </ul>
        </div>
      )}

      {results.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 border-b px-3 py-2 flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={selected.length === results.length && results.length > 0}
                onChange={toggleAll}
                className="w-3.5 h-3.5"
              />
              {results.length} resultado(s) — {selected.length} selecionado(s)
            </label>
          </div>
          <div className="max-h-56 overflow-y-auto divide-y divide-gray-100">
            {results.map((user) => (
              <label
                key={user.username}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-primary-50 transition-colors',
                  selected.includes(user.username) && 'bg-primary-50'
                )}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(user.username)}
                  onChange={() => toggleSelect(user.username)}
                  className="w-4 h-4 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{user.displayName}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {user.username}
                    {user.adDepartment && <span className="ml-2 text-gray-400">· {user.adDepartment}</span>}
                    {user.email && <span className="ml-2 text-gray-400">· {user.email}</span>}
                  </p>
                </div>
                {selected.includes(user.username) && (
                  <UserCheck size={14} className="text-primary-600 shrink-0" />
                )}
              </label>
            ))}
          </div>
        </div>
      )}

      {query.trim().length >= 2 && !searching && !adError && results.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-4">
          Nenhum usuário encontrado no AD para <strong>"{query}"</strong>.
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
        <button
          type="button"
          onClick={handleImport}
          disabled={selected.length === 0 || importing}
          className="btn-primary"
        >
          {importing
            ? <><Loader2 size={14} className="animate-spin" /> Importando...</>
            : <><RefreshCw size={14} /> Importar {selected.length > 0 ? `(${selected.length})` : ''}</>
          }
        </button>
      </div>
    </div>
  );
}

// ---------- Aba: Importar por OU ----------
function OUSyncTab({ onImported }) {
  const [ouPath, setOuPath] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [preview, setPreview] = useState(null);
  const [adError, setAdError] = useState('');

  const handleSync = async () => {
    if (!ouPath.trim()) return;
    setSyncing(true);
    setAdError('');
    setPreview(null);
    try {
      const result = await syncADBulk(ouPath.trim());
      setPreview(result);
      const total = result.imported + result.updated;
      if (total > 0) {
        toast.success(`OU sincronizada: ${result.imported} importado(s), ${result.updated} atualizado(s).`);
        onImported?.();
      } else if (result.total === 0) {
        toast.warning('Nenhum usuário encontrado na OU informada.');
      }
      if (result.errors.length > 0) toast.error(`${result.errors.length} erro(s) na sincronização.`);
    } catch (err) {
      setAdError(err.response?.data?.message || 'Erro ao sincronizar a OU.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
        <p className="font-semibold mb-1">Sincronização em lote por Unidade Organizacional</p>
        <p className="text-blue-700 text-xs">
          Importa ou atualiza <strong>todos os usuários</strong> de uma OU do Active Directory de uma vez.
          Usuários já existentes têm seus dados atualizados. Útil para onboarding de novos departamentos.
        </p>
      </div>

      <div>
        <label className="label">Caminho da OU (Distinguished Name)</label>
        <input
          className="input font-mono text-sm"
          placeholder="Ex: OU=SEASC,DC=seasc,DC=sc,DC=gov,DC=br"
          value={ouPath}
          onChange={(e) => setOuPath(e.target.value)}
          autoFocus
        />
        <p className="text-xs text-gray-400 mt-1">
          Informe o DN completo da OU. Todos os usuários da OU e suas sub-OUs serão sincronizados.
        </p>
      </div>

      {adError && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          {adError}
        </div>
      )}

      {preview && (
        <div className={cn(
          'rounded-lg px-4 py-3 text-sm border',
          preview.errors.length > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'
        )}>
          <p className={cn('font-semibold mb-2', preview.errors.length > 0 ? 'text-yellow-800' : 'text-green-800')}>
            Sincronização concluída
          </p>
          <ul className="space-y-0.5 text-sm">
            <li className="text-gray-700">Total de usuários na OU: <strong>{preview.total}</strong></li>
            <li className="text-green-700">{preview.imported} novo(s) importado(s)</li>
            <li className="text-blue-700">{preview.updated} atualizado(s)</li>
            {preview.errors.length > 0 && (
              <li className="text-red-600 mt-1">
                {preview.errors.length} erro(s):
                <ul className="ml-4 mt-1 space-y-0.5">
                  {preview.errors.map((e) => (
                    <li key={e.username} className="text-xs">{e.username}: {e.error}</li>
                  ))}
                </ul>
              </li>
            )}
          </ul>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
        <button
          type="button"
          onClick={handleSync}
          disabled={!ouPath.trim() || syncing}
          className="btn-primary"
        >
          {syncing
            ? <><Loader2 size={14} className="animate-spin" /> Sincronizando...</>
            : <><Building2 size={14} /> Sincronizar OU</>
          }
        </button>
      </div>
    </div>
  );
}

// ---------- Modal principal com abas ----------
export default function ADSyncModal({ open, onClose, onImported }) {
  const [tab, setTab] = useState('search');

  useEffect(() => {
    if (open) setTab('search');
  }, [open]);

  const tabs = [
    { id: 'search', label: 'Buscar por nome' },
    { id: 'ou',     label: 'Importar por OU' },
  ];

  return (
    <Modal open={open} onClose={onClose} title="Sincronizar com Active Directory" size="lg">
      {/* Abas */}
      <div className="flex border-b border-gray-200 mb-4 -mt-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              tab === t.id
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'search' && <SearchTab onImported={onImported} />}
      {tab === 'ou'     && <OUSyncTab onImported={onImported} />}
    </Modal>
  );
}
