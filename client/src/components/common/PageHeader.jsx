import React from 'react';
import { Activity } from 'lucide-react';

export default function PageHeader({ desktopTitle, mobileTitle, icon: Icon = Activity }) {
  const finalMobileTitle = mobileTitle || desktopTitle;
  
  return (
    <header className="bg-white shadow-xs sticky top-0 z-30 px-4 sm:px-6 md:px-8 py-3.5 sm:py-4 border-b border-gray-100 flex items-center justify-between min-h-[64px] flex-shrink-0">
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5 text-blue-600 md:hidden flex-shrink-0" />
        <h1 className="text-lg sm:text-xl font-extrabold text-gray-800 tracking-tight truncate">
          <span className="hidden md:inline">{desktopTitle}</span>
          <span className="md:hidden">{finalMobileTitle}</span>
        </h1>
      </div>
    </header>
  );
}
