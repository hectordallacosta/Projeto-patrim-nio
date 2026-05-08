import { create } from 'zustand';

let nextId = 1;

const useToastStore = create((set) => ({
  toasts: [],

  addToast: (message, type = 'success', duration = 5000) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, message, type }] }));
    if (duration > 0) {
      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
      }, duration);
    }
  },

  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export default useToastStore;

export const toast = {
  success: (msg) => useToastStore.getState().addToast(msg, 'success', 5000),
  error: (msg) => useToastStore.getState().addToast(msg, 'error', 6000),
  warning: (msg) => useToastStore.getState().addToast(msg, 'warning', 7000),
  info: (msg) => useToastStore.getState().addToast(msg, 'info', 5000),
};
