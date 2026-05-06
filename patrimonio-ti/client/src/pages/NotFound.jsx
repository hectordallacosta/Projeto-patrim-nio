import { useNavigate } from 'react-router-dom';
import { FileQuestion } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center">
        <div className="flex justify-center mb-4 text-gray-300">
          <FileQuestion size={64} />
        </div>
        <h1 className="text-5xl font-bold text-gray-200 mb-2">404</h1>
        <p className="text-gray-500 mb-6">Página não encontrada.</p>
        <button className="btn-primary" onClick={() => navigate(-1)}>
          Voltar
        </button>
      </div>
    </div>
  );
}
