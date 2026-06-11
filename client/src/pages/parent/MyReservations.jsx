import { Ticket, QrCode, Clock, MapPin, CheckCircle2 } from "lucide-react";

export default function MyReservations() {
  return (
    <div className="space-y-6 pb-6 relative">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">My Reservations</h1>
        <p className="text-gray-500 mt-1">
          View your upcoming appointments and reservation history.
        </p>
      </div>

      {/* Coming Soon Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-8 md:p-12 text-center">
          <div className="mx-auto w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-6">
            <span className="text-2xl">🚧</span>
          </div>
          
          <h2 className="text-xl font-bold text-gray-800 mb-2">Reservations Loading</h2>
          <p className="text-gray-500 mb-10 max-w-lg mx-auto text-sm">
            Reservation records will appear here once reservations are created. You will be able to manage your tickets from this page.
          </p>

          <div className="bg-gray-50 rounded-2xl p-6 md:p-8 text-left border border-gray-100 max-w-2xl mx-auto">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center text-[15px]">
              <Ticket className="w-5 h-5 mr-2 text-blue-600" />
              Future Ticket Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: "Assigned Queue Number", icon: Clock },
                { label: "Clinic Branch Details", icon: MapPin },
                { label: "Live Reservation Status", icon: CheckCircle2 },
                { label: "Generate QR Ticket", icon: QrCode },
              ].map((feature, idx) => (
                <div key={idx} className="flex items-center bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                  <div className="bg-blue-50 p-2 rounded-lg mr-3">
                     <feature.icon className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="text-sm font-semibold text-gray-700">{feature.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
