import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/utils/cn';

export default function Pagination({ pagination, onPageChange }) {
  if (!pagination || pagination.pages <= 1) return null;
  const { page, pages, total, limit } = pagination;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
      <span>{from}–{to} de {total}</span>
      <div className="flex gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className={cn('btn-secondary px-2 py-1', page === 1 && 'opacity-40 pointer-events-none')}
        >
          <ChevronLeft size={16} />
        </button>
        {Array.from({ length: pages }, (_, i) => i + 1)
          .filter((p) => p === 1 || p === pages || Math.abs(p - page) <= 1)
          .reduce((acc, p, idx, arr) => {
            if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
            acc.push(p);
            return acc;
          }, [])
          .map((p, i) =>
            p === '...' ? (
              <span key={i} className="px-2 py-1">…</span>
            ) : (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                className={cn('px-3 py-1 rounded-md border text-sm', p === page ? 'bg-primary-600 text-white border-primary-600' : 'bg-white border-gray-300 hover:bg-gray-50')}
              >
                {p}
              </button>
            )
          )}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === pages}
          className={cn('btn-secondary px-2 py-1', page === pages && 'opacity-40 pointer-events-none')}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
