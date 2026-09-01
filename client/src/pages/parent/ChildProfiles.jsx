import React, { useEffect, useState } from "react";
import { Baby, Pencil, Plus, Trash2, User } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import ChildProfileForm, {
  emptyChildProfile,
  isChildProfileValid
} from "../../components/parent/ChildProfileForm";
import ConfirmationModal from "../../components/common/ConfirmationModal";
import MessageModal from "../../components/common/MessageModal";
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
    <div className="space-y-6 pb-8 max-w-2xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-gray-800">Child Profiles</h2>
          <p className="text-sm text-gray-500 mt-1">
            Save your children here so you can select them when reserving a clinic slot.
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add a Child
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : children.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-10 text-center">
          <div className="mx-auto w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-5">
            <Baby className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-gray-800 mb-2">No children added yet</h3>
          <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
            Add a child profile with their name, age, and sex to use it on your next reservation.
          </p>
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add a Child
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {children.map((child) => (
            <div
              key={child.id}
              className="bg-white rounded-3xl p-5 border border-gray-100 shadow-xs flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <User className="w-6 h-6 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-extrabold text-gray-800 truncate">{child.childName}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {child.age ? `${child.age} years` : "Age N/A"} • {child.sex || "N/A"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => openEdit(child)}
                  className="w-10 h-10 rounded-full bg-gray-50 hover:bg-blue-50 text-gray-500 hover:text-blue-600 flex items-center justify-center transition-colors"
                  aria-label={`Edit ${child.childName}`}
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(child)}
                  className="w-10 h-10 rounded-full bg-gray-50 hover:bg-red-50 text-gray-500 hover:text-red-600 flex items-center justify-center transition-colors"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">
                {editingChild ? "Edit Child" : "Add a Child"}
              </h2>
            </div>
            <div className="p-6 overflow-y-auto">
              <ChildProfileForm value={formValue} onChange={setFormValue} idPrefix="profile-child" />
            </div>
            <div className="p-5 border-t border-gray-100 bg-gray-50 flex gap-3 justify-end">
              <button
                type="button"
                onClick={closeForm}
                disabled={isSaving}
                className="px-5 py-2.5 text-gray-600 font-bold bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || !isChildProfileValid(formValue)}
                className="px-5 py-2.5 text-white font-bold bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed text-sm shadow-sm"
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
