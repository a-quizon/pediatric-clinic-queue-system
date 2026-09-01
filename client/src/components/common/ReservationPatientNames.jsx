import { getReservationChildren } from "../../utils/reservationPatients";

export default function ReservationPatientNames({
  reservation,
  fallback = "Unnamed Patient",
  className = "",
  nameClassName = "font-bold text-gray-800 text-base",
}) {
  const names = getReservationChildren(reservation)
    .map((child) => child.childName)
    .filter(Boolean);

  if (names.length === 0) {
    return (
      <span className={`${nameClassName} break-words ${className}`.trim()}>
        {fallback}
      </span>
    );
  }

  return (
    <span className={`flex flex-col sm:flex-row sm:flex-wrap gap-x-2 gap-y-0.5 min-w-0 ${className}`.trim()}>
      {names.map((name, index) => (
        <span key={`${name}-${index}`} className={`${nameClassName} break-words leading-snug`}>
          {name}
          {index < names.length - 1 && (
            <span className="hidden sm:inline text-gray-400 font-semibold" aria-hidden="true">
              ,
            </span>
          )}
        </span>
      ))}
    </span>
  );
}
