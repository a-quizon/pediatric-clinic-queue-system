import React from "react";
import { CheckCircle2, XCircle, AlertCircle, Info } from "lucide-react";
import { useHistoryOverlay } from "../../hooks/useHistoryOverlay";
import ModalShell from "./ModalShell";

export default function MessageModal({
  isOpen,
  type = "info",
  title,
  message,
  onClose,
}) {
  useHistoryOverlay(isOpen, onClose);
  if (!isOpen) return null;

  const getConfig = () => {
    switch (type) {
      case "success":
        return { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-50", buttonBg: "bg-green-600 hover:bg-green-700" };
      case "error":
        return { icon: XCircle, color: "text-red-500", bg: "bg-red-50", buttonBg: "bg-red-600 hover:bg-red-700" };
      case "warning":
        return { icon: AlertCircle, color: "text-yellow-500", bg: "bg-yellow-50", buttonBg: "bg-yellow-600 hover:bg-yellow-700" };
      case "info":
      default:
        return { icon: Info, color: "text-blue-500", bg: "bg-blue-50", buttonBg: "bg-blue-600 hover:bg-blue-700" };
    }
  };

  const config = getConfig();
  const Icon = config.icon;

  return (
    <ModalShell
      maxWidth="sm"
      onClose={onClose}
      showClose={false}
      header={null}
      bodyClassName="p-6 text-center"
      closeOnScrim
    >
      <div className={`w-16 h-16 ${config.bg} rounded-full flex items-center justify-center mx-auto mb-4`}>
        <Icon className={`w-8 h-8 ${config.color}`} />
      </div>
      <h2 className="text-xl font-bold text-gray-800 mb-2">{title}</h2>
      <p className="text-gray-500 text-sm mb-6 whitespace-pre-line break-words">{message}</p>

      <button
        type="button"
        onClick={onClose}
        className={`w-full min-h-11 py-3 font-bold rounded-xl text-white shadow-sm transition-all ${config.buttonBg}`}
      >
        Okay
      </button>
    </ModalShell>
  );
}
