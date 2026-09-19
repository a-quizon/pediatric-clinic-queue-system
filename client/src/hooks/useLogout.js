import { useState } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './useAuth';
import { logoutUser } from '../services/authService';
import toast from 'react-hot-toast';

export const useLogout = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const openLogoutModal = () => setIsLogoutModalOpen(true);
  const closeLogoutModal = () => {
    if (isLoggingOut) return;
    setIsLogoutModalOpen(false);
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    // Close the confirm overlay before sign-out so history-pop cleanup
    // runs while still on the dashboard, not against a blank <Navigate />.
    flushSync(() => {
      setIsLogoutModalOpen(false);
    });
    try {
      await logoutUser(user);
      navigate('/', { replace: true });
    } catch (error) {
      console.error("Logout failed:", error);
      toast.error("Failed to sign out. Please try again.");
      setIsLoggingOut(false);
    }
  };

  return {
    isLogoutModalOpen,
    isLoggingOut,
    openLogoutModal,
    closeLogoutModal,
    handleLogout
  };
};
