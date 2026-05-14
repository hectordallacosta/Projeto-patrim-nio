import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { listAllStocks } from '@/services/stockService';

export default function SendToStockForm({ equipment, onSubmit, onCancel, loading }) {
  const [stockId, setStockId] = useState('');
  const [stocks, setStocks] = useState([]);

  useEffect(() => {
    listAllStocks().then(setStocks).catch(() => setStocks([]));
  }, []);

  const em = equipment?.equipmentModel;

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(stockId); }} className="space-y-4">
      <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm border border-gray-200">
        <p className="font-semibold text-gray-800">{em?.brand} {em?.model}</p>
        <p className="text-gray-500 font-mono text-xs mt-0.5">PAT: {equipment?.patrimonyNumber}</p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
        O equipamento será desvinculado e movido para o estoque selecionado.
      </div>

      <div>
        <label className="label">Estoque de destino *</label>
        <select className="input" value={stockId} onChange={(e) => setStockId(e.target.value)} required>
          <option value="">Selecione o estoque...</option>
          {stocks.map((s) => (
            <option key={s._id} value={s._id}>{s.name}</option>
          ))}
        </select>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancelar</button>
        <button type="submit" className="btn-primary" disabled={loading || !stockId}>
          {loading && <Loader2 size={14} className="animate-spin" />} Mover para Estoque
        </button>
      </div>
    </form>
  );
}
