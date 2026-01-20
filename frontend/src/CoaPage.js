import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layers, ListChecks, Tag, Save, RotateCcw, ArrowLeft } from 'lucide-react';
import axios from 'axios';
import API_BASE_URL from './config/api';
import { usePermissions } from './hooks/usePermissions';

// Initial state for a new account
const initialCoaState = {
  accountCode: '',
  accountName: '',
  groupId: '',
  accountTag: '',
  accountNature: '',
  isPostingAllowed: true,
  isReconciliationRequired: false,
  isActive: true,
};

const CoaPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = Boolean(id);
  const { canCreate, canEdit } = usePermissions();

  // Check permissions
  const hasCreatePermission = canCreate('ACCOUNTS', 'COA_MASTER');
  const hasEditPermission = canEdit('ACCOUNTS', 'COA_MASTER');
  
  // Redirect if user doesn't have permission
  useEffect(() => {
    if (isEditMode && !hasEditPermission) {
      navigate('/accounts/coa-master');
    } else if (!isEditMode && !hasCreatePermission) {
      navigate('/accounts/coa-master');
    }
  }, [isEditMode, hasEditPermission, hasCreatePermission, navigate]);

  const [accountData, setAccountData] = useState(initialCoaState);
  const [groups, setGroups] = useState([]);
  const [accountNatures, setAccountNatures] = useState([]);
  const [status, setStatus] = useState({ message: '', type: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(isEditMode);

  // Fetch data on component mount
  useEffect(() => {
    fetchGroups();
    fetchAccountNatures();
    if (isEditMode) {
      fetchAccountData();
    }
  }, [id, isEditMode]);

  const fetchGroups = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/api/coa/groups/list`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setGroups(response.data);
    } catch (error) {
      console.error('Error fetching groups:', error);
      showMessage('Failed to load account groups', 'error');
    }
  };

  const fetchAccountNatures = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/api/coa/natures/list`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAccountNatures(response.data);
    } catch (error) {
      console.error('Error fetching account natures:', error);
      showMessage('Failed to load account natures', 'error');
    }
  };

  const fetchAccountData = async () => {
    try {
      setIsLoadingData(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/api/coa/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = response.data;

      setAccountData({
        accountCode: data.account_code,
        accountName: data.account_name,
        groupId: data.group_id.toString(),
        accountTag: data.account_tag || '',
        accountNature: data.account_nature || '',
        isPostingAllowed: data.is_posting_allowed,
        isReconciliationRequired: data.is_reconciliation_required,
        isActive: data.is_active,
      });
    } catch (error) {
      console.error('Error fetching account data:', error);
      showMessage('Error loading account data', 'error');
      navigate('/accounts/coa-master');
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleChange = (e) => {
    const { id, value, type, checked } = e.target;
    setAccountData(prev => ({
      ...prev,
      [id]: type === 'checkbox' ? checked : value
    }));
  };

  const clearForm = () => {
    setAccountData(initialCoaState);
    setStatus({ message: '', type: '' });
  };

  const showMessage = (message, type) => {
    setStatus({ message, type });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => setStatus({ message: '', type: '' }), 6000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const { accountCode, accountName, groupId, accountTag, accountNature, isPostingAllowed, isReconciliationRequired, isActive } = accountData;

    // Basic client-side validation
    if (!accountCode || !accountName || !groupId) {
      showMessage('Account Code, Name, and Group must be selected.', 'error');
      return;
    }

    // Construct the payload matching the database schema
    const payload = {
      account_code: accountCode.trim(),
      account_name: accountName.trim(),
      group_id: parseInt(groupId, 10),
      account_tag: accountTag ? accountTag.trim() : null,
      account_nature: accountNature ? accountNature.trim() : null,
      is_posting_allowed: isPostingAllowed,
      is_reconciliation_required: isReconciliationRequired,
      is_active: isActive,
    };

    setIsLoading(true);
    setStatus({ message: '', type: '' });

    try {
      const token = localStorage.getItem('token');
      if (isEditMode) {
        await axios.put(`${API_BASE_URL}/api/coa/${id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        showMessage(`Account ${accountCode} - "${accountName}" updated successfully!`, 'success');
        // Refresh data after update
        fetchAccountData();
        fetchGroups();
        fetchAccountNatures();
      } else {
        await axios.post(`${API_BASE_URL}/api/coa`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        showMessage(`Account ${accountCode} - "${accountName}" created successfully! Ready for next entry.`, 'success');

        // Clear form for new entry in add mode
        setTimeout(() => {
          setAccountData(initialCoaState);
          fetchGroups(); // Refresh groups in case new ones were added
          fetchAccountNatures(); // Refresh account natures
        }, 1000);
      }
    } catch (error) {
      console.error('API Error:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to save account';
      showMessage(`Error: ${errorMessage}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusClasses = () => {
    if (!status.message) return 'hidden';
    if (status.type === 'success') {
      return 'bg-green-100 text-green-700 border-green-300';
    }
    if (status.type === 'error') {
      return 'bg-red-100 text-red-700 border-red-300';
    }
    return '';
  };

  // Helper to find selected group details for display
  const selectedGroup = groups.find(g => g.group_id === parseInt(accountData.groupId, 10));

  if (isLoadingData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading account data...</p>
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
              onClick={() => navigate('/accounts/coa-master')}
              className="inline-flex items-center text-sm font-medium text-gray-700 hover:text-blue-600"
            >
              <ListChecks className="w-4 h-4 mr-2" />
              Chart of Accounts
            </button>
          </li>
          <li>
            <div className="flex items-center">
              <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"></path>
              </svg>
              <span className="ml-1 text-sm font-medium text-gray-500 md:ml-2">
                {isEditMode ? "Edit Account" : "New Account"}
              </span>
            </div>
          </li>
        </ol>
      </nav>

      <div className="w-full max-w-2xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 flex items-center">
            <ListChecks className="w-7 h-7 mr-3 text-indigo-600" />
            {isEditMode ? 'Edit' : 'Create'} Chart of Accounts (CoA) Master
          </h1>
          <p className="text-gray-500 mt-1">
            {isEditMode ? 'Update the account details below.' : 'Define an individual ledger account and link it to an accounting group.'}
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

        <div className="bg-white p-6 md:p-8 rounded-xl shadow-2xl border border-gray-100">
          <form onSubmit={handleSubmit}>
            <div className="space-y-6">
              {/* 1. Account Code */}
              <div>
                <label htmlFor="accountCode" className="block text-sm font-medium text-gray-700 mb-1">
                  Account Code
                </label>
                <input
                  type="text"
                  id="accountCode"
                  required
                  value={accountData.accountCode}
                  onChange={handleChange}
                  placeholder="e.g., 10100, 50300"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 shadow-sm"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Unique ledger code for sorting and searching.
                </p>
              </div>

              {/* 2. Account Name */}
              <div>
                <label htmlFor="accountName" className="block text-sm font-medium text-gray-700 mb-1">
                  Account Name
                </label>
                <input
                  type="text"
                  id="accountName"
                  required
                  value={accountData.accountName}
                  onChange={handleChange}
                  placeholder="e.g., Cash at Bank, Rent Expense"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 shadow-sm"
                />
              </div>

              {/* 3. Account Tag */}
              <div>
                <label htmlFor="accountTag" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                  <Tag className="w-4 h-4 mr-1 text-gray-500" />
                  Account Tag (Optional)
                </label>
                <input
                  type="text"
                  id="accountTag"
                  value={accountData.accountTag}
                  onChange={handleChange}
                  placeholder="e.g., CASH, BANK, AR"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 shadow-sm"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Tag for grouping similar accounts (e.g., CASH for all cash accounts).
                </p>
              </div>

              {/* 4. Account Nature */}
              <div>
                <label htmlFor="accountNature" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                  <Layers className="w-4 h-4 mr-1 text-gray-500" />
                  Account Nature (Optional)
                </label>
                <select
                  id="accountNature"
                  value={accountData.accountNature}
                  onChange={handleChange}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 shadow-sm bg-white"
                >
                  <option value="">-- Select Account Nature --</option>
                  {accountNatures.map(nature => (
                    <option key={nature.nature_id} value={nature.nature_code}>
                      {nature.display_name_formatted}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  Links this account to transaction mapping rules for automatic journal entries.
                </p>
              </div>

              {/* 5. Parent Group */}
              <div>
                <label htmlFor="groupId" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                  <Layers className="w-4 h-4 mr-1 text-gray-500" />
                  Parent Accounting Group (Mandatory)
                </label>
                <select
                  id="groupId"
                  required
                  value={accountData.groupId}
                  onChange={handleChange}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 shadow-sm bg-white"
                >
                  <option value="">-- Select Group --</option>
                  {groups.map(group => (
                    <option key={group.group_id} value={group.group_id}>
                      {group.display_name}
                    </option>
                  ))}
                </select>
                {selectedGroup && (
                  <div className="mt-2 text-xs p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                    <strong>Properties:</strong> Statement: <strong>{selectedGroup.group_type}</strong> | Natural Balance:
                    <span className={`font-semibold ml-1 ${selectedGroup.normal_balance === 'DEBIT' ? 'text-blue-600' : 'text-purple-600'
                      }`}>
                      {selectedGroup.normal_balance}
                    </span>
                  </div>
                )}
              </div>

              {/* 6. Control Flags */}
              <div className="pt-4 border-t border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-3">Control Flags</label>
                <div className="space-y-3">
                  {/* is_active */}
                  <label className="inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={accountData.isActive}
                      onChange={handleChange}
                      className="form-checkbox h-4 w-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                    />
                    <span className="ml-2 text-gray-700 text-sm font-medium">Is Active</span>
                    <span className="text-xs text-gray-400 ml-2">(Available for transactions)</span>
                  </label>

                  {/* is_posting_allowed */}
                  <label className="inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      id="isPostingAllowed"
                      checked={accountData.isPostingAllowed}
                      onChange={handleChange}
                      className="form-checkbox h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="ml-2 text-gray-700 text-sm font-medium">Posting Allowed</span>
                    <span className="text-xs text-gray-400 ml-2">(Can post journal entries directly)</span>
                  </label>

                  {/* is_reconciliation_required */}
                  <label className="inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      id="isReconciliationRequired"
                      checked={accountData.isReconciliationRequired}
                      onChange={handleChange}
                      className="form-checkbox h-4 w-4 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500"
                    />
                    <span className="ml-2 text-gray-700 text-sm font-medium">Reconciliation Required</span>
                    <span className="text-xs text-gray-400 ml-2">(For Bank, AR, AP accounts)</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="mt-8 pt-6 border-t border-gray-200 flex justify-between">
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={clearForm}
                  className="flex items-center space-x-2 px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg shadow-sm hover:bg-gray-100 transition duration-200"
                  disabled={isLoading}
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Reset</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/accounts/coa-master')}
                  className="flex items-center space-x-2 px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg shadow-sm hover:bg-gray-100 transition duration-200"
                  disabled={isLoading}
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to List</span>
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className={`flex items-center space-x-2 px-6 py-3 font-semibold rounded-lg shadow-lg transition duration-200 ${isLoading
                  ? 'bg-gray-400 text-white cursor-not-allowed'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
              >
                <Save className="w-4 h-4" />
                <span>{isLoading ? 'Saving...' : (isEditMode ? 'Update Account' : 'Save Account')}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CoaPage;