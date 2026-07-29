import React, { useState } from "react";
import { FileText, Activity as ActivityIcon } from "lucide-react";

export default function Activity() {
  const [activeTab, setActiveTab] = useState("audit");

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">System Activity</h1>
        <p className="text-gray-500 mt-1">View audit logs and system reports</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          className={`flex items-center pb-4 px-4 font-semibold text-sm transition-colors border-b-2 ${
            activeTab === "audit"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-800"
          }`}
          onClick={() => setActiveTab("audit")}
        >
          <ActivityIcon className="w-4 h-4 mr-2" />
          Audit Logs
        </button>
        <button
          className={`flex items-center pb-4 px-4 font-semibold text-sm transition-colors border-b-2 ${
            activeTab === "reports"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-800"
          }`}
          onClick={() => setActiveTab("reports")}
        >
          <FileText className="w-4 h-4 mr-2" />
          Reports
        </button>
      </div>

      {/* Content area */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 min-h-[400px] flex flex-col items-center justify-center text-center">
        {activeTab === "audit" ? (
          <>
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4">
              <ActivityIcon className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Audit Logs Coming Soon</h2>
            <p className="text-gray-500 max-w-md">
              A comprehensive list of system events, logins, data modifications, and configuration changes will appear here.
            </p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center mb-4">
              <FileText className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">System Reports Coming Soon</h2>
            <p className="text-gray-500 max-w-md">
              Detailed analytical reports and export functionality will be available in this section.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
