import React, { useState, useEffect } from "react";
import { getBranchConfigurations, checkBranchInUse, deleteBranch } from "../../services/branchConfigurationService";
import BranchConfiguration from "../../components/branch/BranchConfiguration";
import ConfirmationModal from "../../components/common/ConfirmationModal";
import MessageModal from "../../components/common/MessageModal";
import { MapPin, Edit2, Trash2, AlertCircle, Plus } from "lucide-react";
import { PqSpinner } from "../../components/parent/pqUi";
import toast from "react-hot-toast";

export default function BranchManagement() {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add");
  const [selectedBranch, setSelectedBranch] = useState(null);

  const [confirmModal, setConfirmModal] = useState({ isOpen: false, branchId: null, title: "", message: "" });
  const [messageModal, setMessageModal] = useState({ isOpen: false, type: "info", title: "", message: "" });
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchBranches = async () => {
    try {
      setError(null);
      const data = await getBranchConfigurations();
      setBranches(data);
    } catch (err) {
      console.error("Error fetching branches:", err);
      setError("Failed to load branches. You may not have permission, or there is a network issue.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();

    const handleOpenAddEvent = () => handleOpenAdd();
    window.addEventListener("openAddBranchModal", handleOpenAddEvent);
    return () => window.removeEventListener("openAddBranchModal", handleOpenAddEvent);
  }, []);

  const handleOpenAdd = () => {
    setModalMode("add");
    setSelectedBranch(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (branch) => {
    setModalMode("edit");
    setSelectedBranch(branch);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleSuccess = () => {
    fetchBranches();
  };

  const handleDeleteClick = async (branch) => {
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
      setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      toast.success("Branch deleted successfully.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete branch.");
      setConfirmModal((prev) => ({ ...prev, isOpen: false }));
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="pq-glass p-10">
        <PqSpinner label="Loading branches" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6 relative">
      {error ? (
        <div className="pq-glass p-10 text-center">
          <div
            className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4"
            style={{ background: "var(--pq-alert-wash)", color: "var(--pq-alert)" }}
          >
            <AlertCircle className="w-8 h-8" aria-hidden="true" />
          </div>
          <h3 className="text-lg font-extrabold tracking-tight mb-2">Couldn't load branches</h3>
          <p className="pq-muted text-sm max-w-sm mx-auto mb-4">{error}</p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              fetchBranches();
            }}
            className="pq-btn-primary"
          >
            Try again
          </button>
        </div>
      ) : branches.length === 0 ? (
        <div className="pq-glass p-12 text-center">
          <div
            className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4"
            style={{ background: "color-mix(in srgb, #ffffff 55%, transparent)", color: "var(--pq-ink-faint)" }}
          >
            <MapPin className="w-8 h-8" aria-hidden="true" />
          </div>
          <p className="font-extrabold tracking-tight mb-1">No branches found.</p>
          <p className="pq-muted text-sm mb-4">Add a branch to start clinic operations.</p>
          <button type="button" onClick={handleOpenAdd} className="pq-btn-primary">
            <Plus className="w-5 h-5" aria-hidden="true" />
            Add Branch
          </button>
        </div>
      ) : (
        <section className="pq-glass p-4 sm:p-5">
          <div className="space-y-3">
            {branches.map((branch) => (
              <article key={branch.id} className="pq-row items-start sm:items-center flex-col sm:flex-row">
                <div className="flex items-start gap-3 min-w-0 flex-1 w-full">
                  <div
                    className="w-10 h-10 rounded-[0.9rem] flex items-center justify-center shrink-0"
                    style={{ background: "color-mix(in srgb, var(--pq-mark-blue) 14%, white)", color: "var(--pq-mark-blue-deep)" }}
                  >
                    <MapPin className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-extrabold tracking-tight truncate">{branch.name}</h3>
                    {branch.clinicAddress ? (
                      <p className="text-sm pq-muted leading-relaxed whitespace-pre-line mt-1">
                        {branch.clinicAddress}
                      </p>
                    ) : (
                      <p className="text-sm pq-faint italic mt-1">No clinic address provided.</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(branch)}
                    className="pq-btn-secondary flex-1 sm:flex-none"
                  >
                    <Edit2 className="w-4 h-4" aria-hidden="true" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteClick(branch)}
                    className="pq-btn-ghost flex-1 sm:flex-none"
                    style={{ color: "var(--pq-alert)" }}
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

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
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        isLoading={isProcessing}
        isDestructive={true}
      />

      <MessageModal
        isOpen={messageModal.isOpen}
        type={messageModal.type}
        title={messageModal.title}
        message={messageModal.message}
        onClose={() => setMessageModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
