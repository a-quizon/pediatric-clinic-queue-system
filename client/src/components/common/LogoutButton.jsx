import React from 'react';
import { LogOut } from 'lucide-react';
import { useLogout } from '../../hooks/useLogout';
import ConfirmationModal from './ConfirmationModal';

export default function LogoutButton({ 
  className = "w-full flex items-center justify-center gap-2 p-4 bg-white text-red-600 rounded-2xl font-bold border border-gray-200 shadow-sm hover:bg-red-50 hover:border-red-100 transition-colors active:scale-[0.98]", 
  children
}) {
  const { 
    isLogoutModalOpen, 
    isLoggingOut, 
    openLogoutModal, 
    closeLogoutModal, 
    handleLogout 
  } = useLogout();

  return (
    <>
      <button 
        onClick={openLogoutModal}
        className={className}
      >
        {children || (
          <>
            <LogOut className="w-5 h-5" />
            Log Out
          </>
        )}
      </button>

      <ConfirmationModal
        isOpen={isLogoutModalOpen}
        onClose={closeLogoutModal}
        onConfirm={handleLogout}
        title="Log Out"
        message="Are you sure you want to logout?"
        confirmText="Log Out"
        cancelText="Cancel"
        isLoading={isLoggingOut}
        isDestructive={true}
      />
    </>
  );
}
