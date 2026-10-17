import React, { useEffect, useState } from "react";
import { AlertTriangle, Eye, EyeOff, Lock } from "lucide-react";
import { useHistoryOverlay } from "../../hooks/useHistoryOverlay";
import ModalShell from "./ModalShell";

export default function DeleteAccountModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
  error = "",
}) {
  const [confirmText, setConfirmText] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setConfirmText("");
      setPassword("");
      setShowPassword(false);
    }
  }, [isOpen]);

  useHistoryOverlay(isOpen, onClose);

  if (!isOpen) return null;

  const canConfirm = confirmText.trim() === "DELETE" && password.length > 0 && !isLoading;

  return (
    <ModalShell
      scrimClassName="z-[60]"
      maxWidth="md"
      busy={isLoading}
      closeOnScrim={false}
      onClose={onClose}
      showClose={false}
      header={null}
      bodyClassName="p-6"
      footer={
        <div className="p-5 border-t border-gray-100 bg-gray-50/50 flex flex-col-reverse sm:flex-row justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="w-full sm:w-auto min-h-11 px-6 py-2.5 text-gray-600 font-bold hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(password)}
            disabled={!canConfirm}
            className="w-full sm:w-auto min-h-11 px-6 py-2.5 font-bold rounded-xl shadow-sm transition-colors disabled:opacity-50 flex justify-center items-center bg-red-600 hover:bg-red-700 text-white"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              "Delete Account"
            )}
          </button>
        </div>
      }
    >
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-full shrink-0 bg-red-50">
          <AlertTriangle className="w-6 h-6 text-red-600" />
        </div>
        <div className="flex-1 mt-1 min-w-0">
          <h2 className="text-xl font-bold text-gray-800">Delete Account</h2>
          <p className="mt-2 text-gray-600 leading-relaxed text-sm break-words">
            This action is permanent. Your login will be revoked and your profile will be marked as deleted.
            Historical queue and appointment records are kept for clinic analytics and will not be removed.
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {error && (
          <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium break-words">{error}</div>
        )}

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1.5">Type DELETE to confirm</label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            disabled={isLoading}
            className="w-full min-h-11 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none text-gray-800 text-sm"
            placeholder="DELETE"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1.5">Current password</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              className="w-full min-h-11 pl-9 pr-12 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none text-gray-800 text-sm"
              placeholder="Enter your password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-2 min-w-11 flex items-center justify-center text-gray-400 hover:text-gray-600 focus:outline-none"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
