import React, { useState, useEffect } from 'react';
import { createBranch, updateBranch } from '../../services/branchConfigurationService';
import { AlertCircle, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function BranchConfiguration({ isOpen, mode, branch, existingBranches = [], onClose, onSuccess }) {
  const defaultScheduleState = {
    monday: { isOpen: true, openingTime: '09:00', closingTime: '17:00' },
    tuesday: { isOpen: true, openingTime: '09:00', closingTime: '17:00' },
    wednesday: { isOpen: true, openingTime: '09:00', closingTime: '17:00' },
    thursday: { isOpen: true, openingTime: '09:00', closingTime: '17:00' },
    friday: { isOpen: true, openingTime: '09:00', closingTime: '17:00' },
    saturday: { isOpen: false, openingTime: '09:00', closingTime: '17:00' },
    sunday: { isOpen: false, openingTime: '09:00', closingTime: '17:00' },
  };

  const [branchName, setBranchName] = useState('');
  const [clinicAddress, setClinicAddress] = useState('');
  const [schedule, setSchedule] = useState(defaultScheduleState);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      if (mode === 'edit' && branch) {
        setBranchName(branch.name);
        setClinicAddress(branch.clinicAddress || '');
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
        setBranchName('');
        setClinicAddress('');
        setSchedule(defaultScheduleState);
      }
    }
  }, [isOpen, mode, branch]);

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

    if (!clinicAddress.trim()) {
      setErrorMsg('Clinic address is required.');
      return;
    }
    
    const isDuplicate = existingBranches.some(b => 
      b.name.toLowerCase() === branchName.trim().toLowerCase() && 
      (mode === 'add' || b.id !== branch?.id)
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
      clinicAddress: clinicAddress.trim(),
      schedule
    };

    try {
      if (mode === 'add') {
        await createBranch(branchData);
        toast.success("Branch has been successfully created.");
      } else if (mode === 'edit') {
        await updateBranch(branch.id, branchData);
        toast.success("Branch has been successfully updated.");
      }
      
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      setErrorMsg('An error occurred while saving the branch.');
    } finally {
      setIsSubmitting(false);
    }
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-white">
          <h2 className="text-xl font-bold text-gray-800">
            {mode === 'add' ? 'Add Branch' : 'Edit Branch'}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
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
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Clinic Address</label>
              <textarea
                value={clinicAddress}
                onChange={(e) => setClinicAddress(e.target.value)}
                placeholder="Enter the full clinic address..."
                rows="3"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-colors text-gray-800 resize-none"
              ></textarea>
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
            onClick={onClose}
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
  );
}
