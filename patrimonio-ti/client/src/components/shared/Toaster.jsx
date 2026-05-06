import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import useToastStore from '@/store/toastStore';
import { cn } from '@/utils/cn';

const config = {
  success: { icon: CheckCircle, classes: 'bg-green-50 border-green-300 text-green-900' },
  error:   { icon: AlertCircle, classes: 'bg-red-50 border-red-300 text-red-900' },
  warning: { icon: AlertTriangle, classes: 'bg-yellow-50 border-yellow-300 text-yellow-900' },
  info:    { icon: Info, classes: 'bg-blue-50 border-blue-300 text-blue-900' },
};

export default function Toaster() {
  const { toasts, removeToast } = useToastStore();
  if (!toasts.length) return null;

  return (
    <div
      className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 w-full max-w-sm"
      aria-live="polite"
    >
      {toasts.map(({ id, message, type }) => {
        const { icon: Icon, classes } = config[type] ?? config.info;
        return (
          <div
            key={id}
            className={cn(
              'flex items-start gap-3 px-4 py-3 rounded-lg border shadow-lg text-sm',
              'animate-in slide-in-from-right-4 duration-200',
              classes
            )}
          >
            <Icon size={16} className="shrink-0 mt-0.5" />
            <span className="flex-1 leading-snug">{message}</span>
            <button
              onClick={() => removeToast(id)}
              className="shrink-0 opacity-50 hover:opacity-100 transition-opacity"
              aria-label="Fechar notificação"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
