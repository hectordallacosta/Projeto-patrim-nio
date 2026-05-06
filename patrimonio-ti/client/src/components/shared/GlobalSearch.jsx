import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Monitor, Users, Building2, Loader2, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useDebounce } from '@/hooks/useDebounce';
import api from '@/services/api';
import { statusLabel } from '@/utils/formatters';

function highlight(text = '', query = '') {
  if (!query.trim()) return text;
  const parts = text.split(new RegExp(`(${query.trim()})`, 'gi'));
  return parts.map((p, i) =>
    p.toLowerCase() === query.trim().toLowerCase()
      ? <mark key={i} className="bg-yellow-200 text-gray-900 rounded-sm px-0.5">{p}</mark>
      : p
  );
}

export default function GlobalSearch({ open, onClose }) {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults(null);
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  useEffect(() => {
    if (!debouncedQuery.trim()) { setResults(null); return; }
    setLoading(true);
    api.get('/search', { params: { q: debouncedQuery, limit: 5 } })
      .then((r) => { setResults(r.data.data); setActive(0); })
      .catch(() => setResults(null))
      .finally(() => setLoading(false));
  }, [debouncedQuery]);

  const allItems = results ? [
    ...results.equipment.map((e) => ({ ...e, _category: 'equipment' })),
    ...results.users.map((u) => ({ ...u, _category: 'user' })),
    ...results.sectors.map((s) => ({ ...s, _category: 'sector' })),
  ] : [];

  const handleSelect = useCallback((item) => {
    onClose();
    if (item._category === 'equipment') {
      navigate(`/admin/equipment?search=${encodeURIComponent(item.serialNumber)}`);
    } else if (item._category === 'user') {
      navigate(`/admin/users?search=${encodeURIComponent(item.username)}`);
    } else {
      navigate(`/admin/sectors?search=${encodeURIComponent(item.name)}`);
    }
  }, [navigate, onClose]);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((p) => Math.min(p + 1, allItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((p) => Math.max(p - 1, 0));
    } else if (e.key === 'Enter' && allItems[active]) {
      handleSelect(allItems[active]);
    }
  };

  if (!open) return null;

  const hasResults = results && (results.equipment.length || results.users.length || results.sectors.length);

  const renderGroup = (items, label, Icon, categoryKey) => {
    if (!items.length) return null;
    const offset = categoryKey === 'equipment' ? 0
      : categoryKey === 'user' ? results.equipment.length
      : results.equipment.length + results.users.length;

    return (
      <div>
        <p className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
        {items.map((item, i) => {
          const globalIdx = offset + i;
          const isActive = active === globalIdx;
          const em = item.equipmentModel;
          return (
            <button
              key={item._id}
              onClick={() => handleSelect(item)}
              onMouseEnter={() => setActive(globalIdx)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors',
                isActive ? 'bg-primary-50 text-primary-900' : 'text-gray-700 hover:bg-gray-50'
              )}
            >
              <Icon size={16} className={cn('shrink-0', isActive ? 'text-primary-600' : 'text-gray-400')} />
              <div className="flex-1 min-w-0">
                {categoryKey === 'equipment' && (
                  <>
                    <span className="font-medium">
                      {highlight(em ? `${em.brand} ${em.model}` : '—', query)}
                    </span>
                    <span className="ml-2 text-xs text-gray-400 font-mono">{highlight(item.serialNumber, query)}</span>
                    {item.patrimonyNumber && (
                      <span className="ml-1 text-xs text-gray-400">· {highlight(item.patrimonyNumber, query)}</span>
                    )}
                    {em?.lot && (
                      <span className="ml-1 text-xs text-gray-400">· {highlight(em.lot, query)}</span>
                    )}
                  </>
                )}
                {categoryKey === 'user' && (
                  <>
                    <span className="font-medium">{highlight(item.displayName, query)}</span>
                    <span className="ml-2 text-xs text-gray-400">{highlight(item.username, query)}</span>
                    {item.sector && <span className="ml-1 text-xs text-gray-400">· {item.sector.name}</span>}
                  </>
                )}
                {categoryKey === 'sector' && (
                  <span className="font-medium">{highlight(item.name, query)}</span>
                )}
              </div>
              {categoryKey === 'equipment' && (
                <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium shrink-0',
                  item.status === 'available' ? 'bg-green-100 text-green-700' :
                  item.status === 'assigned'  ? 'bg-blue-100 text-blue-700' :
                  item.status === 'maintenance' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-500'
                )}>
                  {statusLabel[item.status]}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-start justify-center pt-[10vh] px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-xl bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          {loading ? <Loader2 size={18} className="text-gray-400 animate-spin shrink-0" /> : <Search size={18} className="text-gray-400 shrink-0" />}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar equipamento, usuário ou setor..."
            className="flex-1 text-sm bg-transparent outline-none text-gray-900 placeholder-gray-400"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          )}
          <kbd className="hidden sm:flex items-center gap-1 text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">Esc</kbd>
        </div>

        <div ref={listRef} className="max-h-80 overflow-y-auto py-1">
          {!query.trim() && (
            <p className="px-4 py-6 text-sm text-center text-gray-400">
              Digite para buscar em equipamentos, usuários e setores
            </p>
          )}
          {query.trim() && !loading && !hasResults && (
            <p className="px-4 py-6 text-sm text-center text-gray-400">
              Nenhum resultado para <strong>"{query}"</strong>
            </p>
          )}
          {hasResults && (
            <>
              {renderGroup(results.equipment, 'Equipamentos', Monitor, 'equipment')}
              {renderGroup(results.users, 'Usuários', Users, 'user')}
              {renderGroup(results.sectors, 'Setores', Building2, 'sector')}
            </>
          )}
        </div>

        <div className="border-t border-gray-100 px-4 py-2 flex items-center gap-4 text-xs text-gray-400">
          <span className="flex items-center gap-1"><kbd className="bg-gray-100 px-1 rounded">↑↓</kbd> navegar</span>
          <span className="flex items-center gap-1"><kbd className="bg-gray-100 px-1 rounded">Enter</kbd> selecionar</span>
          <span className="flex items-center gap-1"><kbd className="bg-gray-100 px-1 rounded">Esc</kbd> fechar</span>
        </div>
      </div>
    </div>
  );
}
