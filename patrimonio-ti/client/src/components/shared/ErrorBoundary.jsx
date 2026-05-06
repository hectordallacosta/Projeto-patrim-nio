import { Component } from 'react';
import { AlertTriangle } from 'lucide-react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="card p-8 max-w-md w-full text-center">
            <div className="flex justify-center mb-4 text-red-500">
              <AlertTriangle size={40} />
            </div>
            <h1 className="text-lg font-semibold text-gray-900 mb-2">Algo deu errado</h1>
            <p className="text-sm text-gray-500 mb-6">
              Ocorreu um erro inesperado. Tente recarregar a página.
            </p>
            <button className="btn-primary" onClick={() => window.location.reload()}>
              Recarregar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
