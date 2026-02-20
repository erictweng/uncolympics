import { create } from 'zustand'

interface Toast {
  id: string
  message: string
  type: 'error' | 'success' | 'info'
  duration?: number
}

interface ToastStore {
  toasts: Toast[]
  addToast: (message: string, type?: 'error' | 'success' | 'info', duration?: number) => void
  removeToast: (id: string) => void
}

const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],
  
  addToast: (message, type = 'info', duration = 4000) => {
    const id = typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36)
    const toast: Toast = { id, message, type, duration }
    
    set((state) => ({
      toasts: [...state.toasts, toast]
    }))
    
    // Auto-remove after duration
    if (duration > 0) {
      setTimeout(() => {
        get().removeToast(id)
      }, duration)
    }
  },
  
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter(toast => toast.id !== id)
    }))
  }
}))

export default useToastStore
export { useToastStore }