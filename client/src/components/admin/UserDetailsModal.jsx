import React, { useState, useEffect } from "react";
import { X, Edit2, Shield, Stethoscope, UserCog, User, Mail, Phone, Calendar, Clock, MapPin, CheckCircle, AlertTriangle, Key } from "lucide-react";
import { updateUser, toggleUserStatus, sendAdminPasswordResetEmail } from "../../services/adminService";
import { formatName, branchesMatch } from "../../utils/stringUtils";
import { getBranchConfigurations } from "../../services/branchConfigurationService";
import { formatToE164, parseToLocal } from "../../utils/phoneUtils";
import toast from "react-hot-toast";
import ConfirmationModal from "../common/ConfirmationModal";

export default function UserDetailsModal({ isOpen, onClose, user, onUpdate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [branches, setBranches] = useState([]);

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
      toast.error("Failed to update user.");
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
          toast.error("Failed to change user status.");
        } finally {
          setIsTogglingStatus(false);
        }
      }
    });
  };

  const handlePasswordReset = () => {
    setConfirmConfig({
      isOpen: true,
      title: "Reset Password",
      message: `Are you sure you want to send a password reset email to ${user.email}? The user will receive instructions to set a new password.`,
      confirmText: "Send Email",
      isDestructive: false,
      action: async () => {
        setIsResettingPassword(true);
        try {
          await sendAdminPasswordResetEmail(user.email);
          toast.success(`Password reset email sent to ${user.email}`);
          closeConfirm();
        } catch (error) {
          console.error(error);
          toast.error("Unable to send the password reset email. Please try again.");
        } finally {
          setIsResettingPassword(false);
        }
      }
    });
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
      <div className="pq-glass-modal w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]" role="dialog" aria-modal="true" aria-labelledby="user-details-title">
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
          <section>
            <h3 className="pq-stat-label mb-4 pb-2" style={{ borderBottom: "1px solid var(--pq-glass-line)" }}>Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="user-detail-name" className="pq-label"><User className="w-3.5 h-3.5" aria-hidden="true" /> Full Name</label>
                {isEditing ? (
                  <input id="user-detail-name" type="text" name="name" value={formData.name} onChange={handleInputChange} className="pq-input" />
                ) : (
                  <p className="font-semibold text-base">{user.name}</p>
                )}
              </div>

              <div>
                <label className="pq-label"><Mail className="w-3.5 h-3.5" aria-hidden="true" /> Email Address</label>
                <p className="font-semibold text-base">{user.email}</p>
                {isEditing && (
                  <p className="text-xs pq-muted mt-1 italic">Login email cannot be changed by administrators.</p>
                )}
              </div>

              <div>
                <label htmlFor="user-detail-phone" className="pq-label"><Phone className="w-3.5 h-3.5" aria-hidden="true" /> Phone Number</label>
                {isEditing ? (
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
                  {isEditing ? (
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
          {isEditing ? (
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
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="order-1 sm:order-3 pq-btn-primary w-full sm:w-auto"
              >
                <Edit2 className="w-4 h-4" aria-hidden="true" />
                Edit Information
              </button>

              <button
                type="button"
                onClick={handlePasswordReset}
                className="order-2 sm:order-1 pq-btn-secondary w-full sm:w-auto text-sm"
              >
                <Key className="w-4 h-4" aria-hidden="true" />
                <span className="sm:hidden lg:inline">Reset Password</span>
                <span className="hidden sm:inline lg:hidden">Reset</span>
              </button>

              <button
                type="button"
                onClick={handleToggleStatus}
                disabled={isTogglingStatus || user.id === "admin"}
                className={`order-3 sm:order-2 w-full sm:w-auto text-sm ${user.status === "active" ? "pq-btn-danger" : "pq-btn-live"}`}
              >
                {user.status === "active" ? <AlertTriangle className="w-4 h-4" aria-hidden="true" /> : <CheckCircle className="w-4 h-4" aria-hidden="true" />}
                <span className="sm:hidden lg:inline">{user.status === "active" ? "Deactivate Account" : "Activate Account"}</span>
                <span className="hidden sm:inline lg:hidden">{user.status === "active" ? "Deactivate" : "Activate"}</span>
              </button>
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
    </div>
  );
}
