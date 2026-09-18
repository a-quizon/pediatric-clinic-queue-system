import React, { useState, useEffect } from "react";
import { X, UserPlus, Stethoscope, UserCog, Mail, Phone, Lock, MapPin, Eye, EyeOff } from "lucide-react";
import toast from "react-hot-toast";
import { createStaffAccount } from "../../services/adminService";
import { getBranchConfigurations } from "../../services/branchConfigurationService";
import { formatName } from "../../utils/stringUtils";
import { usePasswordValidation } from "../../utils/passwordUtils";
import { formatToE164 } from "../../utils/phoneUtils";
import { useHistoryOverlay } from "../../hooks/useHistoryOverlay";

export default function AddStaffModal({ isOpen, onClose, onSuccess }) {
  const [step, setStep] = useState(1);
  const [role, setRole] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    assignedBranch: ""
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState([]);

  const { isValid: isPasswordValid, errors: passwordErrors, isChecking } = usePasswordValidation(formData.password);

  const passwordInvalid = formData.password.length > 0 && !isPasswordValid;
  const confirmInvalid = formData.confirmPassword.length > 0 && formData.password !== formData.confirmPassword;
  const isPasswordFormValid = isPasswordValid && formData.password === formData.confirmPassword && !isChecking;

  useHistoryOverlay(isOpen, onClose);

  useEffect(() => {
    if (isOpen) {
      getBranchConfigurations().then(setBranches).catch(console.error);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const resetState = () => {
    setStep(1);
    setRole(null);
    setFormData({
      name: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      assignedBranch: ""
    });
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const handleClose = () => {
    if (!loading) {
      resetState();
      onClose();
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "phone") {
      const sanitized = value.replace(/\D/g, "");
      setFormData((prev) => ({ ...prev, [name]: sanitized }));
      return;
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleContinue = () => {
    if (!role) {
      toast.error("Please select a role to continue.");
      return;
    }
    setStep(2);
  };

  const validateForm = () => {
    const { name, email, phone, password, confirmPassword, assignedBranch } = formData;
    if (!name.trim()) return "Name is required.";
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email)) return "A valid email is required.";
    if (!phone.trim() || phone.length !== 10) return "Phone number must be exactly 10 digits.";

    if (!password) return "Password is required.";
    if (!isPasswordValid) return "Password does not meet requirements.";
    if (password !== confirmPassword) return "Passwords do not match.";

    if (role === "secretary" && !assignedBranch) {
      return "Assigned Branch is required for Secretary.";
    }

    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isChecking) return;

    const errorMsg = validateForm();
    if (errorMsg) {
      toast.error(errorMsg);
      return;
    }

    setLoading(true);
    try {
      const selectedBranch = branches.find((b) => b.name === formData.assignedBranch);
      await createStaffAccount({
        role,
        name: formatName(formData.name),
        email: formData.email.trim(),
        phone: formatToE164(formData.phone),
        password: formData.password,
        assignedBranch: role === "secretary" ? (selectedBranch?.name || formData.assignedBranch) : null,
        assignedBranchId: role === "secretary" ? (selectedBranch?.id || null) : null
      });

      toast.success(`${role.charAt(0).toUpperCase() + role.slice(1)} account created successfully!`);
      resetState();
      onSuccess();
    } catch (error) {
      console.error("Create Staff Error:", error);
      let errMsg = error.message;
      if (error.code === "auth/email-already-in-use") {
        errMsg = "The email address is already in use by another account.";
      }
      toast.error(errMsg || "An error occurred while creating the account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pq-modal-scrim z-50">
      <div className="pq-modal w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]" role="dialog" aria-modal="true" aria-labelledby="add-staff-title">
        <div className="flex justify-between items-center p-5" style={{ borderBottom: "1px solid var(--pq-glass-line)" }}>
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-[0.9rem] flex items-center justify-center shrink-0"
              style={{ background: "color-mix(in srgb, var(--pq-mark-blue) 14%, white)", color: "var(--pq-mark-blue-deep)" }}
            >
              <UserPlus className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 id="add-staff-title" className="text-lg font-extrabold tracking-tight leading-none">
                {step === 1 ? "Add Staff" : `Create ${role.charAt(0).toUpperCase() + role.slice(1)}`}
              </h2>
              <p className="text-xs font-semibold pq-muted uppercase tracking-wider mt-1">
                {step === 1 ? "Step 1 of 2" : "Step 2 of 2"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="pq-icon-btn"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {step === 1 ? (
            <div className="space-y-3">
              <p className="text-sm pq-muted font-medium mb-2">Select the role for the new staff member:</p>

              <button
                type="button"
                onClick={() => setRole("doctor")}
                className={`w-full text-left ${role === "doctor" ? "pq-row pq-row-you" : "pq-row"}`}
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 mr-4"
                  style={role === "doctor"
                    ? { background: "var(--pq-mark-blue)", color: "#fff" }
                    : { background: "color-mix(in srgb, #ffffff 55%, transparent)", color: "var(--pq-ink-faint)" }}
                >
                  <Stethoscope className="w-6 h-6" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-extrabold tracking-tight">Doctor</h3>
                  <p className="text-xs pq-muted mt-0.5">Manages clinic schedules, consultations, and queue status.</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setRole("secretary")}
                className={`w-full text-left ${role === "secretary" ? "pq-row pq-row-you" : "pq-row"}`}
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 mr-4"
                  style={role === "secretary"
                    ? { background: "var(--pq-mark-blue)", color: "#fff" }
                    : { background: "color-mix(in srgb, #ffffff 55%, transparent)", color: "var(--pq-ink-faint)" }}
                >
                  <UserCog className="w-6 h-6" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-extrabold tracking-tight">Secretary</h3>
                  <p className="text-xs pq-muted mt-0.5">Validates reservations, manages the waiting queue, and assists patients.</p>
                </div>
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} id="staff-form" className="space-y-4">
              <div>
                <label htmlFor="staff-name" className="pq-label">Full Name <span style={{ color: "var(--pq-alert)" }}>*</span></label>
                <div className="relative">
                  <div className="pq-field-icon">
                    <UserPlus className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <input
                    id="staff-name"
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    disabled={loading}
                    className="pq-input pl-10"
                    placeholder="Enter full name"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="staff-email" className="pq-label">Email Address <span style={{ color: "var(--pq-alert)" }}>*</span></label>
                <div className="relative">
                  <div className="pq-field-icon">
                    <Mail className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <input
                    id="staff-email"
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    disabled={loading}
                    className="pq-input pl-10"
                    placeholder="Enter email address"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="staff-phone" className="pq-label">Phone Number <span style={{ color: "var(--pq-alert)" }}>*</span></label>
                <div className="relative">
                  <div className="pq-field-icon">
                    <Phone className="h-5 w-5" aria-hidden="true" />
                    <span className="pq-muted font-medium text-sm">+63</span>
                  </div>
                  <input
                    id="staff-phone"
                    type="tel"
                    name="phone"
                    maxLength={10}
                    value={formData.phone}
                    onChange={handleChange}
                    required
                    disabled={loading}
                    className="pq-input pl-20"
                    placeholder="9123456789"
                  />
                </div>
              </div>

              {role === "secretary" && (
                <div>
                  <label htmlFor="staff-branch" className="pq-label">Assigned Branch <span style={{ color: "var(--pq-alert)" }}>*</span></label>
                  <div className="relative">
                    <div className="pq-field-icon">
                      <MapPin className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <select
                      id="staff-branch"
                      name="assignedBranch"
                      value={formData.assignedBranch}
                      onChange={handleChange}
                      required
                      disabled={loading}
                      className="pq-input pl-10 appearance-none"
                    >
                      <option value="" disabled>Select assigned branch</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.name}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="staff-password" className="pq-label">Password <span style={{ color: "var(--pq-alert)" }}>*</span></label>
                  <div className="relative">
                    <div className="pq-field-icon">
                      <Lock className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <input
                      id="staff-password"
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      required
                      disabled={loading}
                      className={`pq-input pl-10 pr-11 text-sm ${passwordInvalid ? "pq-input-error" : ""}`}
                      placeholder="Min 12 chars"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="pq-field-toggle"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {passwordInvalid && passwordErrors.length > 0 && (
                    <p className="pq-error-text pt-1">{passwordErrors[0]}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="staff-confirm-password" className="pq-label">Confirm Password <span style={{ color: "var(--pq-alert)" }}>*</span></label>
                  <div className="relative">
                    <div className="pq-field-icon">
                      <Lock className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <input
                      id="staff-confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      required
                      disabled={loading}
                      className={`pq-input pl-10 pr-11 text-sm ${confirmInvalid ? "pq-input-error" : ""}`}
                      placeholder="Confirm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="pq-field-toggle"
                      aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {confirmInvalid && (
                    <p className="pq-error-text pt-1">Passwords do not match.</p>
                  )}
                </div>
              </div>
            </form>
          )}
        </div>

        <div className="p-5 flex gap-3 justify-end mt-auto" style={{ borderTop: "1px solid var(--pq-glass-line)" }}>
          {step === 2 && (
            <button
              type="button"
              onClick={() => setStep(1)}
              disabled={loading}
              className="pq-btn-secondary"
            >
              Back
            </button>
          )}

          {step === 1 ? (
            <button
              type="button"
              onClick={handleContinue}
              disabled={!role}
              className="pq-btn-primary"
            >
              Continue
            </button>
          ) : (
            <button
              type="submit"
              form="staff-form"
              disabled={loading || !isPasswordFormValid || isChecking}
              className="pq-btn-primary"
            >
              {loading ? "Creating..." : "Create Account"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
