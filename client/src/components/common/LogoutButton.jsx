import React from 'react';
import { useLogout } from '../../hooks/useLogout';
import ConfirmationModal from './ConfirmationModal';

export default function LogoutButton({ 
  className = "", 
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
        {children}
      </button>

      <ConfirmationModal
        isOpen={isLogoutModalOpen}
        onClose={closeLogoutModal}
        onConfirm={handleLogout}
        title="Sign Out"
        message="Are you sure you want to sign out?"
        confirmText="Sign Out"
        cancelText="Cancel"
        isLoading={isLoggingOut}
        isDestructive={true}
      />
    </>
  );
}
