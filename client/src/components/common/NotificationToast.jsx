import React from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  XCircle, 
  X 
} from 'lucide-react';

export default function NotificationToast({ t, type, title, message, onDismiss }) {
  const styleMap = {
    info: {
      bg: 'bg-white',
      border: 'border-blue-200',
      iconBg: 'bg-blue-50 text-blue-600',
      Icon: Info,
    },
    warning: {
      bg: 'bg-white',
      border: 'border-amber-200',
      iconBg: 'bg-amber-50 text-amber-600',
      Icon: AlertTriangle,
    },
    success: {
      bg: 'bg-white',
      border: 'border-green-200',
      iconBg: 'bg-green-50 text-green-600',
      Icon: CheckCircle2,
    },
    error: {
      bg: 'bg-white',
      border: 'border-red-200',
      iconBg: 'bg-red-50 text-red-600',
      Icon: XCircle,
    },
  };

  const currentStyle = styleMap[type] || styleMap.info;
  const IconComponent = currentStyle.Icon;

  return (
    <div
      className={`${
        t.visible ? 'animate-in fade-in slide-in-from-top-2' : 'animate-out fade-out slide-out-to-top-2'
      } max-w-sm w-full bg-white shadow-lg rounded-2xl pointer-events-auto border ${currentStyle.border} p-3.5 flex items-start gap-3 transition-all duration-200`}
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${currentStyle.iconBg}`}>
        <IconComponent className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <p className="text-xs font-bold text-gray-800 leading-tight mb-0.5">
          {title}
        </p>
        <p className="text-xs text-gray-600 leading-snug line-clamp-2">
          {message}
        </p>
      </div>
      <button
        onClick={onDismiss}
        className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
