import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  subscribeToUserNotifications,
  markAllNotificationsAsRead,
} from '../../services/notificationCenterService';
import { Bell, CheckCircle2, AlertCircle, Info, Clock, CheckCheck } from 'lucide-react';
import PushNotificationSettings from '../../components/parent/PushNotificationSettings';

export default function ParentNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    const unsub = subscribeToUserNotifications(user.uid, (data) => {
      setNotifications(data);
      setLoading(false);

      // Automatically mark visible unread notifications as read
      const unread = data.filter((n) => !n.read);
      if (unread.length > 0) {
        markAllNotificationsAsRead(user.uid, data);
      }
    });

    return () => unsub();
  }, [user]);

  const formatRelativeTime = (timestamp) => {
    if (!timestamp) return "Just now";
    const now = Date.now();
    const diffMs = now - timestamp;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);

    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;

    const date = new Date(timestamp);
    const today = new Date();
    const isSameDay =
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();

    const timeString = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

    if (isSameDay) {
      return `Today ${timeString}`;
    }

    if (diffHr < 48) {
      return `Yesterday ${timeString}`;
    }

    return `${date.toLocaleDateString()} ${timeString}`;
  };

  const getNotificationIcon = (n) => {
    const typeOrSeverity = typeof n === 'object' ? (n.severity || n.type) : n;
    switch (typeOrSeverity) {
      case 'success':
      case 'QR_VERIFIED':
      case 'CONSULTATION_STARTED':
      case 'CONSULTATION_COMPLETED':
        return <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />;
      case 'error':
      case 'warning':
      case 'ALMOST_NEXT':
      case 'YOU_ARE_NEXT':
      case 'PENALTY':
      case 'PENALIZED':
      case 'FORFEITED':
        return <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />;
      default:
        return <Info className="w-5 h-5 text-blue-600 flex-shrink-0" />;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Push Notification Settings Banner */}
      <PushNotificationSettings variant="settings" />

      {/* Notifications List */}
      {notifications.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 text-center border border-gray-100 shadow-xs">
          <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Bell className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-gray-800">No Notifications Yet</h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto mt-1">
            You're all caught up! Real-time alerts about your queue turn, schedule publications, and clinic updates will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`bg-white rounded-2xl p-4 sm:p-5 border transition-all duration-200 shadow-xs flex flex-col sm:flex-row sm:items-start justify-between gap-4 ${
                !n.read
                  ? 'border-blue-200 bg-blue-50/30'
                  : 'border-gray-100 hover:border-gray-200'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div className="mt-0.5 p-2 bg-gray-50 rounded-xl">
                  {getNotificationIcon(n)}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-extrabold text-gray-900 text-base">
                      {n.title}
                    </h4>
                    {!n.read ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200">
                        Unread
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                        Read
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 mt-1 leading-relaxed">
                    {n.body || n.message}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium sm:self-start self-end flex-shrink-0">
                <Clock className="w-3.5 h-3.5" />
                <span>{formatRelativeTime(n.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
