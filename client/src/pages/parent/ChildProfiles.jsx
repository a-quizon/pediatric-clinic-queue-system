import React, { useEffect, useState } from "react";
import { Baby, Pencil, Plus, Trash2, User } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import ChildProfileForm, {
  emptyChildProfile,
  isChildProfileValid
} from "../../components/parent/ChildProfileForm";
import ConfirmationModal from "../../components/common/ConfirmationModal";
import MessageModal from "../../components/common/MessageModal";
import { useHistoryOverlay } from "../../hooks/useHistoryOverlay";
import {
  addChild,
  removeChild,
  subscribeToChildren,
  updateChild
} from "../../services/childProfileService";

export default function ChildProfiles() {
  const { user } = useAuth();
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingChild, setEditingChild] = useState(null);
  const [formValue, setFormValue] = useState(emptyChildProfile());
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [messageModal, setMessageModal] = useState({
    isOpen: false,
    type: "error",
    title: "",
    message: ""
  });
  useHistoryOverlay(isFormOpen, () => {
    setIsFormOpen(false);
    setEditingChild(null);
    setFormValue(emptyChildProfile());
  });

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeToChildren(user.uid, (list) => {
      setChildren(list);
      setLoading(false);
    });
    return () => unsub();
  }, [user?.uid]);

  const openAdd = () => {
    setEditingChild(null);
    setFormValue(emptyChildProfile());
    setIsFormOpen(true);
  };

  const openEdit = (child) => {
    setEditingChild(child);
    setFormValue({
      childName: child.childName || "",
      age: child.age || "",
      sex: child.sex || ""
    });
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingChild(null);
    setFormValue(emptyChildProfile());
  };

  const handleSave = async () => {
    if (!user?.uid || !isChildProfileValid(formValue)) return;
    setIsSaving(true);
    try {
      if (editingChild) {
        await updateChild(user.uid, editingChild.id, formValue);
      } else {
        await addChild(user.uid, formValue);
      }
      closeForm();
    } catch (err) {
      console.error(err);
      setMessageModal({
        isOpen: true,
        type: "error",
        title: "Save Failed",
        message: "Could not save this child profile. Please try again."
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user?.uid || !deleteTarget) return;
    setIsDeleting(true);
    try {
      await removeChild(user.uid, deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      console.error(err);
      setMessageModal({
        isOpen: true,
        type: "error",
        title: "Delete Failed",
        message: "Could not remove this child profile. Please try again."
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-5 pb-8 max-w-2xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold">Child Profiles</h2>
          <p className="text-sm pq-muted mt-1">
            Save your children here so you can select them when reserving a clinic slot.
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="pq-btn-primary flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add a Child
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-16">
          <span className="pq-spinner" />
        </div>
      ) : children.length === 0 ? (
        <div className="pq-glass p-10 text-center">
          <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-5" style={{ background: "color-mix(in srgb, var(--pq-mark-blue) 12%, white)", color: "var(--pq-mark-blue-deep)" }}>
            <Baby className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold mb-2">No children added yet</h3>
          <p className="text-sm pq-muted mb-6 max-w-sm mx-auto">
            Add a child profile with their name, age, and sex to use it on your next reservation.
          </p>
          <button
            type="button"
            onClick={openAdd}
            className="pq-btn-primary inline-flex"
          >
            <Plus className="w-4 h-4" />
            Add a Child
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {children.map((child) => (
            <div
              key={child.id}
              className="pq-glass p-5 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "color-mix(in srgb, var(--pq-mark-blue) 12%, white)", color: "var(--pq-mark-blue-deep)" }}>
                  <User className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-extrabold truncate">{child.childName}</h3>
                  <p className="text-sm pq-muted mt-0.5">
                    {child.age ? `${child.age} years` : "Age N/A"} • {child.sex || "N/A"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => openEdit(child)}
                  className="pq-icon-btn"
                  aria-label={`Edit ${child.childName}`}
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(child)}
                  className="pq-icon-btn"
                  style={{ color: "var(--pq-alert)" }}
                  aria-label={`Remove ${child.childName}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isFormOpen && (
        <div className="pq-modal-scrim">
          <div className="pq-modal w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-5" style={{ borderBottom: "1px solid var(--pq-glass-line)" }}>
              <h2 className="text-lg font-bold">
                {editingChild ? "Edit Child" : "Add a Child"}
              </h2>
            </div>
            <div className="p-6 overflow-y-auto pq-scroll-y">
              <ChildProfileForm value={formValue} onChange={setFormValue} idPrefix="profile-child" />
            </div>
            <div className="p-5 flex gap-3 justify-end" style={{ borderTop: "1px solid var(--pq-glass-line)" }}>
              <button
                type="button"
                onClick={closeForm}
                disabled={isSaving}
                className="pq-btn-secondary text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || !isChildProfileValid(formValue)}
                className="pq-btn-primary text-sm"
              >
                {isSaving ? "Saving..." : editingChild ? "Save Changes" : "Save Child"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => !isDeleting && setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Remove Child Profile"
        message={`Remove ${deleteTarget?.childName || "this child"} from your saved profiles? Existing reservations will not be changed.`}
        confirmText="Remove"
        isDestructive
        isLoading={isDeleting}
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
