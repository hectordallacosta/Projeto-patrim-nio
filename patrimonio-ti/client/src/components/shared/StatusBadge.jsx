import { cn } from '@/utils/cn';
import { statusLabel, statusColor } from '@/utils/formatters';

export default function StatusBadge({ status }) {
  return (
    <span className={cn('badge', statusColor[status] ?? 'bg-gray-100 text-gray-600')}>
      {statusLabel[status] ?? status}
    </span>
  );
}
