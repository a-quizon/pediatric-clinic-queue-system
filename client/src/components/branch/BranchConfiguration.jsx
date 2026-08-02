import React, { useState, useEffect } from 'react';
import { 
  getBranchConfigurations, 
  seedDefaultBranches, 
  createBranch, 
  updateBranch, 
  deleteBranch,
  checkBranchInUse
} from '../../services/branchConfigurationService';
import ConfirmationModal from "../../components/common/ConfirmationModal";
import MessageModal from "../../components/common/MessageModal";
import { 
  MapPin, Plus, Edit2, Trash2, Clock, AlertCircle, X, CheckCircle2 
} from 'lucide-react';

export default function BranchConfiguration() {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' or 'edit'
  const [selectedBranch, setSelectedBranch] = useState(null);
  
  const defaultScheduleState = {
    monday: { isOpen: false, openingTime: '09:00', closingTime: '17:00' },
    tuesday: { isOpen: false, openingTime: '09:00', closingTime: '17:00' },
    wednesday: { isOpen: false, openingTime: '09:00', closingTime: '17:00' },
    thursday: { isOpen: false, openingTime: '09:00', closingTime: '17:00' },
    friday: { isOpen: false, openingTime: '09:00', closingTime: '17:00' },
    saturday: { isOpen: false, openingTime: '09:00', closingTime: '17:00' },
    sunday: { isOpen: false, openingTime: '09:00', closingTime: '17:00' },
  };

  // Form State
  const [branchName, setBranchName] = useState('');
  const [schedule, setSchedule] = useState(defaultScheduleState);
  
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [confirmModal, setConfirmModal] = useState({ isOpen: false, branchId: null, title: "", message: "" });
  const [messageModal, setMessageModal] = useState({ isOpen: false, type: "info", title: "", message: "" });
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const loadBranches = async () => {
      await seedDefaultBranches();
      const data = await getBranchConfigurations();
      setBranches(data);
      setLoading(false);
    };
    loadBranches();
  }, []);

  const handleOpenModal = (mode, branch = null) => {
    setErrorMsg('');
    setModalMode(mode);
    if (mode === 'edit' && branch) {
      setSelectedBranch(branch);
      setBranchName(branch.name);
      
      const loadedSchedule = { ...defaultScheduleState };
      if (branch.schedule) {
        Object.keys(defaultScheduleState).forEach(day => {
          if (branch.schedule[day]) {
            loadedSchedule[day] = {
              isOpen: branch.schedule[day].isOpen || false,
              openingTime: branch.schedule[day].openingTime || '09:00',
              closingTime: branch.schedule[day].closingTime || '17:00'
            };
          }
        });
      }
      setSchedule(loadedSchedule);
    } else {
      setSelectedBranch(null);
      setBranchName('');
      setSchedule({
        monday: { isOpen: true, openingTime: '09:00', closingTime: '17:00' },
        tuesday: { isOpen: true, openingTime: '09:00', closingTime: '17:00' },
        wednesday: { isOpen: true, openingTime: '09:00', closingTime: '17:00' },
        thursday: { isOpen: true, openingTime: '09:00', closingTime: '17:00' },
        friday: { isOpen: true, openingTime: '09:00', closingTime: '17:00' },
        saturday: { isOpen: false, openingTime: '09:00', closingTime: '17:00' },
        sunday: { isOpen: false, openingTime: '09:00', closingTime: '17:00' },
      });
    }
    setIsModalOpen(true);
  };

  const handleScheduleChange = (day, field, value) => {
    setSchedule(prev => ({
      ...prev,
      [day]: { ...prev[day], [field]: value }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    
    if (!branchName.trim()) {
      setErrorMsg('Branch name is required.');
      return;
    }
    
    // Check duplicate branch name
    const isDuplicate = branches.some(b => 
      b.name.toLowerCase() === branchName.trim().toLowerCase() && 
      (modalMode === 'add' || b.id !== selectedBranch.id)
    );
    if (isDuplicate) {
      setErrorMsg('Branch name must be unique.');
      return;
    }

    const hasInvalidOpenDay = Object.values(schedule).some(day => 
      day.isOpen && (!day.openingTime || !day.closingTime)
    );
    if (hasInvalidOpenDay) {
      setErrorMsg('Opening and closing times are required for open days.');
      return;
    }

    setIsSubmitting(true);
    
    const branchData = {
      name: branchName.trim(),
      schedule
    };

    try {
      if (modalMode === 'add') {
        await createBranch(branchData);
      } else if (modalMode === 'edit') {
        await updateBranch(selectedBranch.id, branchData);
      }
      
      const updatedData = await getBranchConfigurations();
      setBranches(updatedData);
      setIsModalOpen(false);
      setMessageModal({
        isOpen: true,
        type: "success",
        title: "Success",
        message: modalMode === 'add' ? "Branch has been successfully created." : "Branch has been successfully updated."
      });
    } catch (err) {
      console.error(err);
      setErrorMsg('An error occurred while saving the branch.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = async (branch) => {
    try {
      const { hasPublishedSchedules, hasActiveReservations } = await checkBranchInUse(branch.name);
      
      if (hasPublishedSchedules || hasActiveReservations) {
        setMessageModal({
          isOpen: true,
          type: "error",
          title: "Cannot Delete Branch",
          message: "This branch cannot be removed because it has active schedules or reservations."
        });
        return;
      }
      
      setConfirmModal({
        isOpen: true,
        branchId: branch.id,
        title: "Delete Branch?",
        message: `Are you sure you want to delete the ${branch.name} branch?`
      });
    } catch (err) {
      console.error(err);
      setMessageModal({
        isOpen: true,
        type: "error",
        title: "Error",
        message: "Failed to check branch status."
      });
    }
  };

  const executeDelete = async () => {
    if (!confirmModal.branchId) return;
    setIsProcessing(true);
    try {
      await deleteBranch(confirmModal.branchId);
      const updatedData = await getBranchConfigurations();
      setBranches(updatedData);
      setConfirmModal(prev => ({ ...prev, isOpen: false }));
      setMessageModal({
        isOpen: true,
        type: "success",
        title: "Branch Deleted",
        message: "The branch has been successfully removed."
      });
    } catch (err) {
      console.error(err);
      setMessageModal({
        isOpen: true,
        type: "error",
        title: "Action Failed",
        message: "Failed to delete branch."
      });
      setConfirmModal(prev => ({ ...prev, isOpen: false }));
    } finally {
      setIsProcessing(false);
    }
  };

  const formatTime = (time) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const formattedH = h % 12 || 12;
    return `${formattedH}:${minutes} ${ampm}`;
  };

  const daysOfWeek = [
    { key: 'monday', label: 'Monday' },
    { key: 'tuesday', label: 'Tuesday' },
    { key: 'wednesday', label: 'Wednesday' },
    { key: 'thursday', label: 'Thursday' },
    { key: 'friday', label: 'Friday' },
    { key: 'saturday', label: 'Saturday' },
    { key: 'sunday', label: 'Sunday' },
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6 relative">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Branch Configuration</h1>
          <p className="text-gray-500 mt-1">Manage clinic branches and their operating hours</p>
        </div>
        <button 
          onClick={() => handleOpenModal('add')}
          className="px-5 py-2.5 bg-blue-600 text-white font-bold rounded-xl shadow-sm hover:bg-blue-700 hover:shadow transition-all flex items-center"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Branch
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {branches.map(branch => (
          <div key={branch.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-100 transition-all p-5 flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold text-gray-800 flex items-center">
                <MapPin className="w-6 h-6 mr-2 text-blue-500 bg-blue-50 p-1 rounded-lg" />
                {branch.name}
              </h3>
            </div>
            
            <div className="flex-1 space-y-3 mb-6">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Clinic Schedule</h4>
              <div className="space-y-2">
                {branch.schedule && daysOfWeek.map(({ key, label }) => {
                  const dayData = branch.schedule[key];
                  if (!dayData) return null;
                  
                  return (
                    <div key={key} className={`flex justify-between items-center p-2 rounded-lg border ${dayData.isOpen ? 'bg-blue-50/50 border-blue-100' : 'bg-gray-50 border-gray-100'}`}>
                      <span className={`text-sm font-semibold ${dayData.isOpen ? 'text-gray-800' : 'text-gray-400'}`}>
                        {label}
                      </span>
                      {dayData.isOpen ? (
                        <div className="flex items-center text-xs font-medium text-gray-600">
                          <Clock className="w-3.5 h-3.5 mr-1 text-blue-500" />
                          {formatTime(dayData.openingTime)} - {formatTime(dayData.closingTime)}
                        </div>
                      ) : (
                        <span className="text-xs font-semibold text-gray-400 bg-gray-200/50 px-2 py-0.5 rounded-md">
                          Closed
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-4 border-t border-gray-50 mt-auto">
              <button 
                onClick={() => handleOpenModal('edit', branch)}
                className="flex-1 py-2 bg-blue-50 text-blue-600 text-sm font-semibold rounded-xl hover:bg-blue-100 transition-colors flex items-center justify-center"
              >
                <Edit2 className="w-4 h-4 mr-1.5" />
                Edit
              </button>
              <button 
                onClick={() => handleDeleteClick(branch)}
                className="flex-1 py-2 bg-red-50 text-red-600 text-sm font-semibold rounded-xl hover:bg-red-100 transition-colors flex items-center justify-center"
              >
                <Trash2 className="w-4 h-4 mr-1.5" />
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-white">
              <h2 className="text-xl font-bold text-gray-800">
                {modalMode === 'add' ? 'Add Branch' : 'Edit Branch'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1">
              {errorMsg && (
                <div className="mb-5 p-4 bg-red-50 text-red-600 border border-red-100 rounded-xl text-sm font-medium flex items-start">
                  <AlertCircle className="w-5 h-5 mr-2 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form id="branch-form" onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Branch Name</label>
                  <input
                    type="text"
                    value={branchName}
                    onChange={(e) => setBranchName(e.target.value)}
                    placeholder="e.g. San Fernando"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-colors text-gray-800"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Weekly Schedule</label>
                  <div className="space-y-3">
                    {daysOfWeek.map(({ key, label }) => {
                      const dayState = schedule[key];
                      return (
                        <div key={key} className={`p-4 rounded-xl border transition-all ${dayState.isOpen ? 'bg-white border-blue-200 shadow-sm' : 'bg-gray-50 border-gray-200'}`}>
                          <div className="flex items-center justify-between mb-3">
                            <span className={`font-bold ${dayState.isOpen ? 'text-gray-800' : 'text-gray-500'}`}>{label}</span>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input 
                                type="checkbox" 
                                className="sr-only peer"
                                checked={dayState.isOpen}
                                onChange={(e) => handleScheduleChange(key, 'isOpen', e.target.checked)}
                              />
                              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                              <span className={`ml-3 text-sm font-medium ${dayState.isOpen ? 'text-blue-600' : 'text-gray-400'}`}>
                                {dayState.isOpen ? 'Open' : 'Closed'}
                              </span>
                            </label>
                          </div>
                          
                          {dayState.isOpen && (
                            <div className="grid grid-cols-2 gap-4 mt-2 pt-3 border-t border-gray-100">
                              <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Opening Time</label>
                                <input
                                  type="time"
                                  value={dayState.openingTime}
                                  onChange={(e) => handleScheduleChange(key, 'openingTime', e.target.value)}
                                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm text-gray-800"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Closing Time</label>
                                <input
                                  type="time"
                                  value={dayState.closingTime}
                                  onChange={(e) => handleScheduleChange(key, 'closingTime', e.target.value)}
                                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm text-gray-800"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </form>
            </div>

            <div className="p-5 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={isSubmitting}
                className="px-5 py-2.5 text-gray-600 font-semibold rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="branch-form"
                disabled={isSubmitting}
                className={`px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl shadow-sm transition-all ${
                  isSubmitting ? "opacity-70 cursor-not-allowed" : "hover:bg-blue-700 hover:shadow"
                }`}
              >
                {isSubmitting ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={executeDelete}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        loading={isProcessing}
      />

      <MessageModal
        isOpen={messageModal.isOpen}
        type={messageModal.type}
        title={messageModal.title}
        message={messageModal.message}
        onClose={() => setMessageModal(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
