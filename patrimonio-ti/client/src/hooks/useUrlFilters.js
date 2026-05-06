import { useSearchParams } from 'react-router-dom';
import { useCallback } from 'react';

export function useUrlFilters(defaults = {}) {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = {};
  for (const key of Object.keys(defaults)) {
    const val = searchParams.get(key);
    filters[key] = val !== null ? val : defaults[key];
  }

  const setFilter = useCallback((key, value) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value === '' || value === null || value === undefined) {
        next.delete(key);
      } else {
        next.set(key, String(value));
      }
      next.delete('page');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const clearFilters = useCallback(() => {
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  const activeCount = Object.keys(defaults).filter((k) => {
    const val = searchParams.get(k);
    return val !== null && val !== '' && val !== String(defaults[k]);
  }).length;

  return { filters, setFilter, clearFilters, activeCount };
}
