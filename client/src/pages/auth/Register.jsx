import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registerUser } from "../../services/authService";
import { Activity, Mail, Lock, User, Phone, ArrowRight, AlertCircle, CheckCircle2 } from "lucide-react";

export default function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    number: '',
    password: '',
    confirmPassword: '',
  });

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await registerUser(
        formData.name,
        formData.email,
        formData.number,
        formData.password
      );
      setSuccess(true);
      setFormData({
        name: '',
        email: '',
        number: '',
        password: '',
        confirmPassword: '',
      });
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (err) {
      console.error('Registration failed:', err);
      setError(err.message || 'An error occurred during registration. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 font-sans py-8">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Header Section */}
        <div className="pt-8 pb-6 px-8 text-center border-b border-gray-50">
          <div className="mx-auto w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-sm border border-blue-100">
            <Activity className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Create Account</h1>
          <p className="text-gray-500 font-medium mt-1 text-sm">Join the Pediatric Clinic System</p>
        </div>

        {/* Form Section */}
        <div className="p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-600 border border-red-100 rounded-xl text-sm font-medium flex items-start">
              <AlertCircle className="w-5 h-5 mr-3 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="mb-6 p-4 bg-green-50 text-green-700 border border-green-100 rounded-xl text-sm font-medium flex items-start">
              <CheckCircle2 className="w-5 h-5 mr-3 shrink-0" />
              <span>Registration successful! Redirecting to login...</span>
            </div>
          )}

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
                  disabled={loading || success}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 text-gray-800 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-colors outline-none"
                  placeholder="John Doe"
                />
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
                  disabled={loading || success}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 text-gray-800 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-colors outline-none"
                  placeholder="Enter your email"
                />
              </div>
            </div>

            <div>
              <label htmlFor="number" className="block text-sm font-semibold text-gray-700 mb-1.5">Phone Number</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Phone className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="tel"
                  id="number"
                  name="number"
                  value={formData.number}
                  onChange={handleChange}
                  required
                  disabled={loading || success}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 text-gray-800 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-colors outline-none"
                  placeholder="09123456789"
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
                  disabled={loading || success}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 text-gray-800 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-colors outline-none"
                  placeholder="Create a password"
                />
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-700 mb-1.5">Confirm Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  disabled={loading || success}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 text-gray-800 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-colors outline-none"
                  placeholder="Confirm your password"
                />
              </div>
            </div>

            <button
              type="submit"
              id="register-submit-btn"
              disabled={loading || success}
              className={`w-full flex items-center justify-center py-3.5 px-4 bg-blue-600 text-white font-bold rounded-xl shadow-sm transition-all mt-4 ${
                loading || success ? "opacity-70 cursor-not-allowed" : "hover:bg-blue-700 hover:shadow"
              }`}
            >
              {loading ? 'Creating Account...' : 'Register'}
              {!loading && !success && <ArrowRight className="w-5 h-5 ml-2" />}
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
