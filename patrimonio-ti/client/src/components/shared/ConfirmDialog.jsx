import { AlertTriangle, Loader2 } from 'lucide-react';
import Modal from './Modal';

export default function ConfirmDialog({ open, onClose, onConfirm, title, message, loading = false }) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="flex gap-3 mb-5">
        <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={20} />
        <p className="text-sm text-gray-600">{message}</p>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="btn-secondary" disabled={loading}>Cancelar</button>
        <button onClick={onConfirm} className="btn-danger" disabled={loading}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : null}
          Confirmar
        </button>
      </div>
    </Modal>
  );
}
