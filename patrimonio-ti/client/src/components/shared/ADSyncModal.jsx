import { useState, useEffect } from 'react';
import { Loader2, Search, UserCheck, RefreshCw, AlertTriangle, Building2, ChevronDown, ChevronUp, Users, FolderPlus } from 'lucide-react';
import Modal from './Modal';
import { useDebounce } from '@/hooks/useDebounce';
import { searchADUsers, importUsersFromAD, syncADBulk } from '@/services/userService';
import { listAllSavedOUs } from '@/services/savedOUService';
import { toast } from '@/store/toastStore';
import { cn } from '@/utils/cn';
import { formatDateTime } from '@/utils/formatters';

// ---------- Seção de resultado detalhado ----------
function CollapsibleSection({ title, count, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 text-sm font-medium text-gray-700 hover:bg-gray-100"
      >
        <span>{title} {count !== undefined && <span className="text-gray-400 font-normal">({count})</span>}</span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && <div className="px-3 py-2">{children}</div>}
    </div>
  );
}

function SyncResult({ result }) {
  const hasErrors = result.errors?.length > 0;
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-gray-800">Sincronização concluída</p>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
        {result.total !== undefined && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-center">
            <p className="text-lg font-bold text-gray-700">{result.total}</p>
            <p className="text-gray-500">Total</p>
          </div>
        )}
        <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-center">
          <p className="text-lg font-bold text-green-700">{result.imported ?? 0}</p>
          <p className="text-green-600">Novos</p>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-center">
          <p className="text-lg font-bold text-blue-700">{result.updated ?? 0}</p>
          <p className="text-blue-600">Atualizados</p>
        </div>
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-center">
          <p className="text-lg font-bold text-indigo-700">{result.sectorsCreated ?? 0}</p>
          <p className="text-indigo-600">Novos Setores</p>
        </div>
        <div className={cn('rounded-lg border px-3 py-2 text-center', hasErrors ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50')}>
          <p className={cn('text-lg font-bold', hasErrors ? 'text-red-700' : 'text-gray-400')}>{result.errors?.length ?? 0}</p>
          <p className={hasErrors ? 'text-red-600' : 'text-gray-400'}>Erros</p>
        </div>
      </div>

      {/* Novos usuários */}
      {(result.importedUsers?.length > 0 || result.imported === 0) && (
        <CollapsibleSection
          title="Novos usuários importados"
          count={result.importedUsers?.length ?? 0}
          defaultOpen={(result.importedUsers?.length ?? 0) > 0}
        >
          {!result.importedUsers?.length ? (
            <p className="text-xs text-gray-400">Nenhum usuário novo nesta sincronização.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="text-gray-500"><th className="text-left py-1">Username</th><th className="text-left py-1">Nome</th><th className="text-left py-1">Setor</th></tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {result.importedUsers.map((u) => (
                    <tr key={u.username}>
                      <td className="py-1 font-mono text-gray-600">{u.username}</td>
                      <td className="py-1 text-gray-800">{u.displayName}</td>
                      <td className="py-1 text-gray-500">{u.sector || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CollapsibleSection>
      )}

      {/* Novos setores */}
      {result.newSectors !== undefined && (
        <CollapsibleSection
          title="Novos setores criados"
          count={result.newSectors.length}
          defaultOpen={result.newSectors.length > 0}
        >
          {result.newSectors.length === 0 ? (
            <p className="text-xs text-gray-400">Nenhum setor novo nesta sincronização.</p>
          ) : (
            <ul className="space-y-1">
              {result.newSectors.map((s) => (
                <li key={s.name} className="text-xs">
                  <span className="font-medium text-gray-800">{s.name}</span>
                  {s.description && s.description !== s.name && (
                    <span className="text-gray-400 ml-1">— {s.description}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CollapsibleSection>
      )}

      {/* Usuários atualizados */}
      {result.updatedUsers !== undefined && (
        <CollapsibleSection title="Usuários atualizados" count={result.updatedUsers.length} defaultOpen={false}>
          {result.updatedUsers.length === 0 ? (
            <p className="text-xs text-gray-400">Nenhum usuário atualizado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="text-gray-500"><th className="text-left py-1">Username</th><th className="text-left py-1">Nome</th><th className="text-left py-1">Setor</th></tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {result.updatedUsers.map((u) => (
                    <tr key={u.username}>
                      <td className="py-1 font-mono text-gray-600">{u.username}</td>
                      <td className="py-1 text-gray-800">{u.displayName}</td>
                      <td className="py-1 text-gray-500">{u.sector || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CollapsibleSection>
      )}

      {/* Erros */}
      {hasErrors && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <p className="text-xs font-medium text-red-700 mb-1">{result.errors.length} erro(s):</p>
          <ul className="space-y-0.5">
            {result.errors.map((e) => (
              <li key={e.username} className="text-xs text-red-600">{e.username}: {e.error}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

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
      if (result.sectorsCreated > 0) toast.info(`${result.sectorsCreated} setor(es) criado(s) automaticamente.`);
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

      {importSummary && <SyncResult result={importSummary} />}

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
  const [savedOUs, setSavedOUs]       = useState([]);
  const [selectedOU, setSelectedOU]   = useState(null);
  const [ouSearch, setOuSearch]       = useState('');
  const [ouPath, setOuPath]           = useState('');
  const [manualMode, setManualMode]   = useState(false);
  const [syncing, setSyncing]         = useState(false);
  const [preview, setPreview]         = useState(null);
  const [adError, setAdError]         = useState('');

  useEffect(() => {
    listAllSavedOUs()
      .then(setSavedOUs)
      .catch(() => setSavedOUs([]));
  }, []);

  const filteredOUs = savedOUs.filter((ou) =>
    ou.name.toLowerCase().includes(ouSearch.toLowerCase())
  );

  const handleSelectOU = (ou) => {
    setSelectedOU(ou);
    setOuPath(ou.ouPath);
  };

  const effectivePath = selectedOU ? selectedOU.ouPath : (manualMode ? ouPath : '');

  const handleSync = async () => {
    if (!effectivePath.trim()) return;
    setSyncing(true);
    setAdError('');
    setPreview(null);
    try {
      const result = await syncADBulk(effectivePath.trim());
      setPreview(result);
      const total = result.imported + result.updated;
      if (total > 0) {
        toast.success(`OU sincronizada: ${result.imported} importado(s), ${result.updated} atualizado(s).`);
        onImported?.();
      } else if (result.total === 0) {
        toast.warning('Nenhum usuário encontrado na OU informada.');
      }
      if (result.sectorsCreated > 0) toast.info(`${result.sectorsCreated} setor(es) criado(s) automaticamente.`);
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
          Usuários já existentes têm seus dados atualizados.
        </p>
      </div>

      {/* Seletor de OUs salvas */}
      {savedOUs.length > 0 && (
        <div>
          <label className="label">Selecionar OU salva</label>
          <input
            className="input mb-2"
            placeholder="Filtrar OUs por nome..."
            value={ouSearch}
            onChange={(e) => setOuSearch(e.target.value)}
          />
          <div className="border border-gray-200 rounded-lg max-h-44 overflow-y-auto divide-y divide-gray-100">
            {filteredOUs.length === 0 ? (
              <p className="px-3 py-2 text-sm text-gray-400">Nenhuma OU encontrada.</p>
            ) : (
              filteredOUs.map((ou) => (
                <button
                  key={ou._id}
                  type="button"
                  onClick={() => handleSelectOU(ou)}
                  className={cn(
                    'w-full text-left px-3 py-2.5 text-sm transition-colors',
                    selectedOU?._id === ou._id
                      ? 'bg-primary-50 text-primary-700'
                      : 'hover:bg-gray-50 text-gray-700'
                  )}
                >
                  <p className="font-medium">{ou.name}</p>
                  <p className="text-xs text-gray-400 font-mono truncate">{ou.ouPath}</p>
                  {ou.lastSyncAt && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Última sync: {formatDateTime(ou.lastSyncAt)}
                      {ou.lastSyncResult?.imported != null && (
                        <span className="ml-2">· {ou.lastSyncResult.imported} novo(s), {ou.lastSyncResult.updated} atualizado(s)</span>
                      )}
                    </p>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* DN selecionado (somente leitura) */}
      {selectedOU && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm">
          <p className="text-xs text-gray-500 mb-1">DN selecionado (somente leitura):</p>
          <p className="font-mono text-xs text-gray-700 break-all">{selectedOU.ouPath}</p>
          <button
            type="button"
            onClick={() => { setSelectedOU(null); setOuPath(''); }}
            className="text-xs text-primary-600 hover:text-primary-800 mt-1"
          >
            Limpar seleção
          </button>
        </div>
      )}

      {/* Campo manual (fallback) */}
      <div>
        <button
          type="button"
          onClick={() => setManualMode((m) => !m)}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 mb-2"
        >
          {manualMode ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          {manualMode ? 'Ocultar campo manual' : 'Ou digitar DN manualmente'}
        </button>
        {manualMode && !selectedOU && (
          <div>
            <input
              className="input font-mono text-sm"
              placeholder="Ex: OU=Exemplo,DC=empresa,DC=com,DC=br"
              value={ouPath}
              onChange={(e) => setOuPath(e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">
              Informe o DN completo da OU. Todos os usuários da OU e suas sub-OUs serão sincronizados.
            </p>
          </div>
        )}
      </div>

      {adError && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          {adError}
        </div>
      )}

      {preview && <SyncResult result={preview} />}

      <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
        <button
          type="button"
          onClick={handleSync}
          disabled={!effectivePath.trim() || syncing}
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
