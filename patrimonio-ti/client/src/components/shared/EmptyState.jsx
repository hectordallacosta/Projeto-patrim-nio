import { PackageOpen } from 'lucide-react';

export default function EmptyState({ message = 'Nenhum registro encontrado.', action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
      <PackageOpen size={36} />
      <p className="text-sm">{message}</p>
      {action}
    </div>
  );
}
