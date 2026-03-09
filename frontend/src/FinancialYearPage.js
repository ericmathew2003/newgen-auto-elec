import { useState, useEffect } from 'react';
import axios from 'axios';
import API_BASE_URL from './config/api';

const FinancialYearPage = () => {
  const [financialYears, setFinancialYears] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedYear, setSelectedYear] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ message: '', type: '' });
  const [confirmDialog, setConfirmDialog] = useState({ show: false, title: '', message: '', onConfirm: null });

  // Form state
  const [formData, setFormData] = useState({
    yearName: '',
    fromDate: '',
    toDate: ''
  });
  const [formErrors, setFormErrors] = useState({});

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    // Longer timeout for error messages with more content
    const timeout = type === 'error' && message.length > 100 ? 8000 : 5000;
    setTimeout(() => setToast({ message: '', type: '' }), timeout);
  };

  const showConfirm = (title, message, onConfirm) => {
    setConfirmDialog({ show: true, title, message, onConfirm });
  };

  const hideConfirm = () => {
    setConfirmDialog({ show: false, title: '', message: '', onConfirm: null });
  };

  const handleConfirm = () => {
    if (confirmDialog.onConfirm) {
      confirmDialog.onConfirm();
    }
    hideConfirm();
  };

  useEffect(() => {
    fetchFinancialYears();
  }, []);

  const fetchFinancialYears = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/api/financial-years`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFinancialYears(response.data);
    } catch (error) {
      console.error('Error fetching financial years:', error);
      showToast('Failed to load financial years', 'error');
    }
  };

  const fetchPeriods = async (yearId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/api/financial-years/${yearId}/periods`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPeriods(response.data);
      setSelectedYear(yearId);
    } catch (error) {
      console.error('Error fetching periods:', error);
      showToast('Failed to load periods', 'error');
    }
  };

  const validateForm = async () => {
    const errors = {};

    if (!formData.yearName.trim()) {
      errors.yearName = 'Financial year name is required';
    }

    if (!formData.fromDate) {
      errors.fromDate = 'From date is required';
    }

    if (!formData.toDate) {
      errors.toDate = 'To date is required';
    }

    if (formData.fromDate && formData.toDate) {
      const from = new Date(formData.fromDate);
      const to = new Date(formData.toDate);

      if (to <= from) {
        errors.toDate = 'To date must be after from date';
      }

      // Check if approximately 1 year
      const daysDiff = (to - from) / (1000 * 60 * 60 * 24);
      if (daysDiff < 360 || daysDiff > 370) {
        errors.toDate = 'Financial year should be approximately 12 months (365 days)';
      }

      // Check for overlaps
      try {
        const token = localStorage.getItem('token');
        const response = await axios.post(`${API_BASE_URL}/api/financial-years/validate`, {
          fromDate: formData.fromDate,
          toDate: formData.toDate
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!response.data.valid) {
          errors.fromDate = response.data.message;
        }
      } catch (error) {
        console.error('Error validating dates:', error);
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const isValid = await validateForm();
    if (!isValid) return;

    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE_URL}/api/financial-years`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      showToast('Financial year created successfully with 12 monthly periods!', 'success');
      setShowForm(false);
      setFormData({ yearName: '', fromDate: '', toDate: '' });
      fetchFinancialYears();
    } catch (error) {
      console.error('Error creating financial year:', error);
      showToast(error.response?.data?.error || 'Failed to create financial year', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePeriodStatusChange = (periodId, newStatus) => {
    showConfirm(
      `${newStatus} Period`,
      `Are you sure you want to ${newStatus.toLowerCase()} this period?`,
      async () => {
        try {
          const token = localStorage.getItem('token');
          await axios.patch(`${API_BASE_URL}/api/financial-periods/${periodId}/status`, {
            status: newStatus,
            userId: 1 // TODO: Get from auth context
          }, {
            headers: { Authorization: `Bearer ${token}` }
          });

          showToast(`Period ${newStatus.toLowerCase()} successfully`, 'success');
          fetchPeriods(selectedYear);
        } catch (error) {
          console.error('Error updating period status:', error);
          
          // Handle unposted transactions error
          if (error.response?.status === 400 && error.response?.data?.unpostedTransactions) {
            const unpostedList = error.response.data.unpostedTransactions;
            const message = `Cannot close period! The following transactions are confirmed but not yet posted:\n\n${unpostedList.join('\n')}\n\nPlease post all transactions before closing the period.`;
            showToast(message, 'error');
          } else {
            showToast(error.response?.data?.error || 'Failed to update period status', 'error');
          }
        }
      }
    );
  };

  const handleDelete = (yearId) => {
    showConfirm(
      'Delete Financial Year',
      'Are you sure you want to delete this financial year? This will also delete all associated periods.',
      async () => {
        try {
          const token = localStorage.getItem('token');
          await axios.delete(`${API_BASE_URL}/api/financial-years/${yearId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          showToast('Financial year deleted successfully', 'success');
          fetchFinancialYears();
          if (selectedYear === yearId) {
            setSelectedYear(null);
            setPeriods([]);
          }
        } catch (error) {
          console.error('Error deleting financial year:', error);
          showToast('Failed to delete financial year', 'error');
        }
      }
    );
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Open': return 'bg-green-100 text-green-800';
      case 'Closed': return 'bg-red-100 text-red-800';
      case 'Future': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="container mx-auto p-6">
      {/* Toast Notification */}
      {toast.message && (
        <div className={`fixed top-4 right-4 z-50 max-w-md p-4 rounded-lg shadow-lg flex items-start gap-3 animate-slide-in ${toast.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' :
          toast.type === 'error' ? 'bg-red-50 border border-red-200 text-red-800' :
            'bg-blue-50 border border-blue-200 text-blue-800'
          }`}>
          {toast.type === 'success' && (
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          )}
          {toast.type === 'error' && (
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          )}
          <div className="flex-1">
            <span className="font-medium whitespace-pre-line">{toast.message}</span>
          </div>
          <button
            onClick={() => setToast({ message: '', type: '' })}
            className="ml-auto text-gray-400 hover:text-gray-600 flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmDialog.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
              <h3 className="text-xl font-semibold text-white">{confirmDialog.title}</h3>
            </div>
            <div className="p-6">
              <p className="text-gray-700 text-base">{confirmDialog.message}</p>
            </div>
            <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={hideConfirm}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Financial Year Management</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          {showForm ? 'Cancel' : '+ New Financial Year'}
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Create New Financial Year</h2>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Financial Year Name *
                </label>
                <input
                  type="text"
                  value={formData.yearName}
                  onChange={(e) => setFormData({ ...formData, yearName: e.target.value })}
                  placeholder="e.g., FY 2025-26"
                  className={`w-full px-3 py-2 border rounded-lg ${formErrors.yearName ? 'border-red-500' : 'border-gray-300'}`}
                />
                {formErrors.yearName && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.yearName}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  From Date *
                </label>
                <input
                  type="date"
                  value={formData.fromDate}
                  onChange={(e) => setFormData({ ...formData, fromDate: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg ${formErrors.fromDate ? 'border-red-500' : 'border-gray-300'}`}
                />
                {formErrors.fromDate && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.fromDate}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  To Date *
                </label>
                <input
                  type="date"
                  value={formData.toDate}
                  onChange={(e) => setFormData({ ...formData, toDate: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg ${formErrors.toDate ? 'border-red-500' : 'border-gray-300'}`}
                />
                {formErrors.toDate && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.toDate}</p>
                )}
              </div>
            </div>

            <div className="mt-4 bg-blue-50 border border-blue-200 rounded p-3">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Creating a financial year will automatically generate 12 monthly periods.
                The first period will be set to "Open" and all others will be "Closed".
              </p>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
              >
                {loading ? 'Creating...' : 'Create Financial Year'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setFormData({ yearName: '', fromDate: '', toDate: '' });
                  setFormErrors({});
                }}
                className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Financial Years List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Years List */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold">Financial Years</h2>
          </div>
          <div className="divide-y max-h-96 overflow-y-auto">
            {financialYears.map((year) => (
              <div
                key={year.finyearid}
                className={`p-4 hover:bg-gray-50 cursor-pointer ${selectedYear === year.finyearid ? 'bg-blue-50' : ''}`}
                onClick={() => fetchPeriods(year.finyearid)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{year.finyearname}</h3>
                    <p className="text-sm text-gray-600">
                      {new Date(year.fydatefrom).toLocaleDateString()} - {new Date(year.fydateto).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {year.period_count} periods • {year.open_periods} open
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(year.finyearid);
                    }}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
            {financialYears.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                <p>No financial years created yet</p>
                <p className="text-sm mt-2">Click "New Financial Year" to create one</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Periods List */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold">Financial Periods</h2>
          </div>
          <div className="divide-y max-h-96 overflow-y-auto">
            {periods.map((period) => (
              <div key={period.period_id} className="p-4">
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{period.period_name}</h3>
                      <span className={`px-2 py-1 text-xs font-semibold rounded ${getStatusColor(period.status)}`}>
                        {period.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      {new Date(period.start_date).toLocaleDateString()} - {new Date(period.end_date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {period.status !== 'Open' && (
                      <button
                        onClick={() => handlePeriodStatusChange(period.period_id, 'Open')}
                        className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
                      >
                        Open
                      </button>
                    )}
                    {period.status === 'Open' && (
                      <button
                        onClick={() => handlePeriodStatusChange(period.period_id, 'Closed')}
                        className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                      >
                        Close
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {periods.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                <p>Select a financial year to view periods</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinancialYearPage;
