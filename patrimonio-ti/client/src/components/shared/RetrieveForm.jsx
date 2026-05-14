import { useState } from 'react';
import { Loader2, PackageOpen } from 'lucide-react';

export default function RetrieveForm({ equipment, sectors, onSubmit, onCancel, loading }) {
  const [sectorId, setSectorId] = useState('');
  const em = equipment?.equipmentModel;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(sectorId);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {em && (
        <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm border border-gray-200">
          <p className="font-semibold text-gray-800">{em.brand} {em.model}</p>
          <p className="text-gray-500 font-mono text-xs mt-0.5">PAT: {equipment.patrimonyNumber}</p>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
        <p className="font-medium mb-1">Retirar do Estoque</p>
        <p className="text-blue-700 text-xs">
          O equipamento ficará <strong>disponível</strong> para empréstimo no setor selecionado.
        </p>
      </div>

      <div>
        <label className="label">Setor de destino *</label>
        <select
          className="input"
          value={sectorId}
          onChange={(e) => setSectorId(e.target.value)}
          required
        >
          <option value="">Selecione o setor...</option>
          {sectors.map((s) => (
            <option key={s._id} value={s._id}>{s.name}</option>
          ))}
        </select>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancelar</button>
        <button type="submit" className="btn-primary" disabled={loading || !sectorId}>
          {loading
            ? <><Loader2 size={14} className="animate-spin" /> Retirando...</>
            : <><PackageOpen size={14} /> Retirar do Estoque</>
          }
        </button>
      </div>
    </form>
  );
}
