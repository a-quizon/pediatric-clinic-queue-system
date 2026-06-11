import React from 'react';
import { CheckCircle2, XCircle, AlertCircle, Info } from 'lucide-react';

export default function MessageModal({ 
  isOpen, 
  type = 'info', 
  title, 
  message, 
  onClose 
}) {
  if (!isOpen) return null;

  const getConfig = () => {
    switch (type) {
      case 'success':
        return { icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-50', buttonBg: 'bg-green-600 hover:bg-green-700' };
      case 'error':
        return { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50', buttonBg: 'bg-red-600 hover:bg-red-700' };
      case 'warning':
        return { icon: AlertCircle, color: 'text-yellow-500', bg: 'bg-yellow-50', buttonBg: 'bg-yellow-600 hover:bg-yellow-700' };
      case 'info':
      default:
        return { icon: Info, color: 'text-blue-500', bg: 'bg-blue-50', buttonBg: 'bg-blue-600 hover:bg-blue-700' };
    }
  };

  const config = getConfig();
  const Icon = config.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 text-center">
          <div className={`w-16 h-16 ${config.bg} rounded-full flex items-center justify-center mx-auto mb-4`}>
            <Icon className={`w-8 h-8 ${config.color}`} />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">{title}</h2>
          <p className="text-gray-500 text-sm mb-6 whitespace-pre-line">{message}</p>
          
          <button
            onClick={onClose}
            className={`w-full py-3 font-bold rounded-xl text-white shadow-sm transition-all ${config.buttonBg}`}
          >
            Okay
          </button>
        </div>
      </div>
    </div>
  );
}
