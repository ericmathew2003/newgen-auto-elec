import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import API_BASE_URL from "./config/api";
import { usePermissions } from "./hooks/usePermissions";

export default function JournalListPage() {
  const navigate = useNavigate();
  const { canCreate, canEdit, canDelete, canView } = usePermissions();
  
  const [journals, setJournals] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage] = useState(50);
  const [totalRecords, setTotalRecords] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Toast notification state
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // Toast notification helper
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'success' });
    }, 3000);
  };

  // Fetch journal entries
  const fetchJournals = async (withSpinner = false) => {
    try {
      if (withSpinner) {
        setIsRefreshing(true);
      }
      
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        page: currentPage,
        limit: recordsPerPage,
        search: searchTerm
      });
      
      console.log("Fetching journals from:", `${API_BASE_URL}/api/accounting/journals/all?${params}`);
      const res = await axios.get(`${API_BASE_URL}/api/accounting/journals/all?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log("Journals response:", res.data);
      
      setJournals(res.data.journals || []);
      setTotalRecords(res.data.total || 0);
    } catch (err) {
      console.error("Error fetching journal entries:", err);
      console.error("Error details:", err.response?.data);
      const errorMsg = err.response?.data?.message || err.response?.data?.error || err.message || "Failed to load journal entries";
      showToast(`Error: ${errorMsg}`, "error");
    } finally {
      if (withSpinner) {
        setIsRefreshing(false);
      }
    }
  };

  useEffect(() => {
    fetchJournals();
  }, [currentPage, searchTerm]);

  // Handle delete
  const handleDelete = async (journalId, journalSerial) => {
    if (!window.confirm(`Are you sure you want to delete journal entry "${journalSerial}"?`)) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_BASE_URL}/api/accounting/journals/${journalId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showToast("Journal entry deleted successfully!", 'success');
      fetchJournals();
    } catch (err) {
      console.error(err);
      const errorMsg = err.response?.data?.message || err.response?.data?.error || "Error deleting journal entry";
      showToast(errorMsg, 'error');
    }
  };

  // Handle click to edit
  const handleDoubleClick = (journal) => {
    navigate(`/accounts/journal-voucher/edit/${journal.journal_mas_id}`);
  };

  // Handle new button click
  const handleNewClick = () => {
    navigate('/accounts/journal-voucher/new');
  };

  // Pagination
  const totalPages = Math.ceil(totalRecords / recordsPerPage);

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

  // Handle search
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1); // Reset to first page when searching
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
                <span className="ml-1 text-sm font-medium text-gray-500 md:ml-2">Transactions</span>
              </div>
            </li>
            <li>
              <div className="flex items-center">
                <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"></path>
                </svg>
                <span className="ml-1 text-sm font-medium text-gray-700 md:ml-2">Journal Voucher</span>
              </div>
            </li>
          </ol>
        </nav>
        
        {/* Header with New and Actions */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Journal Voucher</h1>
            <p className="text-sm text-gray-600 mt-1">Manage journal entries and manual transactions</p>
          </div>
          {canCreate('ACCOUNTS', 'JOURNAL_VOUCHER') && (
            <button
              className="px-4 py-2 text-sm rounded-lg text-white bg-red-600 hover:bg-red-700 shadow-sm flex items-center gap-2"
              onClick={handleNewClick}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Journal Entry
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
                  placeholder="Search journals..."
                  value={searchTerm}
                  onChange={handleSearchChange}
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

              <button
                type="button"
                onClick={() => fetchJournals(true)}
                disabled={isRefreshing}
                className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-md shadow-sm transition-colors ${
                  isRefreshing
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-white text-gray-700 hover:bg-gray-50 border-gray-300"
                }`}
                title="Refresh journal entries list"
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
                Page {currentPage} of {totalPages} ({totalRecords} total)
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
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Serial</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reference</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Narration</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Debit</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Credit</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {journals.map((journal) => (
                <tr
                  key={journal.journal_mas_id}
                  onClick={canEdit('ACCOUNTS', 'JOURNAL_VOUCHER') ? () => handleDoubleClick(journal) : undefined}
                  className={canEdit('ACCOUNTS', 'JOURNAL_VOUCHER') ? "cursor-pointer hover:bg-red-50 transition-colors" : ""}
                  title={canEdit('ACCOUNTS', 'JOURNAL_VOUCHER') ? "Click to edit journal entry" : "View only"}
                >
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(journal.journal_date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {journal.journal_serial}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                    <div className="flex flex-col">
                      <span className="font-medium">{journal.source_document_ref || '-'}</span>
                      <span className="text-xs text-gray-400">{journal.source_document_type}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    <div className="max-w-xs truncate" title={journal.narration}>
                      {journal.narration || '-'}
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-right font-medium text-red-600">
                    {parseFloat(journal.total_debit).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-right font-medium text-green-600">
                    {parseFloat(journal.total_credit).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {canDelete('ACCOUNTS', 'JOURNAL_VOUCHER') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(journal.journal_mas_id, journal.journal_serial);
                        }}
                        className="text-red-600 hover:text-red-900 transition-colors"
                        title="Delete journal entry"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {journals.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-6 py-4 text-center text-sm text-gray-500">
                    No Journal Entries Found
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