import React, { useState, useEffect } from "react";
import { X, Edit2, Shield, Stethoscope, UserCog, User, Mail, Phone, Calendar, Clock, MapPin, CheckCircle, AlertTriangle, Key } from "lucide-react";
import { updateUser, toggleUserStatus, sendAdminPasswordResetEmail } from "../../services/adminService";
import toast from "react-hot-toast";

export default function UserDetailsModal({ isOpen, onClose, user, onUpdate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  useEffect(() => {
    if (user && isOpen) {
      setFormData({
        name: user.name || "",
        email: user.email || "",
        phone: user.phone || "",
        assignedBranch: user.assignedBranch || "Angeles"
      });
      setIsEditing(false);
    }
  }, [user, isOpen]);

  if (!isOpen || !user) return null;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.email.trim()) {
      toast.error("Name and Email are required.");
      return;
    }

    setIsSaving(true);
    try {
      const updates = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone
      };

      if (user.role === "secretary") {
        updates.assignedBranch = formData.assignedBranch;
      }

      await updateUser(user.id, updates);
      toast.success("User updated successfully.");
      setIsEditing(false);
      onUpdate(); // Trigger refresh in parent
    } catch (error) {
      console.error(error);
      toast.error("Failed to update user.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    if (window.confirm(`Are you sure you want to ${user.status === 'active' ? 'deactivate' : 'activate'} this user?`)) {
      setIsTogglingStatus(true);
      try {
        await toggleUserStatus(user.id, user.status);
        toast.success(`User successfully ${user.status === 'active' ? 'deactivated' : 'activated'}.`);
        onUpdate();
      } catch (error) {
        console.error(error);
        toast.error("Failed to change user status.");
      } finally {
        setIsTogglingStatus(false);
      }
    }
  };

  const handlePasswordReset = async () => {
    if (window.confirm(`Send password reset email to ${user.email}?`)) {
      try {
        await sendAdminPasswordResetEmail(user.email);
        toast.success(`Password reset email sent to ${user.email}`);
      } catch (error) {
        console.error(error);
        toast.error("Failed to send password reset email.");
      }
    }
  };

  const getRoleIcon = (role) => {
    switch(role) {
      case 'doctor': return <Stethoscope className="w-5 h-5" />;
      case 'secretary': return <UserCog className="w-5 h-5" />;
      case 'admin': return <Shield className="w-5 h-5" />;
      default: return <User className="w-5 h-5" />;
    }
  };

  const getRoleColor = (role) => {
    switch(role) {
      case 'doctor': return "bg-purple-100 text-purple-600";
      case 'secretary': return "bg-amber-100 text-amber-600";
      case 'admin': return "bg-blue-100 text-blue-600";
      default: return "bg-gray-100 text-gray-600";
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${getRoleColor(user.role)}`}>
              {getRoleIcon(user.role)}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                User Details
              </h2>
              <p className="text-sm text-gray-500 capitalize font-medium">{user.role}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-8">

          {/* Basic Information */}
          <section>
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1.5"><User className="w-3.5 h-3.5"/> Full Name</label>
                {isEditing ? (
                  <input type="text" name="name" value={formData.name} onChange={handleInputChange} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 transition-colors" />
                ) : (
                  <p className="font-medium text-gray-800 text-base">{user.name}</p>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1.5"><Mail className="w-3.5 h-3.5"/> Email Address</label>
                {isEditing ? (
                  <input type="email" name="email" value={formData.email} onChange={handleInputChange} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 transition-colors" />
                ) : (
                  <p className="font-medium text-gray-800 text-base">{user.email}</p>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1.5"><Phone className="w-3.5 h-3.5"/> Phone Number</label>
                {isEditing ? (
                  <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 transition-colors" />
                ) : (
                  <p className="font-medium text-gray-800 text-base">{user.phone || 'Not provided'}</p>
                )}
              </div>
            </div>
            {isEditing && (
              <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3 text-sm text-blue-700">
                <Shield className="w-5 h-5 shrink-0" />
                <p>Changing the email updates their contact profile. It does not automatically change their login credential due to security restrictions.</p>
              </div>
            )}
          </section>

          {/* Account Information */}
          <section>
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">Account Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1.5">Role</label>
                <p className="font-medium text-gray-800 capitalize text-base">{user.role}</p>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1.5">Status</label>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                  user.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
                }`}>
                  {user.status || 'unknown'}
                </span>
              </div>

              {user.role === 'secretary' && (
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5"/> Assigned Branch</label>
                  {isEditing ? (
                    <select name="assignedBranch" value={formData.assignedBranch} onChange={handleInputChange} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 transition-colors">
                      <option value="Angeles">Angeles Branch</option>
                      <option value="Magalang">Magalang Branch</option>
                    </select>
                  ) : (
                    <span className="inline-flex items-center text-sm font-bold text-gray-700 bg-gray-100 px-3 py-1 rounded-full border border-gray-200">
                      {user.assignedBranch}
                    </span>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Audit Information */}
          <section>
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">Audit Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5"/> Created At</label>
                <p className="text-sm font-medium text-gray-800">{formatDate(user.createdAt)}</p>
              </div>

              {user.role !== 'parent' && (
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5"/> Last Updated</label>
                  <p className="text-sm font-medium text-gray-800">{formatDate(user.updatedAt)}</p>
                </div>
              )}
              
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1.5">User ID</label>
                <p className="font-mono text-xs font-medium text-gray-500 break-all">{user.id}</p>
              </div>
            </div>
          </section>

        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-gray-100 bg-gray-50/50">
          {isEditing ? (
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
              <button 
                onClick={() => setIsEditing(false)}
                className="w-full sm:w-auto px-6 py-2.5 text-gray-600 font-bold hover:bg-gray-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="w-full sm:w-auto px-8 py-2.5 bg-blue-600 text-white font-bold rounded-xl shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button 
                onClick={onClose}
                className="order-4 sm:order-1 w-full sm:w-auto px-6 py-2.5 text-gray-500 font-bold hover:bg-gray-200 hover:text-gray-700 rounded-xl transition-colors"
              >
                Close
              </button>
              
              <div className="order-1 sm:order-2 flex flex-col sm:flex-row gap-3 sm:ml-auto">
                <button 
                  onClick={() => setIsEditing(true)}
                  className="order-1 sm:order-3 w-full sm:w-auto px-8 py-2.5 bg-blue-600 text-white font-bold rounded-xl shadow-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit Information
                </button>
                
                <button 
                  onClick={handlePasswordReset}
                  className="order-2 sm:order-1 w-full sm:w-auto px-5 py-2.5 bg-white text-gray-700 font-medium rounded-xl border border-gray-200 hover:bg-gray-100 hover:text-purple-600 transition-colors flex items-center justify-center gap-2 shadow-sm text-sm"
                >
                  <Key className="w-4 h-4" />
                  <span className="sm:hidden lg:inline">Reset Password</span>
                  <span className="hidden sm:inline lg:hidden">Reset</span>
                </button>
                
                <button 
                  onClick={handleToggleStatus}
                  disabled={isTogglingStatus || user.id === "admin"}
                  className={`order-3 sm:order-2 w-full sm:w-auto px-5 py-2.5 font-medium rounded-xl border flex items-center justify-center gap-2 shadow-sm text-sm transition-colors ${
                    user.status === 'active' 
                    ? 'bg-white text-red-600 border-red-200 hover:bg-red-50' 
                    : 'bg-white text-green-600 border-green-200 hover:bg-green-50'
                  }`}
                >
                  {user.status === 'active' ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                  <span className="sm:hidden lg:inline">{user.status === 'active' ? "Deactivate Account" : "Activate Account"}</span>
                  <span className="hidden sm:inline lg:hidden">{user.status === 'active' ? "Deactivate" : "Activate"}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
