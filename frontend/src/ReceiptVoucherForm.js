import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import API_BASE_URL from './config/api';
import { 
  Save, CheckCircle, Send, ArrowLeft, Calendar, 
  User, CreditCard, Banknote, Smartphone, FileText,
  Plus, DollarSign, AlertCircle
} from 'lucide-react';

// Helper to get auth headers
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return { headers: { Authorization: `Bearer ${token}` } };
};

const ReceiptVoucherForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = id && id !== 'new';

  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [isSaved, setIsSaved] = useState(false);
  
  // Toast notification state
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // Toast notification helper
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'success' });
    }, 3000);
  };
  
  const [receiptData, setReceiptData] = useState({
    fyear_id: parseInt(localStorage.getItem('selectedFYearID')) || 1,
    receipt_no: null,
    receipt_date: new Date().toISOString().split('T')[0],
    party_id: '',
    receipt_mode: 'CASH',
    receipt_account_id: '',
    receipt_amount: 0,
    reference_number: '',
    narration: '',
    is_confirmed: false,
    is_posted: false
  });


  const [chequeData, setChequeData] = useState({
    cheque_no: '',
    cheque_date: new Date().toISOString().split('T')[0],
    bank_name: '',
    branch_name: '',
    cheque_amount: 0,
    cheque_status: 'ISSUED'
  });

  const [allocations, setAllocations] = useState([]);

  useEffect(() => {
    fetchCustomers();
    fetchAccounts();
    if (isEditMode) {
      fetchReceiptData();
    } else {
      fetchNextNumber();
      setIsSaved(false);
    }
  }, [id]);

  useEffect(() => {
    if (receiptData.party_id) {
      fetchOutstandingInvoices(receiptData.party_id);
    }
  }, [receiptData.party_id]);

  const fetchCustomers = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/party/all`, getAuthHeaders());
      const customerList = response.data
        .filter(p => parseInt(p.partytype ?? 0, 10) === 1)
        .sort((a, b) => (a.partyname || '').localeCompare(b.partyname || ''));
      setCustomers(customerList);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const fetchAccounts = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/coa/all`, getAuthHeaders());
      setAccounts(response.data);
    } catch (error) {
      console.error('Error fetching accounts:', error);
    }
  };

  const fetchNextNumber = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/receipts/next-number?fyear_id=${receiptData.fyear_id}`, getAuthHeaders());
      setReceiptData(prev => ({ ...prev, receipt_no: response.data.next_no }));
    } catch (error) {
      console.error('Error fetching next number:', error);
    }
  };

  const fetchOutstandingInvoices = async (customerId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/receipts/customer/${customerId}/outstanding?fyear_id=${receiptData.fyear_id}`, getAuthHeaders());
      setAllocations(response.data.map(inv => ({
        invoice_id: inv.tran_id,
        party_inv_no: inv.party_inv_no,
        tran_date: inv.tran_date,
        tran_amount: inv.tran_amount,
        paid_amount: inv.paid_amount,
        balance_amount: inv.balance_amount,
        allocated_amount: 0
      })));
    } catch (error) {
      console.error('Error fetching outstanding invoices:', error);
    }
  };


  const fetchReceiptData = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/receipts/${id}`, getAuthHeaders());
      const { header, allocations: allocs, cheque } = response.data;
      
      setReceiptData({
        ...header,
        receipt_date: header.receipt_date.split('T')[0]
      });
      
      if (cheque) {
        setChequeData({
          ...cheque,
          cheque_date: cheque.cheque_date.split('T')[0]
        });
      }
      
      const outstandingResp = await axios.get(`${API_BASE_URL}/api/receipts/customer/${header.party_id}/outstanding?fyear_id=${header.fyear_id}`, getAuthHeaders());
      const outstanding = outstandingResp.data;
      
      const mergedAllocations = outstanding.map(inv => {
        const existingAlloc = allocs.find(a => a.invoice_id === inv.tran_id);
        return {
          invoice_id: inv.tran_id,
          party_inv_no: inv.party_inv_no,
          tran_date: inv.tran_date,
          tran_amount: inv.tran_amount,
          paid_amount: inv.paid_amount,
          balance_amount: inv.balance_amount,
          allocated_amount: existingAlloc ? existingAlloc.allocated_amount : 0
        };
      });
      
      setAllocations(mergedAllocations);
    } catch (error) {
      console.error('Error fetching receipt data:', error);
      showToast('Failed to fetch receipt data', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Wrapper to update receipt data and reset saved state
  const updateReceiptData = (updates) => {
    setReceiptData(prev => ({ ...prev, ...updates }));
    setIsSaved(false);
  };

  // Filter accounts based on receipt mode
  const getFilteredAccounts = () => {
    if (receiptData.receipt_mode === 'CASH') {
      return accounts.filter(acc => acc.account_nature?.trim().toUpperCase() === 'CASH_HAND');
    } else {
      return accounts.filter(acc => acc.account_nature?.trim().toUpperCase() === 'BANK_ACC');
    }
  };

  const handleAutoAllocate = () => {
    let remaining = parseFloat(receiptData.receipt_amount) || 0;
    const newAllocations = [...allocations].sort((a, b) => new Date(a.tran_date) - new Date(b.tran_date));
    
    for (let i = 0; i < newAllocations.length; i++) {
      if (remaining <= 0) {
        newAllocations[i].allocated_amount = 0;
        continue;
      }
      
      const dueAmount = parseFloat(newAllocations[i].balance_amount) || 0;
      const allocateAmount = Math.min(remaining, dueAmount);
      
      newAllocations[i].allocated_amount = allocateAmount;
      remaining -= allocateAmount;
    }
    
    setAllocations(newAllocations);
    setIsSaved(false);
  };

  const handleAllocationChange = (index, value) => {
    const newAllocations = [...allocations];
    const allocAmount = parseFloat(value) || 0;
    const dueAmount = parseFloat(newAllocations[index].balance_amount) || 0;
    
    if (allocAmount > dueAmount) {
      showToast('Allocation cannot exceed due amount', 'error');
      return;
    }
    
    newAllocations[index].allocated_amount = allocAmount;
    setAllocations(newAllocations);
    setIsSaved(false);
  };

  const getTotalAllocated = () => {
    return allocations.reduce((sum, alloc) => sum + (parseFloat(alloc.allocated_amount) || 0), 0);
  };

  const getUnallocated = () => {
    return (parseFloat(receiptData.receipt_amount) || 0) - getTotalAllocated();
  };


  const handleSave = async () => {
    if (!receiptData.party_id) {
      showToast('Please select a customer', 'error');
      return;
    }
    
    if (!receiptData.receipt_amount || receiptData.receipt_amount <= 0) {
      showToast('Please enter a valid receipt amount', 'error');
      return;
    }
    
    if (!receiptData.receipt_account_id) {
      showToast('Please select an account', 'error');
      return;
    }
    
    if (receiptData.receipt_mode === 'CHEQUE' && (!chequeData.cheque_no || !chequeData.bank_name)) {
      showToast('Please enter cheque details', 'error');
      return;
    }

    const totalAllocated = getTotalAllocated();
    const receiptAmount = parseFloat(receiptData.receipt_amount) || 0;
    if (totalAllocated > receiptAmount) {
      showToast(`Total allocated amount (₹${totalAllocated.toFixed(2)}) cannot exceed receipt amount (₹${receiptAmount.toFixed(2)})`, 'error');
      return;
    }
    
    setLoading(true);
    try {
      const chequePayload = receiptData.receipt_mode === 'CHEQUE' ? {
        ...chequeData,
        cheque_amount: chequeData.cheque_amount > 0 ? chequeData.cheque_amount : receiptData.receipt_amount
      } : null;

      const payload = {
        header: receiptData,
        allocations: allocations.filter(a => a.allocated_amount > 0),
        cheque: chequePayload
      };
      
      if (isEditMode) {
        await axios.put(`${API_BASE_URL}/api/receipts/${id}`, payload, getAuthHeaders());
        showToast('Receipt updated successfully', 'success');
        setIsSaved(true);
      } else {
        const response = await axios.post(`${API_BASE_URL}/api/receipts`, payload, getAuthHeaders());
        showToast('Receipt created successfully', 'success');
        setIsSaved(true);
        navigate(`/receipt-voucher/${response.data.receipt_id}`);
      }
    } catch (error) {
      console.error('Error saving receipt:', error);
      showToast(error.response?.data?.error || 'Failed to save receipt', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/api/receipts/${id}/confirm`, {}, getAuthHeaders());
      showToast('Receipt confirmed successfully', 'success');
      fetchReceiptData();
    } catch (error) {
      console.error('Error confirming receipt:', error);
      showToast(error.response?.data?.error || 'Failed to confirm receipt', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePost = async () => {
    setLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/api/receipts/${id}/post`, {}, getAuthHeaders());
      showToast('Receipt posted successfully', 'success');
      fetchReceiptData();
    } catch (error) {
      console.error('Error posting receipt:', error);
      showToast(error.response?.data?.error || 'Failed to post receipt', 'error');
    } finally {
      setLoading(false);
    }
  };

  const canEdit = !receiptData.is_confirmed && !receiptData.is_posted && !isSaved;
  const canConfirm = isEditMode && !receiptData.is_confirmed && !receiptData.is_posted;
  const canPost = isEditMode && receiptData.is_confirmed && !receiptData.is_posted;

  if (loading && isEditMode) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/receipt-voucher')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {isEditMode ? `Receipt #${receiptData.receipt_no}` : 'New Receipt Voucher'}
                </h1>
                {isEditMode && (
                  <div className="flex items-center space-x-2 mt-1">
                    {receiptData.is_posted ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Posted
                      </span>
                    ) : receiptData.is_confirmed ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Confirmed
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        Draft
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {canEdit && (
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </button>
              )}
              {canConfirm && (
                <button
                  onClick={handleConfirm}
                  disabled={loading}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Confirm
                </button>
              )}
              {canPost && (
                <button
                  onClick={handlePost}
                  disabled={loading}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Post
                </button>
              )}
              {(isSaved || receiptData.is_confirmed || receiptData.is_posted) && (
                <button
                  onClick={() => navigate('/receipt-voucher/new')}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add New
                </button>
              )}
            </div>
          </div>
        </div>


        {/* Receipt Details */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Receipt Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Receipt No
              </label>
              <input
                type="text"
                value={receiptData.receipt_no || ''}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Calendar className="w-4 h-4 inline mr-1" />
                Receipt Date *
              </label>
              <input
                type="date"
                value={receiptData.receipt_date}
                onChange={(e) => updateReceiptData({ receipt_date: e.target.value })}
                disabled={!canEdit}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reference Number
              </label>
              <input
                type="text"
                value={receiptData.reference_number}
                onChange={(e) => updateReceiptData({ reference_number: e.target.value })}
                disabled={!canEdit}
                placeholder="Enter reference"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <User className="w-4 h-4 inline mr-1" />
                Customer *
              </label>
              <select
                value={receiptData.party_id}
                onChange={(e) => updateReceiptData({ party_id: e.target.value })}
                disabled={!canEdit}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
              >
                <option value="">Select Customer</option>
                {customers.map(customer => (
                  <option key={customer.partyid} value={customer.partyid}>
                    {customer.partyname}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <DollarSign className="w-4 h-4 inline mr-1" />
                Receipt Amount *
              </label>
              <input
                type="number"
                step="0.01"
                value={receiptData.receipt_amount}
                onChange={(e) => updateReceiptData({ receipt_amount: e.target.value })}
                disabled={!canEdit}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
              />
            </div>
          </div>

          {/* Receipt Mode */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Receipt Mode *
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { value: 'CASH', icon: Banknote, label: 'Cash' },
                { value: 'CHEQUE', icon: FileText, label: 'Cheque' },
                { value: 'BANK', icon: CreditCard, label: 'Bank Transfer' },
                { value: 'UPI', icon: Smartphone, label: 'UPI' }
              ].map(mode => (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => updateReceiptData({ receipt_mode: mode.value })}
                  disabled={!canEdit}
                  className={`flex items-center justify-center px-4 py-3 border-2 rounded-lg transition-all ${
                    receiptData.receipt_mode === mode.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  } ${!canEdit ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <mode.icon className="w-5 h-5 mr-2" />
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          {/* Account Selection */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {receiptData.receipt_mode === 'CASH' ? 'Cash Account *' : 'Bank Account *'}
            </label>
            <select
              value={receiptData.receipt_account_id}
              onChange={(e) => updateReceiptData({ receipt_account_id: e.target.value })}
              disabled={!canEdit}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
            >
              <option value="">Select Account</option>
              {getFilteredAccounts().map(account => (
                <option key={account.account_id} value={account.account_id}>
                  {account.account_code} - {account.account_name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              {receiptData.receipt_mode === 'CASH' 
                ? 'Showing cash accounts only' 
                : 'Showing bank accounts only'}
            </p>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Narration
            </label>
            <textarea
              rows="2"
              value={receiptData.narration}
              onChange={(e) => updateReceiptData({ narration: e.target.value })}
              disabled={!canEdit}
              placeholder="Enter receipt narration"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
            />
          </div>
        </div>


        {/* Cheque Details (Conditional) */}
        {receiptData.receipt_mode === 'CHEQUE' && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6 border-l-4 border-blue-500">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <FileText className="w-5 h-5 mr-2 text-blue-600" />
              Cheque Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cheque No *
                </label>
                <input
                  type="text"
                  value={chequeData.cheque_no}
                  onChange={(e) => setChequeData({ ...chequeData, cheque_no: e.target.value })}
                  disabled={!canEdit}
                  placeholder="Enter cheque number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cheque Date *
                </label>
                <input
                  type="date"
                  value={chequeData.cheque_date}
                  onChange={(e) => setChequeData({ ...chequeData, cheque_date: e.target.value })}
                  disabled={!canEdit}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bank Name *
                </label>
                <input
                  type="text"
                  value={chequeData.bank_name}
                  onChange={(e) => setChequeData({ ...chequeData, bank_name: e.target.value })}
                  disabled={!canEdit}
                  placeholder="Enter bank name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Branch Name
                </label>
                <input
                  type="text"
                  value={chequeData.branch_name}
                  onChange={(e) => setChequeData({ ...chequeData, branch_name: e.target.value })}
                  disabled={!canEdit}
                  placeholder="Enter branch name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cheque Amount *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={chequeData.cheque_amount > 0 ? chequeData.cheque_amount : receiptData.receipt_amount}
                  onChange={(e) => setChequeData({ ...chequeData, cheque_amount: parseFloat(e.target.value) || 0 })}
                  disabled={!canEdit}
                  placeholder={receiptData.receipt_amount}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
                />
                <p className="mt-1 text-xs text-gray-500">Defaults to receipt amount if not specified</p>
              </div>
            </div>
          </div>
        )}

        {/* Invoice Allocation */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Invoice Allocation</h2>
            {canEdit && allocations.length > 0 && (
              <button
                onClick={handleAutoAllocate}
                className="inline-flex items-center px-4 py-2 border border-blue-600 rounded-lg text-sm font-medium text-blue-600 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                <Plus className="w-4 h-4 mr-2" />
                Auto Allocate
              </button>
            )}
          </div>

          {!receiptData.party_id ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">Please select a customer to view outstanding invoices</p>
            </div>
          ) : allocations.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
              <p className="text-gray-500">No outstanding invoices for this customer</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Invoice No
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Invoice Amount
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Paid
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Due
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Allocate
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {allocations.map((alloc, index) => (
                      <tr key={alloc.invoice_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                          {alloc.party_inv_no}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {new Date(alloc.tran_date).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                          ₹{parseFloat(alloc.tran_amount).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500">
                          ₹{parseFloat(alloc.paid_amount).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                          ₹{parseFloat(alloc.balance_amount).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={alloc.allocated_amount}
                            onChange={(e) => handleAllocationChange(index, e.target.value)}
                            disabled={!canEdit}
                            max={alloc.balance_amount}
                            className="w-32 px-3 py-1.5 text-right border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan="5" className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                        Total Allocated:
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-blue-600">
                        ₹{getTotalAllocated().toFixed(2)}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan="5" className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                        Unallocated:
                      </td>
                      <td className={`px-4 py-3 text-right text-sm font-bold ${getUnallocated() > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                        ₹{getUnallocated().toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

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
    </div>
  );
};

export default ReceiptVoucherForm;
