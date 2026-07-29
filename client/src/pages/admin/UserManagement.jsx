import React, { useState, useEffect } from "react";
import { Plus, Search, Filter, MoreVertical, Shield, Stethoscope, UserCog, User, MapPin } from "lucide-react";
import { ref, onValue } from "firebase/database";
import { database } from "../../firebase/database";
import AddStaffModal from "../../components/admin/AddStaffModal";

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const usersRef = ref(database, 'users');
    const unsubscribe = onValue(usersRef, (snapshot) => {
      if (snapshot.exists()) {
        const usersData = snapshot.val();
        const usersList = Object.keys(usersData).map(key => ({
          id: key,
          ...usersData[key]
        }));
        setUsers(usersList);
      } else {
        setUsers([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

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
    return (user.name && user.name.toLowerCase().includes(term)) || 
           (user.email && user.email.toLowerCase().includes(term));
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">User Management</h1>
          <p className="text-gray-500 mt-1">Manage system accounts and roles</p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="px-5 py-2.5 bg-blue-600 text-white font-bold rounded-xl shadow-sm hover:bg-blue-700 hover:shadow transition-all flex items-center shrink-0"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Staff
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search users..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-colors text-gray-800"
          />
        </div>
        <button className="px-4 py-2.5 bg-gray-50 text-gray-600 font-semibold rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors flex items-center justify-center shrink-0">
          <Filter className="w-4 h-4 mr-2" />
          Filter Role
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden min-h-[300px]">
        {loading ? (
          <div className="flex justify-center items-center h-48">
             <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredUsers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 font-bold">
                  <th className="p-4 pl-6">Name & Email</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">Branch</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right pr-6">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="p-4 pl-6 min-w-[200px]">
                      <div className="font-bold text-gray-800">{user.name || 'Unnamed'}</div>
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
                        <span className="inline-flex items-center text-xs font-bold text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full">
                          <MapPin className="w-3.5 h-3.5 mr-1" />
                          {user.assignedBranch}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm italic">N/A</span>
                      )}
                    </td>
                    <td className="p-4 min-w-[100px]">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold capitalize ${
                        user.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {user.status || 'Unknown'}
                      </span>
                    </td>
                    <td className="p-4 text-right pr-6">
                      <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                        <MoreVertical className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-12 text-center text-gray-500">
             <User className="w-12 h-12 text-gray-300 mb-3" />
             <p className="font-semibold text-gray-600">No users found.</p>
          </div>
        )}
      </div>

      <AddStaffModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        onSuccess={() => setIsAddModalOpen(false)} 
      />
    </div>
  );
}
