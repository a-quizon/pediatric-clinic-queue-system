import { BellOff } from "lucide-react";

export default function Notifications() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Notifications Center</h1>
          <p className="text-gray-500 text-sm mt-1">Stay updated with the latest alerts and activities.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm min-h-[400px] flex flex-col items-center justify-center text-center">
        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6">
          <BellOff className="w-10 h-10 text-gray-300" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">No Notifications Yet</h2>
        <p className="text-gray-500 max-w-sm mx-auto mb-6">
          You don't have any notifications right now. We'll let you know when there's something new.
        </p>
        <span className="bg-blue-50 text-blue-600 px-4 py-2 rounded-full text-sm font-semibold border border-blue-100">
          Coming Soon
        </span>
      </div>
    </div>
  );
}
