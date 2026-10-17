import React from "react";
import { Info, CheckCircle, AlertTriangle, X } from "lucide-react";
import { useHistoryOverlay } from "../../hooks/useHistoryOverlay";
import ModalShell from "./ModalShell";

export default function InformationModal({
  isOpen,
  onClose,
  title,
  message,
  buttonText = "OK",
  type = "info", // "info", "success", "warning", "error"
}) {
  useHistoryOverlay(isOpen, onClose);

  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case "success":
        return <CheckCircle className="w-6 h-6 text-green-600" />;
      case "warning":
        return <AlertTriangle className="w-6 h-6 text-amber-600" />;
      case "error":
        return <AlertTriangle className="w-6 h-6 text-red-600" />;
      case "info":
      default:
        return <Info className="w-6 h-6 text-blue-600" />;
    }
  };

  const getIconBg = () => {
    switch (type) {
      case "success":
        return "bg-green-50";
      case "warning":
        return "bg-amber-50";
      case "error":
        return "bg-red-50";
      case "info":
      default:
        return "bg-blue-50";
    }
  };

  return (
    <ModalShell
      scrimClassName="z-[60]"
      maxWidth="md"
      onClose={onClose}
      showClose={false}
      header={
        <div className="pq-modal-header relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 min-h-11 min-w-11 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      }
      bodyClassName="p-6"
      footer={
        <div className="p-5 border-t border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto min-h-11 px-8 py-2.5 bg-blue-600 text-white font-bold hover:bg-blue-700 rounded-xl shadow-sm transition-colors"
          >
            {buttonText}
          </button>
        </div>
      }
    >
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-full shrink-0 ${getIconBg()}`}>{getIcon()}</div>

        <div className="flex-1 mt-1 pr-6 min-w-0">
          <h2 className="text-xl font-bold text-gray-800">{title}</h2>
          <p className="mt-2 text-gray-600 leading-relaxed text-sm break-words">{message}</p>
        </div>
      </div>
    </ModalShell>
  );
}
