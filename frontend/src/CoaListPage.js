import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import API_BASE_URL from "./config/api";
import { usePermissions } from "./hooks/usePermissions";

export default function CoaListPage() {
  const navigate = useNavigate();
  const { canCreate, canEdit, canDelete } = usePermissions();
  
  const [accounts, setAccounts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage] = useState(50);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filterActive, setFilterActive] = useState("all"); // all, active, inactive

  // Toast notification state
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // Toast notification helper
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'success' });
    }, 3000);
  };

  // Fetch COA accounts
  const fetchAccounts = async (withSpinner = false) => {
    try {
      if (withSpinner) {
        setIsRefreshing(true);
      }
      const token = localStorage.getItem('token');
      console.log("Fetching accounts from:", `${API_BASE_URL}/api/coa/all`);
      const res = await axios.get(`${API_BASE_URL}/api/coa/all`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log("Accounts response:", res.data);
      setAccounts(res.data);
    } catch (err) {
      console.error("Error fetching COA accounts:", err);
      console.error("Error details:", err.response?.data);
      const errorMsg = err.response?.data?.message || err.response?.data?.error || err.message || "Failed to load accounts";
      showToast(`Error: ${errorMsg}`, "error");
    } finally {
      if (withSpinner) {
        setIsRefreshing(false);
      }
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  // Handle delete
  const handleDelete = async (accountId, accountCode, accountName) => {
    if (!window.confirm(`Are you sure you want to delete account "${accountCode} - ${accountName}"?`)) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_BASE_URL}/api/coa/${accountId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showToast("Account deleted successfully!", 'success');
      fetchAccounts();
    } catch (err) {
      console.error(err);
      const errorMsg = err.response?.data?.message || err.response?.data?.error || "Error deleting account";
      showToast(errorMsg, 'error');
    }
  };

  // Handle click to edit
  const handleDoubleClick = (account) => {
    if (canEdit('ACCOUNTS', 'COA_MASTER')) {
      navigate(`/accounts/coa-master/edit/${account.account_id}`);
    }
  };

  // Handle new button click
  const handleNewClick = () => {
    navigate('/accounts/coa-master/new');
  };

  // Search and filter logic
  const filteredAccounts = accounts.filter((account) => {
    const matchesSearch = 
      account.account_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.account_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.group_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.account_tag?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.account_nature?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.account_id.toString().includes(searchTerm);

    const matchesFilter = 
      filterActive === "all" ||
      (filterActive === "active" && account.is_active) ||
      (filterActive === "inactive" && !account.is_active);

    return matchesSearch && matchesFilter;
  });

  const totalRecords = filteredAccounts.length;
  const totalPages = Math.ceil(totalRecords / recordsPerPage);
  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = startIndex + recordsPerPage;
  const currentAccounts = filteredAccounts.slice(startIndex, endIndex);

  // Pagination functions
  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Toast Notification */}
      {toast.show && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg text-white font-medium transition-all duration-300 ${
          toast.type === 'success' ? 'bg-green-500' :
          toast.type === 'error' ? 'bg-red-500' :
          'bg-blue-500'
        }`}>
          <div className="flex items-center gap-2">
            {toast.type === 'success' && (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            {toast.type === 'error' && (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      <div className="p-6">
        {/* Breadcrumb */}
        <nav className="flex mb-4" aria-label="Breadcrumb">
          <ol className="inline-flex items-center space-x-1 md:space-x-3">
            <li className="inline-flex items-center">
              <span className="text-sm font-medium text-gray-500">Accounts</span>
            </li>
            <li>
              <div className="flex items-center">
                <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"></path>
                </svg>
                <span className="ml-1 text-sm font-medium text-gray-500 md:ml-2">Masters</span>
              </div>
            </li>
            <li>
              <div className="flex items-center">
                <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"></path>
                </svg>
                <span className="ml-1 text-sm font-medium text-gray-700 md:ml-2">Chart of Accounts</span>
              </div>
            </li>
          </ol>
        </nav>
        
        {/* Header with New and Actions */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Chart of Accounts Master</h1>
            <p className="text-sm text-gray-600 mt-1">Manage individual ledger accounts</p>
          </div>
          {canCreate('ACCOUNTS', 'COA_MASTER') && (
            <button
              className="px-4 py-2 text-sm rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm flex items-center gap-2"
              onClick={handleNewClick}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Account
            </button>
          )}
        </div>

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            {/* Search Filter */}
            <div className="flex items-center gap-3">
              <div className="flex items-center bg-white border border-gray-300 rounded-md shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center px-3 py-2 border-r border-gray-200">
                  <svg className="h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <span className="ml-2 text-sm text-gray-600 font-medium">Search</span>
                </div>
                <input
                  type="text"
                  placeholder="Search accounts..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 text-sm bg-transparent border-none outline-none placeholder-gray-400 min-w-[200px]"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('');
                      setCurrentPage(1);
                    }}
                    className="px-2 text-gray-400 hover:text-gray-600"
                    title="Clear search"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Active Filter */}
              <select
                value={filterActive}
                onChange={(e) => {
                  setFilterActive(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 text-sm border border-gray-300 rounded-md bg-white shadow-sm hover:shadow-md transition-shadow"
              >
                <option value="all">All Accounts</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>

              <button
                type="button"
                onClick={() => fetchAccounts(true)}
                disabled={isRefreshing}
                className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-md shadow-sm transition-colors ${
                  isRefreshing
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-white text-gray-700 hover:bg-gray-50 border-gray-300"
                }`}
                title="Refresh accounts list"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>

          {/* Pagination */}
          {totalRecords > 0 && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <button
                onClick={goToPreviousPage}
                disabled={currentPage === 1}
                className={`p-1 rounded ${
                  currentPage === 1
                    ? "text-gray-300 cursor-not-allowed"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
                </svg>
              </button>
              <span className="font-medium">
                {startIndex + 1}-{Math.min(endIndex, totalRecords)} / {totalRecords}
              </span>
              <button
                onClick={goToNextPage}
                disabled={currentPage === totalPages}
                className={`p-1 rounded ${
                  currentPage === totalPages
                    ? "text-gray-300 cursor-not-allowed"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Account Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Group</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Tag</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Nature</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Flags</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {currentAccounts.map((account) => (
                <tr
                  key={account.account_id}
                  onClick={canEdit('ACCOUNTS', 'COA_MASTER') ? () => handleDoubleClick(account) : undefined}
                  className={canEdit('ACCOUNTS', 'COA_MASTER') ? "cursor-pointer hover:bg-indigo-50 transition-colors" : ""}
                  title={canEdit('ACCOUNTS', 'COA_MASTER') ? "Click to edit account" : ""}
                >
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {account.account_code}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                    {account.account_name}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                    <div className="flex flex-col">
                      <span className="font-medium">{account.group_name}</span>
                      <span className="text-xs text-gray-400">({account.group_type})</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-center">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      account.normal_balance === 'DEBIT' 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-indigo-100 text-indigo-800'
                    }`}>
                      {account.normal_balance}
                    </span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-center text-sm text-gray-600">
                    {account.account_tag ? (
                      <span className="inline-flex px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded">
                        {account.account_tag}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-center text-sm text-gray-600">
                    {account.account_nature ? (
                      <span className="inline-flex px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded">
                        {account.account_nature}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-center">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      account.is_active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {account.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-center text-xs">
                    <div className="flex justify-center space-x-1">
                      {account.is_posting_allowed && (
                        <span className="inline-flex px-1 py-0.5 bg-blue-100 text-blue-700 rounded text-xs" title="Posting Allowed">P</span>
                      )}
                      {account.is_reconciliation_required && (
                        <span className="inline-flex px-1 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs" title="Reconciliation Required">R</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {canDelete('ACCOUNTS', 'COA_MASTER') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(account.account_id, account.account_code, account.account_name);
                        }}
                        className="text-red-600 hover:text-red-900 transition-colors"
                        title="Delete account"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {totalRecords === 0 && (
                <tr>
                  <td colSpan="8" className="px-6 py-4 text-center text-sm text-gray-500">
                    No Accounts Found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}