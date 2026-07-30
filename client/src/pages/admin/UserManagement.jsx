import React, { useState, useEffect } from "react";
import { Plus, Search, Filter, MoreVertical, Shield, Stethoscope, UserCog, User, MapPin, Mail, Phone } from "lucide-react";
import { ref, onValue } from "firebase/database";
import { database } from "../../firebase/database";
import UserDetailsModal from "../../components/admin/UserDetailsModal";

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [selectedUser, setSelectedUser] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  // Force trigger to re-read from local state if needed, but onValue handles real-time updates natively
  const [refreshTrigger, setRefreshTrigger] = useState(0); 

  useEffect(() => {
    const usersRef = ref(database, 'users');
    const unsubscribe = onValue(usersRef, (snapshot) => {
      if (snapshot.exists()) {
        const usersData = snapshot.val();
        const usersList = Object.keys(usersData).map(key => ({
          id: key,
          ...usersData[key]
        }));
        
        // If details modal is open, sync the selected user with the fresh data
        setUsers(prevUsers => {
          if (isDetailsModalOpen && selectedUser) {
            const updatedSelectedUser = usersList.find(u => u.id === selectedUser.id);
            if (updatedSelectedUser) {
              setSelectedUser(updatedSelectedUser);
            }
          }
          return usersList;
        });
      } else {
        setUsers([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isDetailsModalOpen, selectedUser?.id, refreshTrigger]);

  const getRoleIcon = (role) => {
    switch(role) {
      case 'doctor': return <Stethoscope className="w-4 h-4 mr-1.5" />;
      case 'secretary': return <UserCog className="w-4 h-4 mr-1.5" />;
      case 'admin': return <Shield className="w-4 h-4 mr-1.5" />;
      default: return <User className="w-4 h-4 mr-1.5" />;
    }
  };

  const getRoleColor = (role) => {
    switch(role) {
      case 'doctor': return "bg-purple-50 text-purple-700 border-purple-200";
      case 'secretary': return "bg-amber-50 text-amber-700 border-amber-200";
      case 'admin': return "bg-blue-50 text-blue-700 border-blue-200";
      default: return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  const filteredUsers = users.filter(user => {
    const term = searchQuery.toLowerCase();
    const matchesSearch = (user.name && user.name.toLowerCase().includes(term)) || 
                          (user.email && user.email.toLowerCase().includes(term));
    
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    const matchesStatus = statusFilter === "all" || user.status === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  const openUserDetails = (user) => {
    setSelectedUser(user);
    setIsDetailsModalOpen(true);
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Sticky Search & Filters Toolbar */}
      <div className="sticky top-[64px] z-20 bg-gray-50/95 backdrop-blur-md pb-4 pt-2 -mx-4 px-4 md:-mx-8 md:px-8 lg:-mx-10 lg:px-10 -mt-2 sm:-mt-4">
        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search by name or email..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-colors text-gray-800"
            />
          </div>
          
          <div className="flex gap-3">
            <div className="relative flex-1 md:flex-none">
              <select 
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full appearance-none pl-10 pr-8 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-colors text-gray-700 font-medium cursor-pointer"
              >
                <option value="all">All Roles</option>
                <option value="doctor">Doctor</option>
                <option value="secretary">Secretary</option>
                <option value="parent">Parent</option>
                <option value="admin">Admin</option>
              </select>
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>

            <div className="relative flex-1 md:flex-none">
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full appearance-none px-4 pr-8 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-colors text-gray-700 font-medium cursor-pointer"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden min-h-[300px]">
        {loading ? (
          <div className="flex justify-center items-center h-48">
             <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredUsers.length > 0 ? (
          <>
            {/* Mobile Card Layout */}
            <div className="block md:hidden divide-y divide-gray-100">
              {filteredUsers.map((user) => (
                <div 
                  key={user.id}
                  onClick={() => openUserDetails(user)}
                  className="p-5 hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer group flex flex-col gap-3"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h3 className="font-bold text-gray-800 text-base group-hover:text-blue-600 transition-colors">{user.name || 'Unnamed'}</h3>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase tracking-wide ${getRoleColor(user.role)}`}>
                          {getRoleIcon(user.role)}
                          {user.role}
                        </span>
                        <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide border ${
                          user.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
                        }`}>
                          {user.status || 'unknown'}
                        </span>
                      </div>
                    </div>
                    {user.role === 'secretary' && user.assignedBranch && (
                      <span className="inline-flex items-center text-[10px] font-bold text-gray-600 bg-gray-100 px-2 py-1 rounded-lg border border-gray-200 whitespace-nowrap">
                        <MapPin className="w-3 h-3 mr-1 text-gray-400" />
                        {user.assignedBranch}
                      </span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 gap-2 text-sm mt-1 bg-gray-50/50 p-3 rounded-xl border border-gray-100">
                    <div className="flex items-center gap-2 text-gray-600 truncate">
                      <Mail className="w-4 h-4 shrink-0 text-gray-400" />
                      <span className="truncate">{user.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Phone className="w-4 h-4 shrink-0 text-gray-400" />
                      <span>{user.phone || 'No phone'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table Layout */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 font-bold">
                    <th className="p-4 pl-6">Name & Email</th>
                    <th className="p-4">Role</th>
                    <th className="p-4">Branch</th>
                    <th className="p-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredUsers.map((user) => (
                    <tr 
                      key={user.id} 
                      onClick={() => openUserDetails(user)}
                      className="hover:bg-gray-50/80 transition-colors cursor-pointer group"
                    >
                      <td className="p-4 pl-6 min-w-[200px]">
                        <div className="font-bold text-gray-800 group-hover:text-blue-600 transition-colors">{user.name || 'Unnamed'}</div>
                        <div className="text-sm text-gray-500 mt-0.5">{user.email}</div>
                      </td>
                      <td className="p-4 min-w-[120px]">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${getRoleColor(user.role)} capitalize`}>
                          {getRoleIcon(user.role)}
                          {user.role}
                        </span>
                      </td>
                      <td className="p-4 min-w-[120px]">
                        {user.role === 'secretary' && user.assignedBranch ? (
                          <span className="inline-flex items-center text-xs font-bold text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full border border-gray-200">
                            <MapPin className="w-3.5 h-3.5 mr-1 text-gray-400" />
                            {user.assignedBranch}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-sm italic">--</span>
                        )}
                      </td>
                      <td className="p-4 min-w-[100px]">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold capitalize ${
                          user.status === 'active' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                          {user.status || 'unknown'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center p-12 text-center text-gray-500">
             <User className="w-12 h-12 text-gray-300 mb-3" />
             <p className="font-semibold text-gray-600">No users found matching your filters.</p>
             <button 
               onClick={() => { setSearchQuery(""); setRoleFilter("all"); setStatusFilter("all"); }}
               className="mt-4 text-sm text-blue-600 font-medium hover:underline"
             >
               Clear Filters
             </button>
          </div>
        )}
      </div>

      <UserDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        user={selectedUser}
        onUpdate={() => setRefreshTrigger(prev => prev + 1)}
      />
    </div>
  );
}
