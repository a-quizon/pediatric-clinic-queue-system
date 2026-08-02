import React, { useState, useEffect } from 'react';
import { getBranchConfigurations, checkBranchInUse, deleteBranch } from '../../services/branchConfigurationService';
import BranchConfiguration from '../../components/branch/BranchConfiguration';
import ConfirmationModal from "../../components/common/ConfirmationModal";
import MessageModal from "../../components/common/MessageModal";
import { MapPin, Plus, Edit2, Trash2, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

export default function BranchManagement() {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [selectedBranch, setSelectedBranch] = useState(null);

  const [confirmModal, setConfirmModal] = useState({ isOpen: false, branchId: null, title: "", message: "" });
  const [messageModal, setMessageModal] = useState({ isOpen: false, type: "info", title: "", message: "" });
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchBranches = async () => {
    try {
      const data = await getBranchConfigurations();
      setBranches(data);
    } catch (error) {
      console.error("Error fetching branches:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();

    const handleOpenAddEvent = () => handleOpenAdd();
    window.addEventListener('openAddBranchModal', handleOpenAddEvent);
    return () => window.removeEventListener('openAddBranchModal', handleOpenAddEvent);
  }, []);

  const handleOpenAdd = () => {
    setModalMode('add');
    setSelectedBranch(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (branch) => {
    setModalMode('edit');
    setSelectedBranch(branch);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleSuccess = () => {
    fetchBranches();
  };

  const handleDeleteClick = async (branch, e) => {
    e.stopPropagation();
    try {
      const { hasPublishedSchedules, hasActiveReservations } = await checkBranchInUse(branch.name);
      
      if (hasPublishedSchedules || hasActiveReservations) {
        setMessageModal({
          isOpen: true,
          type: "error",
          title: "Cannot Delete Branch",
          message: "This branch cannot be deleted because it is currently being used by one or more schedules. Please remove or complete the associated schedules before deleting this branch."
        });
        return;
      }
      
      setConfirmModal({
        isOpen: true,
        branchId: branch.id,
        title: "Delete Branch",
        message: `Are you sure you want to delete the ${branch.name} branch? This action cannot be undone.`
      });
    } catch (err) {
      console.error(err);
      toast.error("Failed to check branch status.");
    }
  };

  const executeDelete = async () => {
    if (!confirmModal.branchId) return;
    setIsProcessing(true);
    try {
      await deleteBranch(confirmModal.branchId);
      await fetchBranches();
      setConfirmModal(prev => ({ ...prev, isOpen: false }));
      toast.success("Branch deleted successfully.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete branch.");
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
    { key: 'monday', label: 'Mon' },
    { key: 'tuesday', label: 'Tue' },
    { key: 'wednesday', label: 'Wed' },
    { key: 'thursday', label: 'Thu' },
    { key: 'friday', label: 'Fri' },
    { key: 'saturday', label: 'Sat' },
    { key: 'sunday', label: 'Sun' },
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {branches.map(branch => (
          <div 
            key={branch.id} 
            className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-100 transition-all p-5 flex flex-col cursor-pointer"
            onClick={() => handleOpenEdit(branch)}
          >
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold text-gray-800 flex items-center">
                <MapPin className="w-6 h-6 mr-2 text-blue-500 bg-blue-50 p-1 rounded-lg" />
                {branch.name}
              </h3>
            </div>
            
            <div className="flex items-center gap-2 pt-2 border-t border-gray-50 mt-auto">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenEdit(branch);
                }}
                className="flex-1 py-2 bg-blue-50 text-blue-600 text-sm font-semibold rounded-xl hover:bg-blue-100 transition-colors flex items-center justify-center"
              >
                <Edit2 className="w-4 h-4 mr-1.5" />
                Edit
              </button>
              <button 
                onClick={(e) => handleDeleteClick(branch, e)}
                className="flex-1 py-2 bg-red-50 text-red-600 text-sm font-semibold rounded-xl hover:bg-red-100 transition-colors flex items-center justify-center"
              >
                <Trash2 className="w-4 h-4 mr-1.5" />
                Delete
              </button>
            </div>
          </div>
        ))}

        {branches.length === 0 && (
          <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-dashed border-gray-300">
            <p className="text-gray-500 mb-2">No branches found.</p>
          </div>
        )}
      </div>

      <BranchConfiguration 
        isOpen={isModalOpen}
        mode={modalMode}
        branch={selectedBranch}
        existingBranches={branches}
        onClose={handleCloseModal}
        onSuccess={handleSuccess}
      />

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={executeDelete}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        isLoading={isProcessing}
        isDestructive={true}
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
