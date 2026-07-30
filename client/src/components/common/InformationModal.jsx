import React, { useEffect } from 'react';
import { Info, CheckCircle, AlertTriangle, X } from 'lucide-react';

export default function InformationModal({ 
  isOpen, 
  onClose, 
  title, 
  message, 
  buttonText = "OK", 
  type = "info" // "info", "success", "warning", "error"
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-6 h-6 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="w-6 h-6 text-amber-600" />;
      case 'error':
        return <AlertTriangle className="w-6 h-6 text-red-600" />;
      case 'info':
      default:
        return <Info className="w-6 h-6 text-blue-600" />;
    }
  };

  const getIconBg = () => {
    switch (type) {
      case 'success': return 'bg-green-50';
      case 'warning': return 'bg-amber-50';
      case 'error': return 'bg-red-50';
      case 'info':
      default: return 'bg-blue-50';
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4 sm:p-6"
      onClick={handleOverlayClick}
    >
      <div 
        className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden flex flex-col transform transition-all animate-in fade-in zoom-in-95 duration-200 relative"
        role="dialog"
        aria-modal="true"
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-full shrink-0 ${getIconBg()}`}>
              {getIcon()}
            </div>
            
            <div className="flex-1 mt-1 pr-6">
              <h2 className="text-xl font-bold text-gray-800">{title}</h2>
              <p className="mt-2 text-gray-600 leading-relaxed text-sm">
                {message}
              </p>
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row justify-end gap-3 rounded-b-3xl">
          <button 
            onClick={onClose}
            className="w-full sm:w-auto px-8 py-2.5 bg-blue-600 text-white font-bold hover:bg-blue-700 rounded-xl shadow-sm transition-colors"
          >
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  );
}
