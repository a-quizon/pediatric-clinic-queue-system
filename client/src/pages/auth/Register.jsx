import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registerUser } from "../../services/authService";
import { sendSmsOtp, verifySmsOtp } from "../../services/smsAuthService";
import { Activity, Mail, Lock, User, Phone, ArrowRight, Eye, EyeOff, KeyRound, CheckCircle2 } from "lucide-react";
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
      if (sanitized !== formData.number) {
        resetPhoneVerification();
        setCooldownLeft(0);
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
      toast.error(err.message || "Failed to send code.");
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 font-sans py-8">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="pt-8 pb-6 px-8 text-center border-b border-gray-50">
          <div className="mx-auto w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-sm border border-blue-100">
            <Activity className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Create Account</h1>
          <p className="text-gray-500 font-medium mt-1 text-sm">Verify your phone, then confirm your email</p>
        </div>

        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-4" id="register-form">
            <div>
              <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-1.5">Full Name</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 text-gray-800 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-colors outline-none"
                  placeholder="John Doe"
                />
              </div>
            </div>

            <div>
              <label htmlFor="number" className="block text-sm font-semibold text-gray-700 mb-1.5">Phone Number</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Phone className="h-5 w-5 text-gray-400" />
                  <span className="ml-2 text-gray-500 font-medium">+63</span>
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
                  className="w-full pl-20 pr-4 py-2.5 bg-gray-50 border border-gray-200 text-gray-800 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-colors outline-none"
                  placeholder="9123456789"
                />
                {phoneVerified && (
                  <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-emerald-500" />
                )}
              </div>
            </div>

            <div>
              <label htmlFor="otp" className="block text-sm font-semibold text-gray-700 mb-1.5">Verification Code</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <KeyRound className="h-5 w-5 text-gray-400" />
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
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 text-gray-800 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-colors outline-none tracking-widest"
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
                  className={`shrink-0 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    phoneVerified
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default"
                      : otpBusy || formData.number.length !== 10 || (!otpSent && cooldownLeft > 0) || (otpSent && formData.otp.length !== 6)
                        ? "bg-blue-300 text-white cursor-not-allowed"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  {otpButtonLabel()}
                </button>
              </div>
              <div className="mt-1.5 min-h-[1.25rem]">
                {phoneVerified ? (
                  <p className="text-xs font-semibold text-emerald-600">Phone verified. You can continue registration.</p>
                ) : cooldownLeft > 0 ? (
                  <p className="text-xs font-semibold text-gray-500">
                    Resend code in {formatOtpCountdown(cooldownLeft)}
                  </p>
                ) : otpSent ? (
                  <button
                    type="button"
                    onClick={handleSendCode}
                    disabled={otpBusy || loading}
                    className="text-xs font-semibold text-blue-600 hover:underline"
                  >
                    Resend code
                  </button>
                ) : (
                  <p className="text-xs text-gray-400">Verify your phone before creating an account.</p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-1.5">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 text-gray-800 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-colors outline-none"
                  placeholder="Enter your email"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">Email verification comes after phone verification.</p>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  className={`w-full pl-10 pr-10 py-2.5 bg-gray-50 border text-gray-800 rounded-xl focus:outline-none transition-colors ${
                    passwordInvalid
                      ? 'border-red-300 focus:ring-2 focus:ring-red-500/20 focus:border-red-500'
                      : 'border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white'
                  }`}
                  placeholder="Create a password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {passwordInvalid && passwordErrors.length > 0 && (
                <p className="text-xs text-red-500 font-semibold px-1 pt-1.5">
                  {passwordErrors[0]}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-700 mb-1.5">Confirm Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  className={`w-full pl-10 pr-10 py-2.5 bg-gray-50 border text-gray-800 rounded-xl focus:outline-none transition-colors ${
                    confirmInvalid
                      ? 'border-red-300 focus:ring-2 focus:ring-red-500/20 focus:border-red-500'
                      : 'border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white'
                  }`}
                  placeholder="Confirm your password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {confirmInvalid && (
                <p className="text-xs text-red-500 font-semibold px-1 pt-1.5">
                  Passwords do not match.
                </p>
              )}
            </div>

            <button
              type="submit"
              id="register-submit-btn"
              disabled={loading || !isFormValid || isChecking}
              className={`w-full flex items-center justify-center py-3.5 px-4 font-bold rounded-xl shadow-sm transition-all mt-4 ${
                loading || !isFormValid || isChecking ? "bg-blue-400 text-white cursor-not-allowed" : "bg-blue-600 text-white hover:bg-blue-700 hover:shadow"
              }`}
            >
              {loading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Creating Account...
                </div>
              ) : 'Register'}
              {!loading && <ArrowRight className="w-5 h-5 ml-2" />}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-gray-500 text-sm">
              Already have an account?{' '}
              <Link to="/" className="text-blue-600 font-semibold hover:underline transition-all">
                Back to Login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
