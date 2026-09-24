import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  subscribeToUserNotifications,
  markAllNotificationsAsRead,
} from '../../services/notificationCenterService';
import { Bell, CheckCircle2, AlertCircle, Info, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';

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

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAllAsRead = async (e) => {
    e.preventDefault();
    if (!user?.uid || unreadCount === 0) return;
    await markAllNotificationsAsRead(user.uid, notifications);
  };

  const getNotificationIcon = (n) => {
    const typeOrSeverity = typeof n === 'object' ? (n.severity || n.type) : n;
    switch (typeOrSeverity) {
      case 'success':
      case 'QR_VERIFIED':
      case 'CONSULTATION_STARTED':
      case 'CONSULTATION_COMPLETED':
      case 'SLOT_RESERVED':
        return <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />;
      case 'error':
      case 'warning':
      case 'NEARING_TURN':
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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        {notifications.length > 0 && unreadCount > 0 ? (
          <a
            href="#"
            onClick={handleMarkAllAsRead}
            className="pq-link text-sm"
          >
            Mark all as read
          </a>
        ) : (
          <span />
        )}
        <Link
          to="/parent/profile/notification-settings"
          className="pq-link text-sm"
        >
          Notification Settings
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-16">
          <span className="pq-spinner" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="pq-glass p-10 text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "color-mix(in srgb, var(--pq-mark-blue) 12%, white)", color: "var(--pq-mark-blue-deep)" }}>
            <Bell className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold">No Notifications Yet</h3>
          <p className="text-sm pq-muted max-w-sm mx-auto mt-1">
            You're all caught up! Real-time alerts about your queue turn and clinic updates will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`pq-glass p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4 ${
                !n.read ? "" : "opacity-75"
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div className="mt-0.5 p-2 rounded-xl" style={{ background: "color-mix(in srgb, #ffffff 55%, transparent)" }}>
                  {getNotificationIcon(n)}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-extrabold text-base">
                      {n.title}
                    </h4>
                    {!n.read ? (
                      <span className="pq-chip pq-chip-info">Unread</span>
                    ) : (
                      <span className="pq-chip" style={{ background: "color-mix(in srgb, var(--pq-ink) 8%, white)", color: "var(--pq-ink-soft)" }}>Read</span>
                    )}
                  </div>
                  <p className="text-sm mt-1 leading-relaxed pq-muted">
                    {n.body || n.message}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-xs pq-faint font-medium sm:self-start self-end flex-shrink-0">
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
