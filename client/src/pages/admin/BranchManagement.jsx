import React, { useState, useEffect } from 'react';
import { getBranchConfigurations } from '../../services/branchConfigurationService';
import BranchConfiguration from '../../components/branch/BranchConfiguration';
import { MapPin, X, Plus } from 'lucide-react';

export default function BranchManagement() {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

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
  }, []);

  // When modal is closed, refresh branches in case changes were made
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setLoading(true);
    fetchBranches();
  };

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
          <p className="text-gray-500 mt-1">Manage clinic branches and their operating hours</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="px-5 py-2.5 bg-blue-600 text-white font-bold rounded-xl shadow-sm hover:bg-blue-700 hover:shadow transition-all flex items-center"
        >
          <Plus className="w-5 h-5 mr-2" />
          Manage Branches
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {branches.map(branch => (
          <div 
            key={branch.id} 
            className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-100 transition-all p-5 flex flex-col cursor-pointer"
            onClick={() => setIsModalOpen(true)}
          >
            <div className="flex items-center mb-4">
              <MapPin className="w-6 h-6 mr-3 text-blue-500 bg-blue-50 p-1 rounded-lg shrink-0" />
              <h3 className="text-xl font-bold text-gray-800 line-clamp-1">
                {branch.name} Branch
              </h3>
            </div>
            
            <div className="flex-1 space-y-3 mb-4">
              <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Clinic Configuration</h4>
            </div>

            <div className="pt-4 border-t border-gray-50 mt-auto text-center">
              <span className="text-blue-600 text-sm font-semibold group-hover:text-blue-700">
                Tap to Manage
              </span>
            </div>
          </div>
        ))}

        {branches.length === 0 && (
          <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-dashed border-gray-300">
            <p className="text-gray-500 mb-2">No branches found.</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4 sm:p-6 overflow-y-auto">
          <div className="bg-white w-full max-w-5xl rounded-3xl shadow-xl flex flex-col relative my-auto">
            <button 
              onClick={handleCloseModal} 
              className="absolute top-4 right-4 z-10 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors bg-white/80 backdrop-blur-sm"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="p-6 sm:p-8 max-h-[85vh] overflow-y-auto w-full">
              {/* Render the exact component without modifying it */}
              <BranchConfiguration />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
