import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  FileText, 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Calendar,
  User,
  DollarSign,
  Filter,
  RefreshCw,
  Eye,
  AlertCircle
} from 'lucide-react';
import axios from 'axios';
import API_BASE_URL from './config/api';
import { usePermissions } from './hooks/usePermissions';

const DebitNoteListPage = () => {
  const { canCreate, canEdit, canDelete, canView } = usePermissions();
  const navigate = useNavigate();
  const [debitNotes, setDebitNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [isDeleting, setIsDeleting] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [debitNoteToDelete, setDebitNoteToDelete] = useState(null);

  const itemsPerPage = 20;

  useEffect(() => {
    fetchDebitNotes();
  }, [currentPage, searchTerm]);

  const fetchDebitNotes = async () => {
    try {
      setLoading(true);
      setError('');
      
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/api/accounting/journals/debit-notes/all`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          page: currentPage,
          limit: itemsPerPage,
          search: searchTerm
        }
      });

      const data = response.data;
      setDebitNotes(data.debitNotes || []);
      setTotalRecords(data.total || 0);
      setTotalPages(Math.ceil((data.total || 0) / itemsPerPage));
    } catch (err) {
      console.error('Error fetching debit notes:', err);
      setError(err.response?.data?.error || 'Failed to fetch debit notes');
      setDebitNotes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handleDelete = (debitNote) => {
    setDebitNoteToDelete(debitNote);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!debitNoteToDelete) return;

    try {
      setIsDeleting(debitNoteToDelete.journal_mas_id);
      const token = localStorage.getItem('token');
      
      await axios.delete(`${API_BASE_URL}/api/accounting/journals/debit-notes/${debitNoteToDelete.journal_mas_id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setDebitNotes(prev => prev.filter(dn => dn.journal_mas_id !== debitNoteToDelete.journal_mas_id));
      setTotalRecords(prev => prev - 1);
      
      // Adjust current page if necessary
      if (debitNotes.length === 1 && currentPage > 1) {
        setCurrentPage(prev => prev - 1);
      }
      
    } catch (err) {
      console.error('Error deleting debit note:', err);
      setError(err.response?.data?.error || 'Failed to delete debit note');
    } finally {
      setIsDeleting(null);
      setShowDeleteModal(false);
      setDebitNoteToDelete(null);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  if (loading && debitNotes.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading debit notes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div className="mb-4 sm:mb-0">
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <FileText className="w-8 h-8 mr-3 text-blue-600" />
              Debit Notes
            </h1>
            <p className="text-gray-600 mt-2">Manage debit notes for additional charges and adjustments</p>
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={fetchDebitNotes}
              className="flex items-center space-x-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition duration-200"
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            
            {canCreate('ACCOUNTS', 'DEBIT_NOTE') && (
              <Link
                to="/accounts/debit-note/new"
                className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-200 shadow-lg"
              >
                <Plus className="w-4 h-4" />
                <span>New Debit Note</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Debit Notes</p>
              <p className="text-2xl font-bold text-gray-900">{totalRecords}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Debit Amount</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(debitNotes.reduce((sum, dn) => sum + (parseFloat(dn.total_debit) || 0), 0))}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Calendar className="w-6 h-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">This Month</p>
              <p className="text-2xl font-bold text-gray-900">
                {debitNotes.filter(dn => {
                  const dnDate = new Date(dn.journal_date);
                  const now = new Date();
                  return dnDate.getMonth() === now.getMonth() && dnDate.getFullYear() === now.getFullYear();
                }).length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <User className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Unique Parties</p>
              <p className="text-2xl font-bold text-gray-900">
                {new Set(debitNotes.map(dn => dn.party_id).filter(Boolean)).size}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-300 text-red-700 rounded-lg flex items-center">
          <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
          <span>{error}</span>
          <button 
            onClick={() => setError('')} 
            className="ml-auto text-red-500 hover:text-red-700"
          >
            ×
          </button>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by serial, party, or reference..."
              value={searchTerm}
              onChange={handleSearch}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-600">
              Showing {debitNotes.length} of {totalRecords} debit notes
            </span>
          </div>
        </div>
      </div>

      {/* Debit Notes Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Serial & Date
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Party
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reference
                </th>
                <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {debitNotes.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-medium">No debit notes found</p>
                    <p className="text-sm">
                      {searchTerm 
                        ? 'Try adjusting your search criteria' 
                        : 'Click "New Debit Note" to create your first debit note'
                      }
                    </p>
                  </td>
                </tr>
              ) : (
                debitNotes.map((debitNote) => (
                  <tr key={debitNote.journal_mas_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {debitNote.journal_serial}
                        </div>
                        <div className="text-sm text-gray-500 flex items-center">
                          <Calendar className="w-3 h-3 mr-1" />
                          {formatDate(debitNote.journal_date)}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {debitNote.party_name || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {debitNote.source_document_ref || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="text-sm font-medium text-gray-900">
                        {formatCurrency(debitNote.total_debit)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                        Posted
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => navigate(`/accounts/debit-note/view/${debitNote.journal_mas_id}`)}
                          className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                          title="View Debit Note"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {canEdit('ACCOUNTS', 'DEBIT_NOTE') && (
                          <button
                            onClick={() => navigate(`/accounts/debit-note/edit/${debitNote.journal_mas_id}`)}
                            className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                            title="Edit Debit Note"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                        {canDelete('ACCOUNTS', 'DEBIT_NOTE') && (
                          <button
                            onClick={() => handleDelete(debitNote)}
                            disabled={isDeleting === debitNote.journal_mas_id}
                            className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
                            title="Delete Debit Note"
                          >
                            {isDeleting === debitNote.journal_mas_id ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing page {currentPage} of {totalPages}
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <div className="p-3 bg-red-100 rounded-full mr-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Delete Debit Note</h3>
                <p className="text-sm text-gray-600">This action cannot be undone</p>
              </div>
            </div>
            
            <p className="text-gray-700 mb-6">
              Are you sure you want to delete debit note <strong>{debitNoteToDelete?.journal_serial}</strong>?
            </p>
            
            <div className="flex space-x-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center"
              >
                {isDeleting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DebitNoteListPage;