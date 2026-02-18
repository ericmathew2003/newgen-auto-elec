import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Edit, Trash2, Search, Filter, FileText, Settings, Save, X, RefreshCw } from 'lucide-react';
import API_BASE_URL from './config/api';
import { usePermissions } from './hooks/usePermissions';

const DynamicTransactionMappingPage = () => {
  const { canCreate, canEdit, canDelete, canView } = usePermissions();
  const [mappings, setMappings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [showForm, setShowForm] = useState(false);
  const [editingMapping, setEditingMapping] = useState(null);
  const [formData, setFormData] = useState({
    transaction_type: '',
    entry_sequence: '',
    account_nature: '',
    debit_credit: 'D',
    value_source: '',
    description_template: '',
    is_dynamic_dc: false,
    event_code: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [accountNatures, setAccountNatures] = useState([]);
  const [valueSources, setValueSources] = useState([]);

  // Notification state
  const [notification, setNotification] = useState({
    show: false,
    type: 'success', // 'success', 'error', 'warning', 'info'
    title: '',
    message: ''
  });

  // Auto-hide notification after 4 seconds
  useEffect(() => {
    if (notification.show) {
      const timer = setTimeout(() => {
        setNotification(prev => ({ ...prev, show: false }));
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [notification.show]);

  // Show notification helper
  const showNotification = (type, title, message) => {
    setNotification({
      show: true,
      type,
      title,
      message
    });
  };

  // Helper function to get auth headers
  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  // Fetch mappings from API
  const fetchMappings = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/transaction-mapping`, {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        console.log('Raw data from backend:', data.map(m => ({
          transaction_type: m.transaction_type,
          event_code: m.event_code,
          entry_sequence: m.entry_sequence
        })));
        setMappings(data);
      } else {
        console.error('Failed to fetch mappings');
      }
    } catch (error) {
      console.error('Error fetching mappings:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch account natures from API
  const fetchAccountNatures = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/account-natures`, {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setAccountNatures(data);
      } else {
        console.error('Failed to fetch account natures, status:', response.status);
        const errorText = await response.text();
        console.error('Error response:', errorText);
      }
    } catch (error) {
      console.error('Error fetching account natures:', error);
    }
  };

  // Fetch value sources from API
  const fetchValueSources = async () => {
    try {
      console.log('Fetching value sources...');
      const response = await fetch(`${API_BASE_URL}/api/value-sources?is_active=true`);
      console.log('Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Value sources data:', data);
        setValueSources(data);
      } else {
        console.error('Failed to fetch value sources, status:', response.status);
        const errorText = await response.text();
        console.error('Error response:', errorText);
      }
    } catch (error) {
      console.error('Error fetching value sources:', error);
    }
  };

  useEffect(() => {
    fetchMappings();
    fetchAccountNatures();
    fetchValueSources();
  }, []);

  const filteredMappings = mappings.filter(mapping => {
    const matchesSearch = mapping.transaction_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      mapping.account_nature.toLowerCase().includes(searchTerm.toLowerCase()) ||
      mapping.value_source.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (mapping.event_code && mapping.event_code.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesFilter = filterType === 'ALL' ||
      (filterType === 'DEBIT' && mapping.debit_credit === 'D') ||
      (filterType === 'CREDIT' && mapping.debit_credit === 'C');
    return matchesSearch && matchesFilter;
  }).sort((a, b) => {
    // Sort by transaction_type (trim spaces), then event_code, then entry_sequence
    const aType = (a.transaction_type || '').trim();
    const bType = (b.transaction_type || '').trim();

    if (aType !== bType) {
      return aType.localeCompare(bType);
    }

    const aEvent = (a.event_code || '').trim();
    const bEvent = (b.event_code || '').trim();

    if (aEvent !== bEvent) {
      return aEvent.localeCompare(bEvent);
    }

    // Ensure numeric sorting for entry_sequence
    const aSeq = parseInt(a.entry_sequence) || 0;
    const bSeq = parseInt(b.entry_sequence) || 0;

    return aSeq - bSeq;
  });

  // Debug: Log the sorted data
  console.log('Sorted mappings:', filteredMappings.map(m => ({
    transaction_type: `"${m.transaction_type}"`, // Show quotes to see spaces
    event_code: m.event_code,
    entry_sequence: m.entry_sequence
  })));

  // Form handlers
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    // Clear error when user starts typing
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.transaction_type.trim()) errors.transaction_type = 'Transaction type is required';
    if (!formData.event_code.trim()) errors.event_code = 'Event code is required';
    if (!formData.entry_sequence.trim()) errors.entry_sequence = 'Entry sequence is required';
    if (!formData.account_nature.trim()) errors.account_nature = 'Account nature is required';
    if (!formData.value_source.trim()) errors.value_source = 'Value source is required';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e, closeAfterSave = false) => {
    if (e) e.preventDefault();

    if (!validateForm()) return;

    try {
      const url = editingMapping
        ? `${API_BASE_URL}/api/transaction-mapping/${editingMapping.mapping_id}`
        : `${API_BASE_URL}/api/transaction-mapping`;

      const method = editingMapping ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        await fetchMappings();

        if (editingMapping || closeAfterSave) {
          // If editing or explicitly closing, close the form after save
          resetForm();
          showNotification(
            'success',
            editingMapping ? 'Mapping Updated!' : 'Mapping Created!',
            editingMapping
              ? 'The transaction mapping has been successfully updated.'
              : 'New transaction mapping has been created successfully.'
          );
        } else {
          // If creating new and not closing, keep form open and just reset fields
          setFormData({
            transaction_type: formData.transaction_type, // Keep transaction type
            entry_sequence: '',
            account_nature: '',
            debit_credit: 'D',
            value_source: '',
            description_template: '',
            is_dynamic_dc: false,
            event_code: formData.event_code // Keep event code
          });
          setFormErrors({});
          showNotification(
            'success',
            'Mapping Created!',
            'New transaction mapping has been created successfully. You can add another mapping.'
          );
        }
      } else {
        const errorData = await response.json();
        showNotification(
          'error',
          'Save Failed',
          errorData.error || 'Failed to save the mapping. Please check your input and try again.'
        );
      }
    } catch (error) {
      console.error('Error saving mapping:', error);
      showNotification(
        'error',
        'Network Error',
        'Unable to save the mapping due to a network error. Please check your connection and try again.'
      );
    }
  };

  const handleEdit = (mapping) => {
    setEditingMapping(mapping);
    setFormData({
      transaction_type: mapping.transaction_type,
      entry_sequence: mapping.entry_sequence.toString(),
      account_nature: mapping.account_nature,
      debit_credit: mapping.debit_credit,
      value_source: mapping.value_source,
      description_template: mapping.description_template || '',
      is_dynamic_dc: mapping.is_dynamic_dc || false,
      event_code: mapping.event_code || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (mappingId, mappingDetails) => {
    const confirmMessage = `Are you sure you want to delete this mapping?\n\nTransaction Type: ${mappingDetails.transaction_type}\nAccount Nature: ${mappingDetails.account_nature}\nValue Source: ${mappingDetails.value_source}\n\nThis action cannot be undone.`;

    if (!window.confirm(confirmMessage)) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/transaction-mapping/${mappingId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        await fetchMappings();
        showNotification(
          'success',
          'Mapping Deleted!',
          'The transaction mapping has been permanently deleted.'
        );
      } else {
        const errorData = await response.json();
        showNotification(
          'error',
          'Delete Failed',
          errorData.error || 'Failed to delete the mapping. Please try again.'
        );
      }
    } catch (error) {
      console.error('Error deleting mapping:', error);
      showNotification(
        'error',
        'Network Error',
        'Unable to delete the mapping due to a network error. Please check your connection and try again.'
      );
    }
  };

  const resetForm = () => {
    setFormData({
      transaction_type: '',
      entry_sequence: '',
      account_nature: '',
      debit_credit: 'D',
      value_source: '',
      description_template: '',
      is_dynamic_dc: false,
      event_code: ''
    });
    setFormErrors({});
    setEditingMapping(null);
    setShowForm(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-3">
      {/* Toast Notification */}
      {notification.show && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-right duration-300">
          <div className={`max-w-md w-full bg-white rounded-lg shadow-lg border-l-4 ${notification.type === 'success' ? 'border-green-500' :
            notification.type === 'error' ? 'border-red-500' :
              notification.type === 'warning' ? 'border-yellow-500' :
                'border-blue-500'
            }`}>
            <div className="p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  {notification.type === 'success' && (
                    <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                      </svg>
                    </div>
                  )}
                  {notification.type === 'error' && (
                    <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                      </svg>
                    </div>
                  )}
                  {notification.type === 'warning' && (
                    <div className="w-6 h-6 bg-yellow-100 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                      </svg>
                    </div>
                  )}
                  {notification.type === 'info' && (
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      </svg>
                    </div>
                  )}
                </div>
                <div className="ml-3 flex-1">
                  <p className={`text-sm font-medium ${notification.type === 'success' ? 'text-green-800' :
                    notification.type === 'error' ? 'text-red-800' :
                      notification.type === 'warning' ? 'text-yellow-800' :
                        'text-blue-800'
                    }`}>
                    {notification.title}
                  </p>
                  <p className={`mt-1 text-sm ${notification.type === 'success' ? 'text-green-700' :
                    notification.type === 'error' ? 'text-red-700' :
                      notification.type === 'warning' ? 'text-yellow-700' :
                        'text-blue-700'
                    }`}>
                    {notification.message}
                  </p>
                </div>
                <div className="ml-4 flex-shrink-0">
                  <button
                    onClick={() => setNotification(prev => ({ ...prev, show: false }))}
                    className={`inline-flex text-gray-400 hover:text-gray-600 focus:outline-none focus:text-gray-600 transition ease-in-out duration-150`}
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-800">
                {editingMapping ? 'Edit Transaction Mapping' : 'New Transaction Mapping'}
              </h2>
              <button
                onClick={resetForm}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={(e) => handleSubmit(e, true)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Transaction Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Transaction Type *
                  </label>
                  <input
                    type="text"
                    name="transaction_type"
                    value={formData.transaction_type}
                    onChange={handleInputChange}
                    disabled={(editingMapping && !canEdit('ACCOUNTS', 'DYNAMIC_MAPPING')) || (!editingMapping && !canCreate('ACCOUNTS', 'DYNAMIC_MAPPING'))}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${formErrors.transaction_type ? 'border-red-500' : 'border-gray-300'
                      }`}
                    placeholder="e.g., Purchase Invoice, Sales Invoice"
                  />
                  {formErrors.transaction_type && (
                    <p className="text-red-500 text-sm mt-1">{formErrors.transaction_type}</p>
                  )}
                </div>

                {/* Event Code */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Event Code *
                  </label>
                  <input
                    type="text"
                    name="event_code"
                    value={formData.event_code}
                    onChange={handleInputChange}
                    disabled={(editingMapping && !canEdit('ACCOUNTS', 'DYNAMIC_MAPPING')) || (!editingMapping && !canCreate('ACCOUNTS', 'DYNAMIC_MAPPING'))}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${formErrors.event_code ? 'border-red-500' : 'border-gray-300'
                      }`}
                    placeholder="e.g., SALES, PURCHASE, COGS"
                  />
                  {formErrors.event_code && (
                    <p className="text-red-500 text-sm mt-1">{formErrors.event_code}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    Event identifier for grouping related journal entries (e.g., SALES for both revenue and COGS entries)
                  </p>
                </div>

                {/* Entry Sequence */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Entry Sequence *
                  </label>
                  <input
                    type="number"
                    name="entry_sequence"
                    value={formData.entry_sequence}
                    onChange={handleInputChange}
                    disabled={(editingMapping && !canEdit('ACCOUNTS', 'DYNAMIC_MAPPING')) || (!editingMapping && !canCreate('ACCOUNTS', 'DYNAMIC_MAPPING'))}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${formErrors.entry_sequence ? 'border-red-500' : 'border-gray-300'
                      }`}
                    placeholder="1, 2, 3..."
                  />
                  {formErrors.entry_sequence && (
                    <p className="text-red-500 text-sm mt-1">{formErrors.entry_sequence}</p>
                  )}
                </div>

                {/* Account Nature */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Account Nature *
                  </label>
                  <select
                    name="account_nature"
                    value={formData.account_nature}
                    onChange={handleInputChange}
                    disabled={(editingMapping && !canEdit('ACCOUNTS', 'DYNAMIC_MAPPING')) || (!editingMapping && !canCreate('ACCOUNTS', 'DYNAMIC_MAPPING'))}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${formErrors.account_nature ? 'border-red-500' : 'border-gray-300'
                      }`}
                  >
                    <option value="">-- Select Account Nature --</option>
                    {accountNatures.length === 0 ? (
                      <option value="" disabled>Loading account natures...</option>
                    ) : (
                      accountNatures.map(nature => (
                        <option key={nature.nature_id} value={nature.nature_code}>
                          {nature.display_name} ({nature.nature_code})
                          {nature.module_tag && ` - ${nature.module_tag}`}
                        </option>
                      ))
                    )}
                  </select>
                  {formErrors.account_nature && (
                    <p className="text-red-500 text-sm mt-1">{formErrors.account_nature}</p>
                  )}
                </div>

                {/* Debit/Credit */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Debit/Credit *
                  </label>
                  <select
                    name="debit_credit"
                    value={formData.debit_credit}
                    onChange={handleInputChange}
                    disabled={(editingMapping && !canEdit('ACCOUNTS', 'DYNAMIC_MAPPING')) || (!editingMapping && !canCreate('ACCOUNTS', 'DYNAMIC_MAPPING'))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="D">Debit</option>
                    <option value="C">Credit</option>
                  </select>
                </div>

                {/* Dynamic Debit/Credit */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Dynamic Debit/Credit
                  </label>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      name="is_dynamic_dc"
                      checked={formData.is_dynamic_dc}
                      onChange={handleInputChange}
                      disabled={(editingMapping && !canEdit('ACCOUNTS', 'DYNAMIC_MAPPING')) || (!editingMapping && !canCreate('ACCOUNTS', 'DYNAMIC_MAPPING'))}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label className="ml-2 text-sm text-gray-700">
                      Enable dynamic debit/credit determination
                    </label>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    When enabled, the system will dynamically determine whether this entry should be debit or credit based on transaction context.
                  </p>
                </div>

                {/* Value Source */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Value Source *
                  </label>
                  <select
                    name="value_source"
                    value={formData.value_source}
                    onChange={handleInputChange}
                    disabled={(editingMapping && !canEdit('ACCOUNTS', 'DYNAMIC_MAPPING')) || (!editingMapping && !canCreate('ACCOUNTS', 'DYNAMIC_MAPPING'))}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${formErrors.value_source ? 'border-red-500' : 'border-gray-300'
                      }`}
                  >
                    <option value="">-- Select Value Source --</option>
                    {valueSources.length === 0 ? (
                      <option value="" disabled>Loading value sources...</option>
                    ) : (
                      valueSources.map(source => (
                        <option key={source.value_code} value={source.value_code}>
                          {source.display_name} ({source.value_code})
                          {source.module_tag && ` - ${source.module_tag}`}
                        </option>
                      ))
                    )}
                  </select>
                  {formErrors.value_source && (
                    <p className="text-red-500 text-sm mt-1">{formErrors.value_source}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    Select the field from the transaction that provides the amount for this journal entry.
                  </p>
                </div>

                {/* Description Template */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description Template
                  </label>
                  <textarea
                    name="description_template"
                    value={formData.description_template}
                    onChange={handleInputChange}
                    disabled={(editingMapping && !canEdit('ACCOUNTS', 'DYNAMIC_MAPPING')) || (!editingMapping && !canCreate('ACCOUNTS', 'DYNAMIC_MAPPING'))}
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Template for journal entry description (optional)"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>

                <div className="flex space-x-3">
                  {!editingMapping && canCreate('ACCOUNTS', 'DYNAMIC_MAPPING') && (
                    <button
                      type="button"
                      onClick={async (e) => {
                        await handleSubmit(e, false);
                        // Form stays open for new entries
                      }}
                      className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Save size={16} />
                      <span>Save & Add Another</span>
                    </button>
                  )}

                  {((editingMapping && canEdit('ACCOUNTS', 'DYNAMIC_MAPPING')) || (!editingMapping && canCreate('ACCOUNTS', 'DYNAMIC_MAPPING'))) && (
                    <button
                      type="submit"
                      className="flex items-center space-x-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <Save size={16} />
                      <span>{editingMapping ? 'Update Mapping' : 'Save & Close'}</span>
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 flex items-center">
              <FileText className="w-8 h-8 mr-3 text-blue-600" />
              Dynamic Transaction Mapping
            </h1>
            <p className="text-gray-600 mt-2">Configure automatic journal entry mappings for different transaction types</p>
          </div>
          <div className="flex items-center space-x-3">
            {canCreate('ACCOUNTS', 'DYNAMIC_MAPPING') && (
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-lg hover:bg-blue-700 transition duration-200"
              >
                <Plus size={20} />
                <span>New Mapping</span>
              </button>
            )}
            <button
              onClick={async () => {
                try {
                  await Promise.all([
                    fetchAccountNatures(),
                    fetchValueSources(),
                    fetchMappings()
                  ]);
                  showNotification(
                    'success',
                    'Data Refreshed!',
                    'All mapping data has been refreshed successfully.'
                  );
                } catch (error) {
                  showNotification(
                    'error',
                    'Refresh Failed',
                    'Failed to refresh data. Please try again.'
                  );
                }
              }}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white font-semibold rounded-lg shadow-lg hover:bg-gray-700 transition duration-200"
              title="Refresh Data"
            >
              <RefreshCw size={16} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 bg-white p-4 rounded-lg shadow-sm border">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search mappings..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Type Filter */}
          <div className="flex items-center space-x-2">
            <Filter size={20} className="text-gray-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="ALL">All Types</option>
              <option value="DEBIT">Debit Entries</option>
              <option value="CREDIT">Credit Entries</option>
            </select>
          </div>
        </div>
      </div>

      {/* Mappings Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Transaction Type
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Event Code
                </th>
                <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sequence
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Account Nature
                </th>
                <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Dr/Cr
                </th>
                <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Dynamic
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Value Source
                </th>
                <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredMappings.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center text-gray-500">
                    <FileText size={48} className="mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-medium">No mappings found</p>
                    <p className="text-sm">
                      {searchTerm || filterType !== 'ALL'
                        ? 'Try adjusting your search or filter criteria'
                        : 'Click "New Mapping" to create your first transaction mapping'
                      }
                    </p>
                  </td>
                </tr>
              ) : (
                filteredMappings.map((mapping) => (
                  <tr key={mapping.mapping_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{mapping.transaction_type}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 font-mono bg-blue-50 px-2 py-1 rounded text-center">
                        {mapping.event_code || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium">
                        {mapping.entry_sequence}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{mapping.account_nature}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${mapping.debit_credit === 'D'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-green-100 text-green-800'
                        }`}>
                        {mapping.debit_credit === 'D' ? 'Debit' : 'Credit'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${mapping.is_dynamic_dc
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-600'
                        }`}>
                        {mapping.is_dynamic_dc ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 font-mono">{mapping.value_source}</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        {canEdit('ACCOUNTS', 'DYNAMIC_MAPPING') && (
                          <button
                            onClick={() => handleEdit(mapping)}
                            className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                            title="Edit Mapping"
                          >
                            <Edit size={16} />
                          </button>
                        )}
                        {canDelete('ACCOUNTS', 'DYNAMIC_MAPPING') && (
                          <button
                            onClick={() => handleDelete(mapping.mapping_id, mapping)}
                            className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                            title="Delete Mapping"
                          >
                            <Trash2 size={16} />
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
      </div>

      {/* Info Section */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start">
          <Settings className="w-6 h-6 text-blue-600 mr-3 mt-1 flex-shrink-0" />
          <div>
            <h3 className="text-lg font-semibold text-blue-900 mb-2">About Dynamic Transaction Mapping</h3>
            <p className="text-blue-800 text-sm mb-3">
              Dynamic Transaction Mapping allows you to configure automatic journal entry generation for different transaction types.
              When transactions are confirmed in the system, the appropriate journal entries will be automatically created based on these mappings.
            </p>
            <div className="text-blue-800 text-sm">
              <p className="font-medium mb-1">Key Fields:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li><strong>Transaction Type:</strong> The type of business transaction (e.g., Purchase Invoice, Sales Invoice)</li>
                <li><strong>Event Code:</strong> Event identifier for grouping related journal entries (e.g., SALES for both revenue and COGS entries)</li>
                <li><strong>Entry Sequence:</strong> Order of journal entries for the same transaction type and event</li>
                <li><strong>Account Nature:</strong> The type of account being affected (e.g., Inventory, Accounts Payable)</li>
                <li><strong>Debit/Credit:</strong> Whether this entry should be a debit or credit</li>
                <li><strong>Dynamic Debit/Credit:</strong> When enabled, the system dynamically determines debit/credit based on transaction context</li>
                <li><strong>Value Source:</strong> Predefined field from the transaction that provides the amount (e.g., Purchase Taxable Amount, Sales Tax Amount)</li>
                <li><strong>Description Template:</strong> Optional template for the journal entry description</li>
              </ul>
              <div className="mt-3 p-3 bg-blue-100 rounded-lg">
                <p className="font-medium text-blue-900 mb-1">Event-Based Journal Generation:</p>
                <p className="text-blue-800 text-sm">
                  The system uses the Event Code to automatically generate multiple journal entries for complex transactions.
                  For example, a "SALES" event can generate both revenue and COGS entries by querying all mappings with event_code="SALES".
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Summary */}
      {filteredMappings.length > 0 && (
        <div className="mt-4 text-sm text-gray-500 text-center">
          Showing {filteredMappings.length} of {mappings.length} transaction mappings
        </div>
      )}
    </div>
  );
};

export default DynamicTransactionMappingPage;