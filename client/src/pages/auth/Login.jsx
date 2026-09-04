import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  loginUser,
  canParentSelfReactivate,
  reactivateSelfDeactivatedParent,
  getParentPostAuthPath,
} from "../../services/authService";
import { Activity, Mail, Lock, ArrowRight, Eye, EyeOff } from "lucide-react";
import toast from "react-hot-toast";
import { mapAuthError } from "../../utils/authErrors";
import { useAuth } from "../../hooks/useAuth";
import { auth } from "../../firebase/auth";
import { signOut } from "firebase/auth";

export default function Login() {
  const navigate = useNavigate();
  const { user, role, loading: authLoading } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      if (role) {
        if (role === 'doctor') navigate('/doctor');
        else if (role === 'secretary') navigate('/secretary');
        else if (role === 'admin') navigate('/admin');
        else {
          navigate(getParentPostAuthPath(user, auth.currentUser));
        }
      } else {
        // User exists but has no RTDB profile (role is null)
        const firebaseUser = auth.currentUser;
        if (firebaseUser && !firebaseUser.emailVerified) {
          navigate('/verify-email');
        } else if (firebaseUser && firebaseUser.emailVerified) {
          // Verified Firebase user but no application profile (State F)
          signOut(auth).then(() => {
            toast.error('Account profile not found. Please contact the administrator.');
          });
        }
      }
    }
  }, [user, role, authLoading, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const authUser = await loginUser(formData.email.trim(), formData.password);
      
      // Verify application-level account status before celebrating authentication success
      const { ref, get } = await import("firebase/database");
      const { database } = await import("../../firebase/database");
      const userRef = ref(database, `users/${authUser.uid}`);
      const snapshot = await get(userRef);

      if (snapshot.exists()) {
        let userData = snapshot.val();
        if (userData.isDeleted) {
          await signOut(auth);
          toast.error("This account has been deleted.");
          setLoading(false);
          return;
        }

        if (userData.status === "inactive") {
          if (canParentSelfReactivate(userData)) {
            await reactivateSelfDeactivatedParent(authUser.uid);
            userData = { ...userData, status: "active", deactivationSource: null };
            toast.success("Welcome back. Your account has been reactivated.");
          } else {
            setLoading(false);
            return;
          }
        } else {
          toast.success("Login Successfully");
        }

        if (userData.role === "parent" && !authUser.emailVerified) {
          toast("Please verify your email before continuing.", { icon: "ℹ️" });
          navigate("/verify-email");
          setLoading(false);
          return;
        }

        if (userData.role === "parent") {
          if (userData.onboardingComplete === false) {
            navigate("/onboarding/child");
          }
          const { requestPushPermissionAfterLogin } = await import("../../services/pushService");
          await requestPushPermissionAfterLogin({
            uid: authUser.uid,
            role: "parent",
            devicePushEnabled: userData.devicePushEnabled,
          });
        }
      } else {
        // No RTDB profile exists
        if (!authUser.emailVerified) {
          // State D: Unverified Pending Parent
          toast('Please verify your email before continuing.', { icon: 'ℹ️' });
          navigate('/verify-email');
          return;
        } else {
          // State F: Verified Firebase User Without Profile
          await signOut(auth);
          toast.error('Account profile not found. Please contact the administrator.');
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      console.error('Login failed:', err);
      toast.error(mapAuthError(err.code));
      setLoading(false);
    }
  };

  if (authLoading || (user && role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 font-sans">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 font-sans">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Header Section */}
        <div className="pt-10 pb-6 px-8 text-center border-b border-gray-50">
          <div className="mx-auto w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-blue-100">
            <Activity className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Pediatric Clinic Queue System</h1>
        </div>

        {/* Form Section */}
        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-5" id="login-form">
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
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 text-gray-800 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-colors outline-none"
                  placeholder="Enter your email"
                />
              </div>
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
                  className="w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-200 text-gray-800 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-colors outline-none"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <div className="flex justify-end mt-2">
                <Link to="/forgot-password" className="text-sm font-semibold text-blue-600 hover:underline transition-all">
                  Forgot Password?
                </Link>
              </div>
            </div>

            <button
              type="submit"
              id="login-submit-btn"
              disabled={loading}
              className={`w-full flex items-center justify-center py-3.5 px-4 bg-blue-600 text-white font-bold rounded-xl shadow-sm transition-all mt-2 ${
                loading ? "opacity-70 cursor-not-allowed" : "hover:bg-blue-700 hover:shadow"
              }`}
            >
              {loading ? 'Authenticating...' : 'Sign In'}
              {!loading && <ArrowRight className="w-5 h-5 ml-2" />}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-gray-500 text-sm">
              Don't have an account?{' '}
              <Link to="/register" className="text-blue-600 font-semibold hover:underline transition-all">
                Create Account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
