import React, { useEffect } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { useHistoryOverlay } from '../../hooks/useHistoryOverlay';

export default function ConfirmationModal({ 
  isOpen, 
  onClose, 
  onCancel,
  onConfirm, 
  title, 
  message, 
  confirmText = "Confirm", 
  cancelText = "Cancel", 
  isDestructive = false, 
  isLoading = false,
  loading = false,
}) {
  const close = onClose || onCancel;
  const busy = isLoading || loading;
  useHistoryOverlay(isOpen, close);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !busy && close) {
        close();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, busy, close]);

  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && !busy && !isDestructive && close) {
      close();
    }
  };

  return (
    <div 
      className="pq-modal-scrim z-[60]"
      onClick={handleOverlayClick}
    >
      <div 
        className="pq-modal w-full max-w-md overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-full shrink-0 ${isDestructive ? 'bg-red-50' : 'bg-blue-50'}`}>
              {isDestructive ? (
                <AlertTriangle className="w-6 h-6 text-red-600" />
              ) : (
                <Info className="w-6 h-6 text-blue-600" />
              )}
            </div>
            
            <div className="flex-1 mt-1">
              <h2 className="text-xl font-bold text-gray-800">{title}</h2>
              <p className="mt-2 text-gray-600 leading-relaxed text-sm">
                {message}
              </p>
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-gray-100 bg-gray-50/50 flex flex-col-reverse sm:flex-row justify-end gap-3">
          <button 
            type="button"
            onClick={close}
            disabled={busy}
            className="w-full sm:w-auto px-6 py-2.5 text-gray-600 font-bold hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button 
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`w-full sm:w-auto px-6 py-2.5 font-bold rounded-xl shadow-sm transition-colors disabled:opacity-50 flex justify-center items-center ${
              isDestructive 
                ? 'bg-red-600 hover:bg-red-700 text-white' 
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {busy ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
