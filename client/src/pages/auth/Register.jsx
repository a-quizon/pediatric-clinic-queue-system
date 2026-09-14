import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registerUser } from "../../services/authService";
import { sendSmsOtp, verifySmsOtp } from "../../services/smsAuthService";
import { Mail, Lock, User, Phone, ArrowRight, Eye, EyeOff, KeyRound, CheckCircle2 } from "lucide-react";
import { PqAuthShell, PqBrand } from "../../components/parent/pqUi";
import OnboardingStepper from "../../components/auth/OnboardingStepper";
import toast from "react-hot-toast";
import { mapAuthError } from "../../utils/authErrors";
import { usePasswordValidation } from "../../utils/passwordUtils";
import { formatName } from "../../utils/stringUtils";
import { formatToE164 } from "../../utils/phoneUtils";
import { formatOtpCountdown, startOtpAutofill } from "../../utils/loginIdentifier";

const RESEND_COOLDOWN_SEC = 90;

export default function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    number: '',
    otp: '',
    password: '',
    confirmPassword: '',
  });

  const [loading, setLoading] = useState(false);
  const [otpBusy, setOtpBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [otpSent, setOtpSent] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [verificationId, setVerificationId] = useState("");
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const otpInputRef = useRef(null);

  const { isValid: isPasswordValid, errors: passwordErrors, isChecking } = usePasswordValidation(formData.password);

  const passwordInvalid = formData.password.length > 0 && !isPasswordValid;
  const confirmInvalid = formData.confirmPassword.length > 0 && formData.password !== formData.confirmPassword;
  const isFormValid =
    formData.name.trim() &&
    formData.email.trim() &&
    formData.number.length === 10 &&
    phoneVerified &&
    isPasswordValid &&
    formData.password === formData.confirmPassword &&
    !isChecking;

  useEffect(() => {
    if (cooldownLeft <= 0) return undefined;
    const id = setInterval(() => {
      setCooldownLeft((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [cooldownLeft]);

  useEffect(() => {
    if (!otpSent || phoneVerified) return undefined;
    return startOtpAutofill((code) => {
      setFormData((prev) => ({ ...prev, otp: code }));
    });
  }, [otpSent, phoneVerified]);

  const resetPhoneVerification = () => {
    setOtpSent(false);
    setPhoneVerified(false);
    setVerificationId("");
    setFormData((prev) => ({ ...prev, otp: "" }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "number") {
      const sanitized = value.replace(/\D/g, "").slice(0, 10);
      setFormData((prev) => ({ ...prev, number: sanitized }));
      // Reset verification for new digits, but keep resend cooldown
      // tied to time since last OTP send (not the phone field value).
      if (sanitized !== formData.number) {
        resetPhoneVerification();
      }
      return;
    }
    if (name === "otp") {
      setFormData((prev) => ({ ...prev, otp: value.replace(/\D/g, "").slice(0, 6) }));
      return;
    }
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSendCode = async () => {
    if (formData.number.length !== 10) {
      toast.error("Enter a valid 10-digit mobile number first.");
      return;
    }
    if (cooldownLeft > 0) return;

    setOtpBusy(true);
    try {
      await sendSmsOtp(formData.number, "register");
      setOtpSent(true);
      setPhoneVerified(false);
      setVerificationId("");
      setFormData((prev) => ({ ...prev, otp: "" }));
      setCooldownLeft(RESEND_COOLDOWN_SEC);
      toast.success("Verification code sent via SMS.");
      setTimeout(() => otpInputRef.current?.focus(), 50);
    } catch (err) {
      toast.error(
        err.code === "rate_limited" && err.message
          ? err.message
          : err.message || "Failed to send OTP, please try again."
      );
      if (err.retryAfterSeconds) setCooldownLeft(err.retryAfterSeconds);
    } finally {
      setOtpBusy(false);
    }
  };

  const handleVerifyCode = async () => {
    if (formData.otp.length !== 6) {
      toast.error("Enter the 6-digit verification code.");
      return;
    }
    setOtpBusy(true);
    try {
      const result = await verifySmsOtp(formData.number, formData.otp, "register");
      setPhoneVerified(true);
      setVerificationId(result.verificationId || "");
      toast.success("Phone number verified.");
    } catch (err) {
      toast.error(err.message || "Verification failed.");
    } finally {
      setOtpBusy(false);
    }
  };

  const handleOtpAction = async () => {
    if (!otpSent || phoneVerified) {
      await handleSendCode();
      return;
    }
    await handleVerifyCode();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!phoneVerified || !verificationId) {
      toast.error("Please verify your phone number before creating an account.");
      return;
    }

    if (formData.number.length !== 10) {
      toast.error('Phone number must be exactly 10 digits.');
      return;
    }

    if (isChecking) return;

    if (!isPasswordValid) {
      toast.error('Password does not meet requirements.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await registerUser(
        formatName(formData.name),
        formData.email.trim(),
        formatToE164(formData.number),
        formData.password,
        {
          isPhoneVerified: true,
          phoneVerificationId: verificationId,
        }
      );
      navigate('/verify-email');
    } catch (err) {
      console.error('Registration failed:', err);
      if (err.code === 'auth/verification-email-failed') {
        toast.error('Account created, but verification email failed to send. You can resend it later.');
        navigate('/verify-email');
      } else {
        toast.error(mapAuthError(err.code) || err.message);
      }
      setLoading(false);
    }
  };

  const otpButtonLabel = () => {
    if (otpBusy) return "Please wait...";
    if (phoneVerified) return "Verified";
    if (!otpSent) return "Send Code";
    return "Verify";
  };

  return (
    <PqAuthShell>
      <div className="pq-glass-window overflow-hidden">
        <div className="pt-8 pb-6 px-8 text-center" style={{ borderBottom: "1px solid var(--pq-glass-line)" }}>
          <div className="flex justify-center mb-4">
            <PqBrand size={72} stacked />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">Create Account</h1>
          <p className="pq-muted mt-1 text-sm">Verify your phone, then confirm your email</p>
          <div className="mt-5">
            <OnboardingStepper
              currentStep={phoneVerified ? 2 : 1}
              steps={[
                { id: 1, label: "Verify Phone" },
                { id: 2, label: "Account" },
              ]}
            />
          </div>
        </div>

        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-4" id="register-form">
            {!phoneVerified && (
            <>
            <div>
              <label htmlFor="name" className="pq-label">Full Name</label>
              <div className="relative">
                <div className="pq-field-icon">
                  <User className="h-5 w-5" />
                </div>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  className="pq-input pl-11"
                  placeholder="John Doe"
                />
              </div>
            </div>

            <div>
              <label htmlFor="number" className="pq-label">Phone Number</label>
              <div className="relative">
                <div className="pq-field-icon gap-2">
                  <Phone className="h-5 w-5" />
                  <span className="pq-muted font-medium">+63</span>
                </div>
                <input
                  type="tel"
                  id="number"
                  name="number"
                  maxLength={10}
                  value={formData.number}
                  onChange={handleChange}
                  required
                  disabled={loading || phoneVerified}
                  autoComplete="tel-national"
                  className="pq-input pl-20"
                  placeholder="9123456789"
                />
                {phoneVerified && (
                  <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5" style={{ color: "var(--pq-live)" }} />
                )}
              </div>
            </div>

            <div>
              <label htmlFor="otp" className="pq-label">Verification Code</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <div className="pq-field-icon">
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <input
                    ref={otpInputRef}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    id="otp"
                    name="otp"
                    value={formData.otp}
                    onChange={handleChange}
                    disabled={loading || phoneVerified || !otpSent}
                    autoComplete="one-time-code"
                    autoCorrect="off"
                    spellCheck={false}
                    className="pq-input pl-11 tracking-widest"
                    placeholder="6-digit code"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleOtpAction}
                  disabled={
                    loading ||
                    otpBusy ||
                    phoneVerified ||
                    formData.number.length !== 10 ||
                    (!otpSent && cooldownLeft > 0) ||
                    (otpSent && formData.otp.length !== 6)
                  }
                  className={`shrink-0 min-h-[44px] px-4 rounded-[0.95rem] text-sm font-bold ${
                    phoneVerified
                      ? "pq-note-ok cursor-default"
                      : "pq-btn-primary"
                  }`}
                >
                  {otpButtonLabel()}
                </button>
              </div>
              <div className="mt-1.5 min-h-[1.25rem]">
                {phoneVerified ? (
                  <p className="pq-ok-text">Phone verified. You can continue registration.</p>
                ) : cooldownLeft > 0 ? (
                  <p className="text-xs font-semibold pq-muted">
                    Resend code in {formatOtpCountdown(cooldownLeft)}
                  </p>
                ) : otpSent ? (
                  <button
                    type="button"
                    onClick={handleSendCode}
                    disabled={otpBusy || loading}
                    className="pq-link text-xs"
                  >
                    Resend code
                  </button>
                ) : (
                  <p className="text-xs pq-faint">Verify your phone before creating an account.</p>
                )}
              </div>
            </div>
            </>
            )}

            {phoneVerified && (
            <>
            <div className="pq-note pq-note-ok text-sm">
              Phone verified. Continue with your email and password.
              <button
                type="button"
                onClick={resetPhoneVerification}
                className="pq-link text-xs block mt-1"
              >
                Use a different number
              </button>
            </div>

            <div>
              <label htmlFor="email" className="pq-label">Email Address</label>
              <div className="relative">
                <div className="pq-field-icon">
                  <Mail className="h-5 w-5" />
                </div>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  className="pq-input pl-11"
                  placeholder="Enter your email"
                />
              </div>
              <p className="text-xs pq-faint mt-1">Email verification comes after phone verification.</p>
            </div>

            <div>
              <label htmlFor="password" className="pq-label">Password</label>
              <div className="relative">
                <div className="pq-field-icon">
                  <Lock className="h-5 w-5" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  className={`pq-input pl-11 pr-11 ${passwordInvalid ? "pq-input-error" : ""}`}
                  placeholder="Create a password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center pq-faint min-w-[44px] justify-end"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {passwordInvalid && passwordErrors.length > 0 && (
                <p className="pq-error-text px-1 pt-1.5">
                  {passwordErrors[0]}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="pq-label">Confirm Password</label>
              <div className="relative">
                <div className="pq-field-icon">
                  <Lock className="h-5 w-5" />
                </div>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  className={`pq-input pl-11 pr-11 ${confirmInvalid ? "pq-input-error" : ""}`}
                  placeholder="Confirm your password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center pq-faint min-w-[44px] justify-end"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {confirmInvalid && (
                <p className="pq-error-text px-1 pt-1.5">
                  Passwords do not match.
                </p>
              )}
            </div>

            <button
              type="submit"
              id="register-submit-btn"
              disabled={loading || !isFormValid || isChecking}
              className="pq-btn-primary w-full mt-4"
            >
              {loading ? "Creating Account..." : "Register"}
              {!loading && <ArrowRight className="w-5 h-5" />}
            </button>
            {!isFormValid && (
              <p className="text-xs pq-muted text-center">
                Enter email and matching passwords to create your account.
              </p>
            )}
            </>
            )}
          </form>

          <div className="mt-8 text-center">
            <p className="pq-muted text-sm">
              Already have an account?{' '}
              <Link to="/" className="pq-link">
                Back to Login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </PqAuthShell>
  );
}
