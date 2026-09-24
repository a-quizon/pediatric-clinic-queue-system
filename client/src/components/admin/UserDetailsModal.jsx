import React, { useState, useEffect } from "react";
import { X, Edit2, Shield, Stethoscope, UserCog, User, Mail, Phone, Calendar, Clock, MapPin, CheckCircle, AlertTriangle, Key, Copy, Check } from "lucide-react";
import {
  updateUser,
  toggleUserStatus,
  sendParentPasswordResetEmail,
  sendAdminPasswordResetEmail,
  resetSecretaryPasswordDirect,
} from "../../services/adminService";
import { formatName, branchesMatch } from "../../utils/stringUtils";
import { getBranchConfigurations } from "../../services/branchConfigurationService";
import { formatToE164, parseToLocal } from "../../utils/phoneUtils";
import { canDoctorEditUserProfile } from "../../utils/doctorUserManagementPolicy";
import { useAuth } from "../../hooks/useAuth";
import toast from "react-hot-toast";
import ConfirmationModal from "../common/ConfirmationModal";
import { useHistoryOverlay } from "../../hooks/useHistoryOverlay";

export default function UserDetailsModal({ isOpen, onClose, user, onUpdate }) {
  const { user: currentUser } = useAuth();
  useHistoryOverlay(Boolean(isOpen && user?.id), onClose);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [branches, setBranches] = useState([]);
  const [tempPasswordReveal, setTempPasswordReveal] = useState(null);
  const [copied, setCopied] = useState(false);

  const [confirmConfig, setConfirmConfig] = useState({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "",
    isDestructive: false,
    action: null
  });

  const closeConfirm = () => setConfirmConfig((prev) => ({ ...prev, isOpen: false }));

  useEffect(() => {
    getBranchConfigurations().then(setBranches).catch(console.error);
  }, []);

  useEffect(() => {
    if (user && isOpen) {
      setFormData({
        name: user.name || "",
        email: user.email || "",
        phone: parseToLocal(user.phone || ""),
        assignedBranch: user.assignedBranch || "Angeles"
      });
      setIsEditing(false);
      setTempPasswordReveal(null);
      setCopied(false);
    }
  }, [user, isOpen]);

  useEffect(() => {
    if (!user || !isOpen || user.role !== "secretary" || branches.length === 0) return;
    const matchedBranch = branches.find((b) =>
      (user.assignedBranchId && b.id === user.assignedBranchId) ||
      branchesMatch(b.name, user.assignedBranch)
    );
    if (!matchedBranch) return;
    setFormData((prev) => (
      prev.assignedBranch === matchedBranch.name
        ? prev
        : { ...prev, assignedBranch: matchedBranch.name }
    ));
  }, [branches, user, isOpen]);

  if (!isOpen || !user || !user.id) return null;

  const isDoctorTarget = user.role === "doctor";
  const isParentTarget = user.role === "parent";
  const isSecretaryTarget = user.role === "secretary";
  const isSelf = Boolean(currentUser?.uid && user.id === currentUser.uid);
  const canToggleStatus = !isDoctorTarget && !isSelf && user.id !== "admin";
  const canEditProfile = canDoctorEditUserProfile(user.role) && !isParentTarget;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === "phone") {
      const sanitized = value.replace(/\D/g, "");
      setFormData((prev) => ({ ...prev, [name]: sanitized }));
      return;
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!canEditProfile) {
      toast.error("Parent accounts are view-only.");
      return;
    }
    if (!formData.name.trim() || !formData.email.trim()) {
      toast.error("Name and Email are required.");
      return;
    }

    if (formData.phone && formData.phone.length !== 10) {
      toast.error("Phone number must be exactly 10 digits if provided.");
      return;
    }

    setIsSaving(true);
    try {
      const updates = {
        name: formatName(formData.name),
        phone: formatToE164(formData.phone)
      };

      if (user.role === "secretary") {
        const selectedBranch = branches.find((b) => b.name === formData.assignedBranch);
        updates.assignedBranch = selectedBranch?.name || formData.assignedBranch;
        updates.assignedBranchId = selectedBranch?.id || null;
      }

      await updateUser(user.id, updates);
      toast.success("User updated successfully.");
      setIsEditing(false);
      onUpdate();
    } catch (error) {
      console.error(error);
      if (error.status === 403 || error.code === "permission-denied") {
        toast.error(error.message || "You do not have permission to edit this account.");
      } else {
        toast.error("Failed to update user.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = () => {
    const isDeactivating = user.status === "active";
    setConfirmConfig({
      isOpen: true,
      title: isDeactivating ? "Deactivate User" : "Activate User",
      message: `Are you sure you want to ${isDeactivating ? "deactivate" : "activate"} this user's account? ${isDeactivating ? "They will no longer be able to access the system." : "They will regain access to the system."}`,
      confirmText: isDeactivating ? "Deactivate" : "Activate",
      isDestructive: isDeactivating,
      action: async () => {
        setIsTogglingStatus(true);
        try {
          await toggleUserStatus(user.id, user.status);
          toast.success(`User successfully ${isDeactivating ? "deactivated" : "activated"}.`);
          onUpdate();
          closeConfirm();
        } catch (error) {
          console.error(error);
          toast.error(error.message || "Failed to change user status.");
        } finally {
          setIsTogglingStatus(false);
        }
      }
    });
  };

  const handlePasswordReset = () => {
    if (isSecretaryTarget) {
      setConfirmConfig({
        isOpen: true,
        title: "Reset Password",
        message: `Reset password for ${user.name || "this secretary"}? A temporary password will be generated. No email will be sent.`,
        confirmText: "Reset Password",
        isDestructive: false,
        action: async () => {
          setIsResettingPassword(true);
          try {
            const result = await resetSecretaryPasswordDirect(user.id);
            closeConfirm();
            setTempPasswordReveal(result.temporaryPassword);
            toast.success("Password reset. Share the temporary password with the secretary.");
            onUpdate();
          } catch (error) {
            console.error(error);
            toast.error(error.message || "Failed to reset secretary password.");
          } finally {
            setIsResettingPassword(false);
          }
        }
      });
      return;
    }

    if (!user.email) {
      toast.error("This account has no email on file. A password reset email cannot be sent.");
      return;
    }

    setConfirmConfig({
      isOpen: true,
      title: "Reset Password",
      message: `Are you sure you want to send a password reset email to ${user.email}? The user will receive instructions to set a new password.`,
      confirmText: "Send Email",
      isDestructive: false,
      action: async () => {
        setIsResettingPassword(true);
        try {
          if (isParentTarget) {
            await sendParentPasswordResetEmail({
              email: user.email,
              uid: user.id,
              name: user.name,
            });
          } else {
            await sendAdminPasswordResetEmail(user.email);
          }
          toast.success(`Password reset email sent to ${user.email}`);
          closeConfirm();
        } catch (error) {
          console.error(error);
          if (error.code === "rate_limited") {
            toast.error(error.message || "You've reached today's password reset limit. Please try again tomorrow.");
          } else if (error.code === "missing_email") {
            toast.error(error.message);
          } else {
            toast.error("Unable to send the password reset email. Please try again.");
          }
        } finally {
          setIsResettingPassword(false);
        }
      }
    });
  };

  const handleCopyTempPassword = async () => {
    if (!tempPasswordReveal) return;
    try {
      await navigator.clipboard.writeText(tempPasswordReveal);
      setCopied(true);
      toast.success("Temporary password copied.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy to clipboard. Please copy it manually.");
    }
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case "doctor": return <Stethoscope className="w-5 h-5" />;
      case "secretary": return <UserCog className="w-5 h-5" />;
      case "admin": return <Shield className="w-5 h-5" />;
      default: return <User className="w-5 h-5" />;
    }
  };

  const roleIconStyle = (role) => {
    if (role === "secretary") {
      return { background: "var(--pq-wait-wash)", color: "var(--pq-wait)" };
    }
    if (role === "doctor" || role === "admin") {
      return { background: "color-mix(in srgb, var(--pq-mark-blue) 14%, white)", color: "var(--pq-mark-blue-deep)" };
    }
    return { background: "color-mix(in srgb, #ffffff 55%, transparent)", color: "var(--pq-ink-soft)" };
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="pq-modal-scrim z-50">
      <div className="pq-modal w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]" role="dialog" aria-modal="true" aria-labelledby="user-details-title">
        <div className="flex items-center justify-between p-6" style={{ borderBottom: "1px solid var(--pq-glass-line)" }}>
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 rounded-[0.9rem] flex items-center justify-center shrink-0" style={roleIconStyle(user.role)}>
              {getRoleIcon(user.role)}
            </div>
            <div className="min-w-0">
              <h2 id="user-details-title" className="text-xl font-extrabold tracking-tight leading-none">
                User Details
              </h2>
              <p className="text-sm pq-muted capitalize font-medium mt-1">{user.role}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="pq-icon-btn" aria-label="Close">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-8">
          {isParentTarget && (
            <p className="text-sm pq-muted">
              Parent accounts are view-only. You can deactivate, delete, or send a password reset email.
            </p>
          )}

          <section>
            <h3 className="pq-stat-label mb-4 pb-2" style={{ borderBottom: "1px solid var(--pq-glass-line)" }}>Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="user-detail-name" className="pq-label"><User className="w-3.5 h-3.5" aria-hidden="true" /> Full Name</label>
                {isEditing && canEditProfile ? (
                  <input id="user-detail-name" type="text" name="name" value={formData.name} onChange={handleInputChange} className="pq-input" />
                ) : (
                  <p className="font-semibold text-base">{user.name}</p>
                )}
              </div>

              <div>
                <label className="pq-label"><Mail className="w-3.5 h-3.5" aria-hidden="true" /> Email Address</label>
                <p className="font-semibold text-base">{user.email}</p>
                {isEditing && canEditProfile && (
                  <p className="text-xs pq-muted mt-1 italic">Login email cannot be changed by administrators.</p>
                )}
              </div>

              <div>
                <label htmlFor="user-detail-phone" className="pq-label"><Phone className="w-3.5 h-3.5" aria-hidden="true" /> Phone Number</label>
                {isEditing && canEditProfile ? (
                  <div className="relative">
                    <div className="pq-field-icon">
                      <span className="pq-muted font-medium text-sm">+63</span>
                    </div>
                    <input id="user-detail-phone" type="tel" name="phone" maxLength={10} value={formData.phone} onChange={handleInputChange} className="pq-input pl-14" />
                  </div>
                ) : (
                  <p className="font-semibold text-base">{user.phone ? `+63 ${parseToLocal(user.phone)}` : "Not provided"}</p>
                )}
              </div>
            </div>
          </section>

          <section>
            <h3 className="pq-stat-label mb-4 pb-2" style={{ borderBottom: "1px solid var(--pq-glass-line)" }}>Account Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="pq-label">Role</label>
                <p className="font-semibold capitalize text-base">{user.role}</p>
              </div>

              <div>
                <label className="pq-label">Status</label>
                <span className={`pq-chip ${user.status === "active" ? "pq-chip-live" : "pq-chip-alert"} uppercase`}>
                  {user.status || "unknown"}
                </span>
              </div>

              {user.role === "secretary" && (
                <div>
                  <label htmlFor="user-detail-branch" className="pq-label"><MapPin className="w-3.5 h-3.5" aria-hidden="true" /> Assigned Branch</label>
                  {isEditing && canEditProfile ? (
                    <select id="user-detail-branch" name="assignedBranch" value={formData.assignedBranch} onChange={handleInputChange} className="pq-input">
                      <option value="" disabled>Select assigned branch</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.name}>{b.name}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="pq-chip">{user.assignedBranch}</span>
                  )}
                </div>
              )}
            </div>
          </section>

          <section>
            <h3 className="pq-stat-label mb-4 pb-2" style={{ borderBottom: "1px solid var(--pq-glass-line)" }}>Audit Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="pq-label"><Calendar className="w-3.5 h-3.5" aria-hidden="true" /> Created At</label>
                <p className="text-sm font-semibold">{formatDate(user.createdAt)}</p>
              </div>

              {user.role !== "parent" && (
                <div>
                  <label className="pq-label"><Clock className="w-3.5 h-3.5" aria-hidden="true" /> Last Updated</label>
                  <p className="text-sm font-semibold">{formatDate(user.updatedAt)}</p>
                </div>
              )}

              <div>
                <label className="pq-label">User ID</label>
                <p className="font-mono text-xs pq-muted break-all">{user.id}</p>
              </div>
            </div>
          </section>
        </div>

        <div className="p-5" style={{ borderTop: "1px solid var(--pq-glass-line)" }}>
          {isEditing && canEditProfile ? (
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="pq-btn-secondary w-full sm:w-auto"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="pq-btn-primary w-full sm:w-auto"
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              {canEditProfile && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="order-1 sm:order-3 pq-btn-primary w-full sm:w-auto"
                >
                  <Edit2 className="w-4 h-4" aria-hidden="true" />
                  Edit Information
                </button>
              )}

              <button
                type="button"
                onClick={handlePasswordReset}
                className="order-2 sm:order-1 pq-btn-secondary w-full sm:w-auto text-sm"
              >
                <Key className="w-4 h-4" aria-hidden="true" />
                <span className="sm:hidden lg:inline">Reset Password</span>
                <span className="hidden sm:inline lg:hidden">Reset</span>
              </button>

              {canToggleStatus && (
                <button
                  type="button"
                  onClick={handleToggleStatus}
                  disabled={isTogglingStatus}
                  className={`order-3 sm:order-2 w-full sm:w-auto text-sm ${user.status === "active" ? "pq-btn-danger" : "pq-btn-live"}`}
                >
                  {user.status === "active" ? <AlertTriangle className="w-4 h-4" aria-hidden="true" /> : <CheckCircle className="w-4 h-4" aria-hidden="true" />}
                  <span className="sm:hidden lg:inline">{user.status === "active" ? "Deactivate Account" : "Activate Account"}</span>
                  <span className="hidden sm:inline lg:hidden">{user.status === "active" ? "Deactivate" : "Activate"}</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <ConfirmationModal
        isOpen={confirmConfig.isOpen}
        onClose={closeConfirm}
        onConfirm={confirmConfig.action}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmText={confirmConfig.confirmText}
        isDestructive={confirmConfig.isDestructive}
        isLoading={isTogglingStatus || isResettingPassword}
      />

      {tempPasswordReveal && (
        <div className="pq-modal-scrim z-[60]">
          <div className="pq-modal w-full max-w-md overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="temp-password-title">
            <div className="p-6 space-y-4">
              <h3 id="temp-password-title" className="text-lg font-extrabold tracking-tight">Temporary Password</h3>
              <p className="text-sm pq-muted">
                Share this password with the secretary once. They must change it on next login. It will not be shown again.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 pq-input font-mono text-sm break-all select-all">{tempPasswordReveal}</code>
                <button type="button" onClick={handleCopyTempPassword} className="pq-btn-secondary shrink-0" aria-label="Copy temporary password">
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <button
                type="button"
                className="pq-btn-primary w-full"
                onClick={() => {
                  setTempPasswordReveal(null);
                  setCopied(false);
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
