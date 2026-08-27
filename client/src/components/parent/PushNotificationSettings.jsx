import React, { useState, useEffect } from 'react';
import { Bell, BellOff, BellRing, Loader2, Info } from 'lucide-react';
import { checkMessagingSupported } from '../../firebase/messaging';
import { registerPushSubscription, hasActivePushSubscription } from '../../services/pushService';
import { useAuth } from '../../hooks/useAuth';

export default function PushNotificationSettings({ variant = 'settings' }) {
  const { user } = useAuth();
  const [status, setStatus] = useState('loading'); // loading, unsupported, default, granted, denied, error
  const [isRegistering, setIsRegistering] = useState(false);
  const silentRegAttempted = React.useRef(false);

  useEffect(() => {
    let isMounted = true;

    const checkSupport = async () => {
      try {
        if (!('Notification' in window)) {
          if (isMounted) setStatus('unsupported');
          return;
        }

        const supported = await checkMessagingSupported();
        if (!supported) {
          if (isMounted) setStatus('unsupported');
          return;
        }

        if (Notification.permission === 'granted') {
          const hasSub = await hasActivePushSubscription(user?.uid);
          if (hasSub) {
            if (isMounted) setStatus('granted');
          } else {
            if (silentRegAttempted.current) {
              if (isMounted) setStatus('default');
              return;
            }
            silentRegAttempted.current = true;

            if (isMounted) setIsRegistering(true);
            try {
              const subscription = await registerPushSubscription(user);
              if (isMounted) {
                if (subscription) setStatus('granted');
                else setStatus('error');
              }
            } catch (err) {
              if (isMounted) setStatus('error');
            } finally {
              if (isMounted) setIsRegistering(false);
            }
          }
        } else if (Notification.permission === 'denied') {
          if (isMounted) setStatus('denied');
        } else {
          if (isMounted) setStatus('default');
        }
      } catch (error) {
        console.error("Error checking push support:", error);
        if (isMounted) setStatus('unsupported');
      }
    };

    if (user) {
      checkSupport();
    }

    return () => {
      isMounted = false;
    };
  }, [user]);

  const handleEnablePush = async () => {
    if (isRegistering) return;
    setIsRegistering(true);

    try {
      const subscription = await registerPushSubscription(user);

      if (Notification.permission === 'denied') {
        setStatus('denied');
      } else if (subscription) {
        setStatus('granted');
      } else {
        setStatus('error');
      }
    } catch (error) {
      console.error("Failed to enable push notifications:", error);
      setStatus('error');
    } finally {
      setIsRegistering(false);
    }
  };

  if (status === 'loading') {
    if (variant === 'dashboard') return null; // Don't show loading spinner on dashboard
    return (
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs flex justify-center items-center">
        <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
      </div>
    );
  }

  // Hide granted state on dashboard to save space
  if (status === 'granted' && variant === 'dashboard') {
    return null;
  }

  if (status === 'unsupported') {
    return (
      <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200 shadow-sm flex items-center gap-4 animate-in fade-in">
        <div className="bg-gray-200 p-2 rounded-xl text-gray-500 shrink-0">
          <Info className="w-5 h-5" />
        </div>
        <div>
          <h4 className="font-bold text-gray-700">Push Notifications Unavailable</h4>
          <p className="text-xs text-gray-500 mt-0.5">Your browser does not support receiving background notifications.</p>
        </div>
      </div>
    );
  }

  if (status === 'denied') {
    return (
      <div className="bg-red-50 rounded-2xl p-4 border border-red-100 shadow-sm flex items-center gap-4 animate-in fade-in">
        <div className="bg-red-100 p-2 rounded-xl text-red-600 shrink-0">
          <BellOff className="w-5 h-5" />
        </div>
        <div>
          <h4 className="font-bold text-red-800">Notifications Blocked</h4>
          <p className="text-xs text-red-600 mt-0.5">You have blocked notifications in your browser settings. Please unblock them to receive alerts.</p>
        </div>
      </div>
    );
  }

  if (status === 'granted') {
    return (
      <div className="bg-green-50 rounded-2xl p-4 border border-green-100 shadow-sm flex items-center justify-between gap-4 animate-in fade-in">
        <div className="flex items-center gap-4">
          <div className="bg-green-100 p-2 rounded-xl text-green-600 shrink-0">
            <BellRing className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-green-800">Push Notifications Enabled</h4>
            <p className="text-xs text-green-600 mt-0.5">You will receive alerts on this device even if the browser is closed.</p>
          </div>
        </div>
      </div>
    );
  }

  // Dashboard variant for default/error state
  if (variant === 'dashboard') {
    return (
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-4 border border-blue-100 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-4">
        <div className="flex items-start sm:items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-xl text-white shrink-0 shadow-sm">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-blue-900 text-sm">Stay updated on your queue</h4>
            <p className="text-xs text-blue-700 mt-0.5 pr-2">
              {status === 'error' 
                ? <span className="text-red-600 font-semibold">Unable to enable notifications. Please try again.</span>
                : "Get notified when you're almost next, when it's your turn, or when your reservation changes."}
            </p>
          </div>
        </div>
        <button 
          onClick={handleEnablePush}
          disabled={isRegistering}
          className="w-full sm:w-auto shrink-0 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isRegistering && <Loader2 className="w-4 h-4 animate-spin" />}
          {isRegistering ? 'Enabling...' : 'Enable Notifications'}
        </button>
      </div>
    );
  }

  // Settings variant for default/error state
  return (
    <div className={`bg-blue-50 rounded-2xl p-4 border shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in ${status === 'error' ? 'border-red-200' : 'border-blue-100'}`}>
      <div className="flex items-center gap-4">
        <div className="bg-blue-100 p-2 rounded-xl text-blue-600 shrink-0">
          <Bell className="w-5 h-5" />
        </div>
        <div>
          <h4 className="font-bold text-blue-900">Enable Push Notifications</h4>
          <p className="text-xs text-blue-700 mt-0.5">
            {status === 'error' 
              ? <span className="text-red-600 font-semibold">Unable to enable notifications. Please try again.</span>
              : 'Receive alerts even when your browser is closed or in the background.'}
          </p>
        </div>
      </div>
      <button 
        onClick={handleEnablePush}
        disabled={isRegistering}
        className="w-full sm:w-auto shrink-0 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isRegistering && <Loader2 className="w-4 h-4 animate-spin" />}
        {isRegistering ? 'Enabling...' : 'Enable'}
      </button>
    </div>
  );
}
