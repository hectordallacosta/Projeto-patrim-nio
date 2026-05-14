import { PackageOpen } from 'lucide-react';

export default function EmptyState({ message = 'Nenhum registro encontrado.', subtext, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
      <PackageOpen size={36} />
      <p className="text-sm">{message}</p>
      {subtext && <p className="text-xs text-center max-w-xs">{subtext}</p>}
      {action}
    </div>
  );
}
