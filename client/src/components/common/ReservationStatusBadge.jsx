import React from 'react';

export const getReservationStatusBadge = (status) => {
  switch (status) {
    case 'YOU_ARE_NEXT':
      return {
        label: "You're Next",
        color: 'bg-orange-100 text-orange-800 border-orange-200',
        dot: 'bg-orange-600 animate-pulse'
      };
    case 'ALMOST_NEXT':
      return {
        label: 'Almost Next',
        color: 'bg-amber-100 text-amber-800 border-amber-200',
        dot: 'bg-amber-600'
      };
    case 'WAITING':
    case 'reserved':
    case 'waiting':
      return {
        label: 'Waiting',
        color: 'bg-blue-50 text-blue-700 border-blue-200',
        dot: 'bg-blue-500'
      };
    case 'CHECKED_IN':
    case 'checked_in':
    case 'validated':
      return {
        label: 'Checked In',
        color: 'bg-green-100 text-green-800 border-green-200',
        dot: 'bg-green-600'
      };
    case 'WITH_DOCTOR':
    case 'with_doctor':
      return {
        label: 'With Doctor',
        color: 'bg-purple-100 text-purple-800 border-purple-200',
        dot: 'bg-purple-600 animate-pulse'
      };
    case 'in_consultation':
      return {
        label: 'In Consultation',
        color: 'bg-blue-100 text-blue-800 border-blue-200',
        dot: 'bg-blue-600 animate-pulse'
      };
    case 'COMPLETED':
    case 'completed':
    case 'consultation_completed':
      return {
        label: 'Completed',
        color: 'bg-green-100 text-green-700 border-green-200',
        dot: 'bg-green-600'
      };
    case 'CANCELLED':
    case 'cancelled':
      return {
        label: 'Cancelled',
        color: 'bg-red-100 text-red-700 border-red-200',
        dot: 'bg-red-500'
      };
    case 'FORFEITED':
    case 'forfeited':
    case 'penalized':
    case 'late_limit_reached':
      return {
        label: 'Forfeited',
        color: 'bg-red-100 text-red-700 border-red-200',
        dot: 'bg-red-500'
      };
    default:
      return {
        label: status ? status.replace(/_/g, ' ') : 'Unknown',
        color: 'bg-gray-100 text-gray-700 border-gray-200 capitalize',
        dot: 'bg-gray-400'
      };
  }
};

export default function ReservationStatusBadge({ status, showDot = true, className = "" }) {
  const badge = getReservationStatusBadge(status);

  return (
    <span
      className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-bold border whitespace-nowrap leading-tight tracking-tight ${badge.color} ${className}`}
    >
      {showDot && badge.dot && (
        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 flex-shrink-0 ${badge.dot}`} />
      )}
      <span>{badge.label}</span>
    </span>
  );
}
