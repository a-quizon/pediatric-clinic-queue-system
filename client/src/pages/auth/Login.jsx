import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { loginUser } from "../../services/authService";
import { Activity, Mail, Lock, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";
import { mapAuthError } from "../../utils/authErrors";
import { useAuth } from "../../hooks/useAuth";

export default function Login() {
  const navigate = useNavigate();
  const { user, role, loading: authLoading } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user && role) {
      if (role === 'doctor') navigate('/doctor');
      else if (role === 'secretary') navigate('/secretary');
      else if (role === 'admin') navigate('/admin');
      else navigate('/parent');
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
      const authUser = await loginUser(formData.email, formData.password);
      
      // Verify application-level account status before celebrating authentication success
      const { ref, get } = await import("firebase/database");
      const { database } = await import("../../firebase/database");
      const userRef = ref(database, `users/${authUser.uid}`);
      const snapshot = await get(userRef);

      if (snapshot.exists()) {
        const userData = snapshot.val();
        if (userData.status === 'inactive') {
          // AuthContext will independently intercept this, call signOut(), and show the deactivated toast.
          // We simply reset the local loading state and abort the local success flow.
          setLoading(false);
          return;
        }
      }

      // If active, show success message and keep loading=true while waiting for AuthContext to navigate
      toast.success('Login Successfully');
    } catch (err) {
      console.error('Login failed:', err);
      toast.error(mapAuthError(err.code));
      setLoading(false);
    }
  };

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
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 text-gray-800 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-colors outline-none"
                  placeholder="Enter your password"
                />
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
