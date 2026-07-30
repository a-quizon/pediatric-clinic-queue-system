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
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${getRoleColor(user.role)}`}>
              {getRoleIcon(user.role)}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                User Details
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  user.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {user.status || 'unknown'}
                </span>
              </h2>
              <p className="text-sm text-gray-500 capitalize font-medium">{user.role}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* Action Bar */}
          <div className="flex flex-wrap gap-3 bg-gray-50 p-3 rounded-2xl border border-gray-100">
            <button 
              onClick={() => setIsEditing(!isEditing)}
              className="px-4 py-2 bg-white text-gray-700 font-medium rounded-xl border border-gray-200 hover:bg-gray-50 hover:text-blue-600 transition-colors flex items-center gap-2 shadow-sm text-sm"
            >
              <Edit2 className="w-4 h-4" />
              {isEditing ? "Cancel Edit" : "Edit Details"}
            </button>
            <button 
              onClick={handlePasswordReset}
              className="px-4 py-2 bg-white text-gray-700 font-medium rounded-xl border border-gray-200 hover:bg-gray-50 hover:text-purple-600 transition-colors flex items-center gap-2 shadow-sm text-sm"
            >
              <Key className="w-4 h-4" />
              Reset Password
            </button>
            <button 
              onClick={handleToggleStatus}
              disabled={isTogglingStatus || user.id === "admin"} // basic safeguard
              className={`px-4 py-2 font-medium rounded-xl border flex items-center gap-2 shadow-sm text-sm ml-auto transition-colors ${
                user.status === 'active' 
                ? 'bg-white text-red-600 border-red-200 hover:bg-red-50' 
                : 'bg-white text-green-600 border-green-200 hover:bg-green-50'
              }`}
            >
              {user.status === 'active' ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
              {user.status === 'active' ? "Deactivate User" : "Activate User"}
            </button>
          </div>

          {isEditing && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3 text-sm text-blue-700">
              <Shield className="w-5 h-5 shrink-0" />
              <p>Note: Changing the email here updates their contact profile. It does not automatically re-provision their authentication login credential due to security restrictions.</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-2">Personal Information</h3>
              
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1.5"><User className="w-3.5 h-3.5"/> Full Name</label>
                {isEditing ? (
                  <input type="text" name="name" value={formData.name} onChange={handleInputChange} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-800" />
                ) : (
                  <p className="font-medium text-gray-800">{user.name}</p>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1.5"><Mail className="w-3.5 h-3.5"/> Email Address</label>
                {isEditing ? (
                  <input type="email" name="email" value={formData.email} onChange={handleInputChange} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-800" />
                ) : (
                  <p className="font-medium text-gray-800">{user.email}</p>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1.5"><Phone className="w-3.5 h-3.5"/> Phone Number</label>
                {isEditing ? (
                  <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-800" />
                ) : (
                  <p className="font-medium text-gray-800">{user.phone || 'Not provided'}</p>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-2">System Information</h3>
              
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1.5">User ID</label>
                <p className="font-mono text-sm text-gray-600 bg-gray-50 px-2 py-1 rounded-md w-fit border border-gray-200">{user.id}</p>
              </div>

              {user.role === 'secretary' && (
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5"/> Assigned Branch</label>
                  {isEditing ? (
                    <select name="assignedBranch" value={formData.assignedBranch} onChange={handleInputChange} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-800">
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

              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5"/> Created At</label>
                <p className="text-sm text-gray-800">{formatDate(user.createdAt)}</p>
              </div>

              {user.role !== 'parent' && (
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5"/> Last Updated</label>
                  <p className="text-sm text-gray-800">{formatDate(user.updatedAt)}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        {isEditing && (
          <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 rounded-b-3xl">
            <button 
              onClick={() => setIsEditing(false)}
              className="px-5 py-2.5 text-gray-600 font-semibold hover:bg-gray-200 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl shadow-sm hover:bg-blue-700 hover:shadow transition-all disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
