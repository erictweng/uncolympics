import { motion, AnimatePresence } from 'framer-motion'

interface ConfirmModalProps {
  isOpen: boolean
  message: string
  subtitle?: string
  onConfirm: () => void
  onCancel: () => void
  confirmText?: string
  cancelText?: string
}

export function ConfirmModal({
  isOpen,
  message,
  subtitle,
  onConfirm,
  onCancel,
  confirmText = 'Yes',
  cancelText = 'No'
}: ConfirmModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-60 z-40"
            onClick={onCancel}
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="glass-panel p-6 w-full max-w-sm">
              {/* Message */}
              <div className="text-center mb-6">
                <p className="text-white text-lg font-medium">
                  {message}
                </p>
                {subtitle && (
                  <p className="text-gray-400 text-sm mt-2">{subtitle}</p>
                )}
              </div>
              
              {/* Buttons */}
              <div className="flex space-x-3">
                <button
                  onClick={onConfirm}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 px-4 rounded-lg font-medium transition-colors"
                >
                  {confirmText}
                </button>
                <button
                  onClick={onCancel}
                  className="flex-1 glass-panel text-white py-3 px-4 rounded-lg font-medium transition-opacity hover:opacity-80"
                >
                  {cancelText}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default ConfirmModal