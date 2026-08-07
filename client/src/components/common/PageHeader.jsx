import React from 'react';
import { Activity, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PageHeader({ desktopTitle, mobileTitle, icon: Icon = Activity, action, backTo }) {
  const finalMobileTitle = mobileTitle || desktopTitle;
  const navigate = useNavigate();
  
  return (
    <header className="bg-white shadow-xs sticky top-0 z-30 px-4 sm:px-6 md:px-8 py-3.5 sm:py-4 border-b border-gray-100 flex items-center justify-between min-h-[64px] flex-shrink-0">
      <div className="flex items-center gap-3">
        {backTo ? (
          <button 
            onClick={() => typeof backTo === 'string' ? navigate(backTo) : navigate(-1)}
            className="md:hidden flex items-center justify-center p-1.5 -ml-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Go back"
          >
            <ChevronLeft className="w-6 h-6 flex-shrink-0" />
          </button>
        ) : (
          <Icon className="w-5 h-5 text-blue-600 md:hidden flex-shrink-0" />
        )}
        <h1 className="text-lg sm:text-xl font-extrabold text-gray-800 tracking-tight truncate">
          <span className="hidden md:inline">{desktopTitle}</span>
          <span className="md:hidden">{finalMobileTitle}</span>
        </h1>
      </div>
      {action && (
        <div className="flex items-center shrink-0 ml-4">
          {action}
        </div>
      )}
    </header>
  );
}
