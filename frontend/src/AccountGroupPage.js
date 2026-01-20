import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BookOpen, Scale, ArrowRight, Save, RotateCcw } from 'lucide-react';
import axios from 'axios';
import API_BASE_URL from './config/api';
import { usePermissions } from './hooks/usePermissions';



// Initial state for a new group
const initialGroupState = {
  groupName: '',
  groupType: '',
  normalBalance: '',
  parentGroupId: '',
};

const AccountGroupPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = !!id;
  const { canCreate, canEdit } = usePermissions();

  // Check permissions and redirect if unauthorized
  useEffect(() => {
    if (isEditMode && !canEdit('ACCOUNTS', 'GROUP_MASTER')) {
      navigate('/accounts/group-master');
    } else if (!isEditMode && !canCreate('ACCOUNTS', 'GROUP_MASTER')) {
      navigate('/accounts/group-master');
    }
  }, [isEditMode, canEdit, canCreate, navigate]);

  const [groupData, setGroupData] = useState(initialGroupState);
  const [status, setStatus] = useState({ message: '', type: '' });
  const [loading, setLoading] = useState(false);
  const [parentGroups, setParentGroups] = useState([]);

  // Load parent groups and existing group data
  useEffect(() => {
    fetchParentGroups();
    if (isEditMode && id) {
      fetchGroupData(id);
    }
  }, [isEditMode, id]);

  const fetchParentGroups = async () => {
    try {
      const token = localStorage.getItem('token');
      const endpoint = isEditMode && id 
        ? `${API_BASE_URL}/api/account-groups/parents/${id}`
        : `${API_BASE_URL}/api/account-groups/parents`;
      
      const res = await axios.get(endpoint, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setParentGroups(res.data);
    } catch (err) {
      console.error("Error fetching parent groups:", err);
      // Use empty array if API fails
      setParentGroups([]);
    }
  };

  const fetchGroupData = async (groupId) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/account-groups/${groupId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const group = res.data;
      
      // Map API data to form structure
      setGroupData({
        groupName: group.group_name || '',
        groupType: group.group_type || '',
        normalBalance: group.normal_balance || '',
        parentGroupId: group.parent_group_id || '',
      });
    } catch (err) {
      console.error("Error fetching group data:", err);
      showMessage("Failed to load group data", "error");
      navigate("/accounts/group-master");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { id, value, name, type } = e.target;
    if (type === 'radio') {
      setGroupData(prev => ({ ...prev, [name]: value }));
    } else {
      setGroupData(prev => ({ ...prev, [id]: value }));
    }
  };

  const clearForm = () => {
    setGroupData(initialGroupState);
    setStatus({ message: '', type: '' });
  };

  const showMessage = (message, type) => {
    setStatus({ message, type });
    setTimeout(() => setStatus({ message: '', type: '' }), 5000);
  };

  const saveGroup = async (e) => {
    e.preventDefault();
    
    // Destructure for required fields
    const { groupName, groupType, normalBalance, parentGroupId } = groupData;

    // Validation Check
    if (!groupName || !groupType || !normalBalance) {
      showMessage('Please fill in all required fields.', 'error');
      return;
    }

    try {
      setLoading(true);

      // Final data structure matching the PostgreSQL schema
      const groupPayload = {
        group_name: groupName.trim(),
        group_type: groupType,
        normal_balance: normalBalance,
        parent_group_id: parentGroupId ? parseInt(parentGroupId, 10) : null,
      };

      console.log("--- Account Group Payload (Ready for API) ---");
      console.log(groupPayload);

      const token = localStorage.getItem('token');
      if (isEditMode) {
        await axios.put(`${API_BASE_URL}/api/account-groups/edit/${id}`, groupPayload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        showMessage(`Group "${groupName}" updated successfully!`, 'success');
      } else {
        await axios.post(`${API_BASE_URL}/api/account-groups/add`, groupPayload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        showMessage(`Group "${groupName}" saved successfully! Ready for next entry.`, 'success');
        
        // Clear form for new entry in add mode
        setTimeout(() => {
          setGroupData(initialGroupState);
          // Refresh parent groups to include the newly added group
          fetchParentGroups();
        }, 1000);
      }

    } catch (error) {
      console.error('API Error:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to save group';
      showMessage('Failed to save group: ' + errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate("/accounts/group-master");
  };

  // Helper to determine message classes
  const getStatusClasses = () => {
    if (status.type === 'success') {
      return 'bg-green-100 text-green-700 border-green-300';
    }
    if (status.type === 'error') {
      return 'bg-red-100 text-red-700 border-red-300';
    }
    return '';
  };

  if (loading && isEditMode && !groupData.groupName) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading account group...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      {/* Breadcrumb */}
      <nav className="flex mb-6" aria-label="Breadcrumb">
        <ol className="inline-flex items-center space-x-1 md:space-x-3">
          <li className="inline-flex items-center">
            <button
              onClick={() => navigate("/accounts/group-master")}
              className="inline-flex items-center text-sm font-medium text-gray-700 hover:text-blue-600"
            >
              <BookOpen className="w-4 h-4 mr-2" />
              Account Groups
            </button>
          </li>
          <li>
            <div className="flex items-center">
              <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"></path>
              </svg>
              <span className="ml-1 text-sm font-medium text-gray-500 md:ml-2">
                {isEditMode ? "Edit Account Group" : "New Account Group"}
              </span>
            </div>
          </li>
        </ol>
      </nav>

      <div className="w-full max-w-2xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 flex items-center">
            <BookOpen className="w-7 h-7 mr-3 text-blue-600" />
            {isEditMode ? "Edit Account Group" : "Create Account Group"}
          </h1>
          <p className="text-gray-500 mt-1">
            {isEditMode ? "Update the account group information" : "Define a new node in the Chart of Accounts hierarchy."}
          </p>
        </header>

        {/* Status Message - Moved to top */}
        {status.message && (
          <div 
            className={`mb-6 p-4 rounded-lg border shadow-md flex items-center ${getStatusClasses()}`} 
            role="alert"
          >
            {status.type === 'success' && (
              <svg className="w-5 h-5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            {status.type === 'error' && (
              <svg className="w-5 h-5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <span className="font-medium">{status.message}</span>
          </div>
        )}

        {/* Entry Form Card */}
        <div className="bg-white p-6 md:p-8 rounded-xl shadow-2xl border border-gray-100">
          <form onSubmit={saveGroup}>
            <div className="space-y-6">
              {/* 1. Group Name */}
              <div>
                <label htmlFor="groupName" className="block text-sm font-medium text-gray-700 mb-1">
                  Group Name
                </label>
                <input
                  type="text"
                  id="groupName"
                  required
                  value={groupData.groupName}
                  onChange={handleChange}
                  placeholder="e.g., Current Assets, Revenue"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-150 shadow-sm"
                />
                <p className="text-xs text-gray-400 mt-1">
                  This forms the main node name in the hierarchy tree.
                </p>
              </div>

              {/* 2. Statement Category (group_type) */}
              <div className="pt-2">
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                  <Scale className="w-4 h-4 mr-2 text-gray-500" />
                  Statement Category (<span className="font-mono text-xs">group_type</span>)
                </label>
                <div className="flex space-x-6">
                  <label className="inline-flex items-center cursor-pointer p-2 rounded-md bg-green-50 hover:bg-green-100 transition">
                    <input
                      type="radio"
                      name="groupType"
                      value="BS"
                      required
                      checked={groupData.groupType === 'BS'}
                      onChange={handleChange}
                      className="form-radio h-5 w-5 text-green-600 border-gray-300 focus:ring-green-500"
                    />
                    <span className="ml-2 text-gray-700 font-medium">Balance Sheet (BS)</span>
                  </label>
                  <label className="inline-flex items-center cursor-pointer p-2 rounded-md bg-red-50 hover:bg-red-100 transition">
                    <input
                      type="radio"
                      name="groupType"
                      value="PL"
                      checked={groupData.groupType === 'PL'}
                      onChange={handleChange}
                      className="form-radio h-5 w-5 text-red-600 border-gray-300 focus:ring-red-500"
                    />
                    <span className="ml-2 text-gray-700 font-medium">Profit & Loss (PL)</span>
                  </label>
                </div>
              </div>

              {/* 3. Normal Balance (`normal_balance`) */}
              <div className="pt-2">
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                  <ArrowRight className="w-4 h-4 mr-2 text-gray-500" />
                  Natural Balance (<span className="font-mono text-xs">normal_balance</span>)
                </label>
                <div className="flex space-x-6">
                  <label className="inline-flex items-center cursor-pointer p-2 rounded-md bg-blue-50 hover:bg-blue-100 transition">
                    <input
                      type="radio"
                      name="normalBalance"
                      value="DEBIT"
                      required
                      checked={groupData.normalBalance === 'DEBIT'}
                      onChange={handleChange}
                      className="form-radio h-5 w-5 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-gray-700 font-medium">DEBIT</span>
                  </label>
                  <label className="inline-flex items-center cursor-pointer p-2 rounded-md bg-indigo-50 hover:bg-indigo-100 transition">
                    <input
                      type="radio"
                      name="normalBalance"
                      value="CREDIT"
                      checked={groupData.normalBalance === 'CREDIT'}
                      onChange={handleChange}
                      className="form-radio h-5 w-5 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-gray-700 font-medium">CREDIT</span>
                  </label>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  This determines how the group balance is calculated (e.g., Assets increase with Debit).
                </p>
              </div>

              {/* 4. Parent Group (Hierarchy / self-reference) */}
              <div className="pt-2">
                <label htmlFor="parentGroupId" className="block text-sm font-medium text-gray-700 mb-1">
                  Parent Group (Optional Hierarchy)
                </label>
                <select
                  id="parentGroupId"
                  value={groupData.parentGroupId}
                  onChange={handleChange}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-150 shadow-sm bg-white"
                >
                  <option value="">-- None (Top-Level Group) --</option>
                  {parentGroups.map(group => (
                    <option key={group.group_id} value={group.group_id}>
                      {group.group_name} ({group.group_type}, {group.normal_balance})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  Use this to create nested groups (e.g., 'Cash' under 'Current Assets').
                </p>
              </div>
            </div>

            {/* Submit Button */}
            <div className="mt-8 pt-6 border-t border-gray-200 flex justify-between">
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={clearForm}
                  className="flex items-center space-x-2 px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg shadow-sm hover:bg-gray-100 transition duration-200"
                  disabled={loading}
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Reset</span>
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="flex items-center space-x-2 px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg shadow-sm hover:bg-gray-100 transition duration-200"
                  disabled={loading}
                >
                  <span>Cancel</span>
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`flex items-center space-x-2 px-6 py-3 font-semibold rounded-lg shadow-lg transition duration-200 ${
                  loading 
                    ? 'bg-gray-400 text-white cursor-not-allowed' 
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                <Save className="w-4 h-4" />
                <span>{loading ? 'Saving...' : (isEditMode ? 'Update Account Group' : 'Save Account Group')}</span>
              </button>
            </div>
          </form>
        </div>


      </div>
    </div>
  );
};

export default AccountGroupPage;