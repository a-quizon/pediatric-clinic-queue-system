import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Shield, Stethoscope, UserCog, User, MapPin, Mail, Phone, Trash2, AlertCircle, Filter, ChevronDown } from "lucide-react";
import { ref } from "firebase/database";
import { getDb } from "../../firebase/database";
import { subscribeOnValue } from "../../firebase/rtdbSubscribe";
import UserDetailsModal from "../../components/admin/UserDetailsModal";
import ConfirmationModal from "../../components/common/ConfirmationModal";
import { deleteUserAccount } from "../../services/adminService";
import { useAuth } from "../../hooks/useAuth";
import { PqSpinner } from "../../components/parent/pqUi";
import EmptyState from "../../components/common/EmptyState";
import toast from "react-hot-toast";
import Pagination from "../../components/common/Pagination";
import { getUserRowActions } from "../../utils/adminUserManagementPolicy";
import {
  USER_ROLE_FILTER_OPTIONS,
  parseUserRoleParam,
  matchesUserRoleFilter,
  isListedUser,
} from "../../utils/userListFilters";

const roleChip = (role) => {
  if (role === "doctor") return "pq-chip pq-chip-info";
  if (role === "secretary") return "pq-chip pq-chip-wait";
  if (role === "admin") return "pq-chip pq-chip-info";
  return "pq-chip";
};

const statusChip = (status) => (
  status === "active" ? "pq-chip pq-chip-live" : "pq-chip pq-chip-alert"
);

const SelectChevron = () => (
  <div className="pq-field-icon" style={{ left: "auto", right: "0.85rem" }} aria-hidden="true">
    <ChevronDown className="w-4 h-4" />
  </div>
);

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [searchParams] = useSearchParams();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState(() => parseUserRoleParam(searchParams.get("role")) || "all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [selectedUser, setSelectedUser] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const USERS_PER_PAGE = 10;

  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [userToDelete, setUserToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const usersRef = ref(getDb(), "users");
    const unsubscribe = subscribeOnValue(usersRef, (snapshot) => {
      if (snapshot.exists()) {
        const usersData = snapshot.val();
        const usersList = Object.keys(usersData).map((key) => ({
          id: key,
          ...usersData[key]
        })).filter(isListedUser);

        setUsers(usersList);
      } else {
        setUsers([]);
      }
      setLoading(false);
      setIsInitialLoadComplete(true);
      setError(null);
    }, (err) => {
      console.error("Firebase Read Error:", err);
      setError("Failed to load users. You may not have permission, or there is a network issue.");
      setLoading(false);
      setIsInitialLoadComplete(true);
    });

    return () => unsubscribe();
  }, [reloadKey]);

  useEffect(() => {
    if (isDetailsModalOpen) {
      setSelectedUser((prevSelected) => {
        if (!prevSelected) return prevSelected;
        const updatedSelectedUser = users.find((u) => u.id === prevSelected.id);
        if (updatedSelectedUser && JSON.stringify(updatedSelectedUser) !== JSON.stringify(prevSelected)) {
          return updatedSelectedUser;
        }
        return prevSelected;
      });
    }
  }, [users, isDetailsModalOpen]);

  const getRoleIcon = (role) => {
    switch (role) {
      case "doctor": return <Stethoscope className="w-4 h-4" aria-hidden="true" />;
      case "secretary": return <UserCog className="w-4 h-4" aria-hidden="true" />;
      case "admin": return <Shield className="w-4 h-4" aria-hidden="true" />;
      default: return <User className="w-4 h-4" aria-hidden="true" />;
    }
  };

  const filteredUsers = users.filter((user) => {
    const term = searchQuery.toLowerCase();
    const matchesSearch = (user.name && user.name.toLowerCase().includes(term)) ||
                          (user.email && user.email.toLowerCase().includes(term));

    const matchesRole = matchesUserRoleFilter(user, roleFilter);
    const matchesStatus = statusFilter === "all" || user.status === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, roleFilter, statusFilter]);

  useEffect(() => {
    const role = parseUserRoleParam(searchParams.get("role"));
    if (role) setRoleFilter(role);
  }, [searchParams]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / USERS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const displayedUsers = filteredUsers.slice((safePage - 1) * USERS_PER_PAGE, safePage * USERS_PER_PAGE);

  const openUserDetails = (user) => {
    if (!isInitialLoadComplete) return;
    if (!user || !user.id) return;
    setSelectedUser(user);
    setIsDetailsModalOpen(true);
  };

  const requestDeleteUser = (e, user) => {
    e.stopPropagation();
    if (!user?.id) return;
    if (user.role === "admin") {
      toast.error("Admin accounts cannot be deleted.");
      return;
    }
    if (currentUser?.uid && user.id === currentUser.uid) {
      toast.error("You cannot delete your own account.");
      return;
    }
    setUserToDelete(user);
  };

  const canDeleteUser = (user) => getUserRowActions({ target: user, currentUid: currentUser?.uid }).canDelete;
  const isSelf = (user) => Boolean(currentUser?.uid && user?.id === currentUser.uid);

  const deleteMessage = userToDelete?.role === "doctor"
    ? `This will permanently delete the doctor account for ${userToDelete?.name || "this doctor"} (${userToDelete?.email || "no email"}) and revoke their login. This action is permanent and cannot be undone. Past sessions, reservations, and audit logs are kept. Until a doctor is added or reactivated, no one can complete consultations.`
    : `This will permanently remove ${userToDelete?.name || "this user"} (${userToDelete?.email || "no email"}) and revoke their login. Historical reservations will be kept. This cannot be undone.`;

  const confirmDeleteUser = async () => {
    if (!userToDelete?.id || isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteUserAccount(userToDelete.id);
      toast.success(`Deleted ${userToDelete.name || "user"} and revoked their login.`);
      setUserToDelete(null);
      if (selectedUser?.id === userToDelete.id) {
        setIsDetailsModalOpen(false);
        setSelectedUser(null);
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to delete user.");
    } finally {
      setIsDeleting(false);
    }
  };

  const activeFilterCount = [
    searchQuery ? 1 : 0,
    roleFilter !== "all" ? 1 : 0,
    statusFilter !== "all" ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4 pb-4 md:pb-8 md:h-[calc(100vh-140px)] md:flex md:flex-col min-w-0 max-w-full">
      <div className="pq-filter-bar p-3 sm:p-4 min-w-0 overflow-visible">
        <div className="md:hidden">
          <button
            type="button"
            className="pq-btn-secondary w-full min-h-[44px] justify-between"
            aria-expanded={filtersOpen}
            aria-controls="user-filters-panel"
            onClick={() => setFiltersOpen((open) => !open)}
          >
            <span className="inline-flex items-center gap-2">
              <Filter className="w-4 h-4" aria-hidden="true" />
              Filters
              {activeFilterCount > 0 && (
                <span className="pq-chip text-xs">{activeFilterCount}</span>
              )}
            </span>
            <ChevronDown
              className={`w-4 h-4 transition-transform ${filtersOpen ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>
        </div>

        <div
          id="user-filters-panel"
          className={`${filtersOpen ? "mt-3 flex" : "hidden"} md:mt-0 md:flex flex-col gap-3 min-w-0`}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,1fr))] gap-3 min-w-0 items-end">
            <div className="relative min-w-0 md:col-span-2 lg:col-span-1">
              <div className="pq-field-icon">
                <Search className="w-5 h-5" aria-hidden="true" />
              </div>
              <label htmlFor="user-search" className="sr-only">Search by name or email</label>
              <input
                id="user-search"
                type="text"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pq-input pl-10 min-h-[44px] w-full"
              />
            </div>

            <div className="relative min-w-0">
              <label htmlFor="user-role-filter" className="sr-only">Filter by role</label>
              <select
                id="user-role-filter"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="pq-input pr-10 appearance-none cursor-pointer w-full min-h-[44px]"
              >
                {USER_ROLE_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <SelectChevron />
            </div>

            <div className="relative min-w-0">
              <label htmlFor="user-status-filter" className="sr-only">Filter by status</label>
              <select
                id="user-status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="pq-input pr-10 appearance-none cursor-pointer w-full min-h-[44px]"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <SelectChevron />
            </div>
          </div>
        </div>
      </div>

      <div className="pq-glass overflow-hidden min-h-[300px] md:flex-1 md:flex md:flex-col md:min-h-0 min-w-0 max-w-full">
        {loading ? (
          <PqSpinner label="Loading users" />
        ) : error ? (
          <div className="flex flex-col justify-center items-center h-48 md:flex-1 text-center p-6">
            <div
              className="p-4 rounded-full mb-4"
              style={{ background: "var(--pq-alert-wash)", color: "var(--pq-alert)" }}
            >
              <AlertCircle className="w-8 h-8" aria-hidden="true" />
            </div>
            <h3 className="text-lg font-extrabold tracking-tight mb-2">Couldn't load users</h3>
            <p className="pq-muted mb-4">{error}</p>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                setError(null);
                setReloadKey((k) => k + 1);
              }}
              className="pq-btn-primary"
            >
              Try again
            </button>
          </div>
        ) : filteredUsers.length > 0 ? (
          <>
            <div className="block md:hidden overflow-y-auto pq-scroll-y">
              {displayedUsers.map((user) => (
                <div
                  key={user.id}
                  className="p-5"
                  style={{ borderTop: "1px solid var(--pq-glass-line)" }}
                >
                  <div className="flex justify-between items-start gap-2">
                  <button
                    type="button"
                    onClick={() => openUserDetails(user)}
                    aria-label={`View details for ${user.name || "user"}`}
                    className="min-w-0 text-left flex-1"
                  >
                      <h3 className="font-extrabold tracking-tight text-base">
                        {user.name || "Unnamed"}
                        {isSelf(user) && <span className="pq-chip ml-2 text-xs align-middle">You</span>}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className={`${roleChip(user.role)} capitalize`}>
                          {getRoleIcon(user.role)}
                          {user.role}
                        </span>
                        <span className={`${statusChip(user.status)} capitalize`}>
                          {user.status || "unknown"}
                        </span>
                      </div>
                      <div className="pq-row mt-3" style={{ display: "grid", gap: "0.5rem", minHeight: 0 }}>
                        <div className="flex items-center gap-2 leading-none pq-muted truncate">
                          <Mail className="w-4 h-4 shrink-0 pq-faint" aria-hidden="true" />
                          <span className="truncate">{user.email}</span>
                        </div>
                        <div className="flex items-center gap-2 leading-none pq-muted">
                          <Phone className="w-4 h-4 shrink-0 pq-faint" aria-hidden="true" />
                          <span>{user.phone || "No phone"}</span>
                        </div>
                      </div>
                    </button>
                    {user.role === "secretary" && user.assignedBranch && (
                      <span className="pq-chip shrink-0">
                        <MapPin className="w-3 h-3" aria-hidden="true" />
                        {user.assignedBranch}
                      </span>
                    )}
                  </div>

                  {canDeleteUser(user) && (
                    <button
                      type="button"
                      onClick={(e) => requestDeleteUser(e, user)}
                      className="pq-btn-ghost mt-3 ml-auto text-sm"
                      style={{ color: "var(--pq-alert)" }}
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                      Delete
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="hidden md:block overflow-x-auto md:flex-1 md:overflow-y-auto relative pq-scroll">
              <table className="pq-table">
                <thead className="pq-table-head-sticky">
                  <tr>
                    <th className="pl-6">Name & Email</th>
                    <th>Role</th>
                    <th>Branch</th>
                    <th>Status</th>
                    <th className="pr-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedUsers.map((user) => (
                    <tr
                      key={user.id}
                      onClick={() => openUserDetails(user)}
                      className="cursor-pointer"
                    >
                      <td className="pl-6 min-w-[200px]">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openUserDetails(user);
                          }}
                          aria-label={`View details for ${user.name || "user"}`}
                          className="text-left min-h-11"
                        >
                          <div className="font-extrabold tracking-tight">
                            {user.name || "Unnamed"}
                            {isSelf(user) && <span className="pq-chip ml-2 text-xs align-middle">You</span>}
                          </div>
                          <div className="text-sm pq-muted mt-0.5 font-medium">{user.email}</div>
                        </button>
                      </td>
                      <td className="min-w-[120px]">
                        <span className={`${roleChip(user.role)} capitalize`}>
                          {getRoleIcon(user.role)}
                          {user.role}
                        </span>
                      </td>
                      <td className="min-w-[120px]">
                        {user.role === "secretary" && user.assignedBranch ? (
                          <span className="pq-chip">
                            <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                            {user.assignedBranch}
                          </span>
                        ) : (
                          <span className="pq-faint text-sm italic font-medium">--</span>
                        )}
                      </td>
                      <td className="min-w-[100px]">
                        <span className={`${statusChip(user.status)} capitalize`}>
                          {user.status || "unknown"}
                        </span>
                      </td>
                      <td className="pr-6 text-right">
                        {canDeleteUser(user) && (
                          <button
                            type="button"
                            onClick={(e) => requestDeleteUser(e, user)}
                            className="pq-btn-ghost text-sm"
                            style={{ color: "var(--pq-alert)" }}
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              page={safePage}
              totalPages={totalPages}
              totalItems={filteredUsers.length}
              pageSize={USERS_PER_PAGE}
              onPageChange={setCurrentPage}
              itemLabel={filteredUsers.length === 1 ? "user" : "users"}
            />
          </>
        ) : (
          <EmptyState
            className="p-12 md:flex-1"
            title={users.length === 0 ? "No users yet" : "No users match these filters"}
            description={
              users.length === 0
                ? "Staff and parent accounts will appear in this list."
                : "Nothing matches your search, role, or status filters."
            }
            nextStep={
              users.length === 0
                ? "Use Add Staff to create a secretary or doctor account."
                : "Clear filters to see all listed accounts."
            }
            actionLabel={users.length === 0 ? undefined : "Clear filters"}
            onAction={
              users.length === 0
                ? undefined
                : () => {
                    setSearchQuery("");
                    setRoleFilter("all");
                    setStatusFilter("all");
                  }
            }
          />
        )}
      </div>

      <UserDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        user={selectedUser}
        allUsers={users}
        onUpdate={() => {}}
      />

      <ConfirmationModal
        isOpen={Boolean(userToDelete)}
        onClose={() => {
          if (!isDeleting) setUserToDelete(null);
        }}
        onConfirm={confirmDeleteUser}
        title={userToDelete?.role === "doctor" ? "Permanently delete doctor account" : "Delete user account"}
        message={deleteMessage}
        confirmText={userToDelete?.role === "doctor" ? "Delete permanently" : "Delete"}
        isDestructive
        isLoading={isDeleting}
      />
    </div>
  );
}
