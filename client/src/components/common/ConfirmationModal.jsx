import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default function ConfirmationModal({ 
  isOpen, 
  title, 
  message, 
  confirmText = "Confirm", 
  cancelText = "Cancel", 
  onConfirm, 
  onCancel, 
  loading = false,
  isDestructive = true,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 text-center">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${isDestructive ? 'bg-red-50' : 'bg-blue-50'}`}>
            <AlertTriangle className={`w-8 h-8 ${isDestructive ? 'text-red-500' : 'text-blue-500'}`} />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">{title}</h2>
          <p className="text-gray-500 text-sm mb-6 whitespace-pre-line">{message}</p>
          
          <div className="flex flex-col gap-3">
            <button
              onClick={onConfirm}
              disabled={loading}
              className={`w-full py-3 font-bold rounded-xl text-white transition-all ${
                loading 
                  ? (isDestructive ? "bg-red-400 cursor-not-allowed" : "bg-blue-400 cursor-not-allowed")
                  : (isDestructive ? "bg-red-600 hover:bg-red-700 shadow-sm" : "bg-blue-600 hover:bg-blue-700 shadow-sm")
              }`}
            >
              {loading ? "Processing..." : confirmText}
            </button>
            <button
              onClick={onCancel}
              disabled={loading}
              className="w-full py-3 font-bold rounded-xl text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              {cancelText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
