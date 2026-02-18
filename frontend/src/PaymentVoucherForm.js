import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import API_BASE_URL from './config/api';
import { 
  Save, CheckCircle, Send, ArrowLeft, Calendar, 
  User, CreditCard, Banknote, Smartphone, FileText,
  Plus, Trash2, DollarSign, AlertCircle
} from 'lucide-react';

// Helper to get auth headers
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return { headers: { Authorization: `Bearer ${token}` } };
};

const PaymentVoucherForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = id && id !== 'new';

  const [loading, setLoading] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [isSaved, setIsSaved] = useState(false); // Track if form has been saved
  
  // Toast notification state
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // Toast notification helper
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'success' });
    }, 3000);
  };
  
  const [paymentData, setPaymentData] = useState({
    fyear_id: parseInt(localStorage.getItem('selectedFYearID')) || 1,
    payment_no: null,
    payment_date: new Date().toISOString().split('T')[0],
    party_id: '',
    payment_mode: 'CASH',
    cash_account_id: '',
    bank_account_id: '',
    payment_amount: 0,
    payment_reference: '',
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
    fetchVendors();
    fetchAccounts();
    if (isEditMode) {
      fetchPaymentData();
    } else {
      fetchNextNumber();
      setIsSaved(false); // Reset saved state for new payment
    }
  }, [id]);

  useEffect(() => {
    if (paymentData.party_id) {
      fetchOutstandingInvoices(paymentData.party_id);
    }
  }, [paymentData.party_id]);


  const fetchVendors = async () => {
    try {
      console.log('Fetching vendors from:', `${API_BASE_URL}/api/party/all`);
      const response = await axios.get(`${API_BASE_URL}/api/party/all`, getAuthHeaders());
      console.log('Vendors response:', response.data);
      // Filter for vendors (partytype = 2) and sort alphabetically by name
      const vendorList = response.data
        .filter(p => parseInt(p.partytype ?? 0, 10) === 2)
        .sort((a, b) => (a.partyname || '').localeCompare(b.partyname || ''));
      console.log('Filtered vendors:', vendorList);
      setVendors(vendorList);
    } catch (error) {
      console.error('Error fetching vendors:', error);
      console.error('Error details:', error.response?.data);
    }
  };

  const fetchAccounts = async () => {
    try {
      console.log('Fetching accounts from:', `${API_BASE_URL}/api/coa/all`);
      const response = await axios.get(`${API_BASE_URL}/api/coa/all`, getAuthHeaders());
      console.log('Accounts response:', response.data);
      setAccounts(response.data);
    } catch (error) {
      console.error('Error fetching accounts:', error);
      console.error('Error details:', error.response?.data);
    }
  };

  const fetchNextNumber = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/payments/next-number?fyear_id=${paymentData.fyear_id}`, getAuthHeaders());
      setPaymentData(prev => ({ ...prev, payment_no: response.data.next_no }));
    } catch (error) {
      console.error('Error fetching next number:', error);
    }
  };

  const fetchOutstandingInvoices = async (vendorId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/payments/vendor/${vendorId}/outstanding?fyear_id=${paymentData.fyear_id}`, getAuthHeaders());
      setAllocations(response.data.map(inv => ({
        purchase_inv_id: inv.tran_id,
        inv_reference: inv.inv_reference,
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

  const fetchPaymentData = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/payments/${id}`, getAuthHeaders());
      const { header, allocations: allocs, cheque } = response.data;
      
      setPaymentData({
        ...header,
        payment_date: header.payment_date.split('T')[0]
      });
      
      if (cheque) {
        setChequeData({
          ...cheque,
          cheque_date: cheque.cheque_date.split('T')[0]
        });
      }
      
      const outstandingResp = await axios.get(`${API_BASE_URL}/api/payments/vendor/${header.party_id}/outstanding?fyear_id=${header.fyear_id}`, getAuthHeaders());
      const outstanding = outstandingResp.data;
      
      const mergedAllocations = outstanding.map(inv => {
        const existingAlloc = allocs.find(a => a.purchase_inv_id === inv.tran_id);
        return {
          purchase_inv_id: inv.tran_id,
          inv_reference: inv.inv_reference,
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
      console.error('Error fetching payment data:', error);
      showToast('Failed to fetch payment data', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Wrapper to update payment data and reset saved state
  const updatePaymentData = (updates) => {
    setPaymentData(prev => ({ ...prev, ...updates }));
    setIsSaved(false);
  };

  // Filter accounts based on payment mode
  const getFilteredAccounts = () => {
    if (paymentData.payment_mode === 'CASH') {
      return accounts.filter(acc => acc.account_nature?.trim().toUpperCase() === 'CASH_HAND');
    } else {
      // For CHEQUE, BANK, UPI - show bank accounts
      return accounts.filter(acc => acc.account_nature?.trim().toUpperCase() === 'BANK_ACC');
    }
  };

  const handleAutoAllocate = () => {
    let remaining = parseFloat(paymentData.payment_amount) || 0;
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
    setIsSaved(false); // Reset saved state when auto-allocating
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
    setIsSaved(false); // Reset saved state when allocations change
  };

  const getTotalAllocated = () => {
    return allocations.reduce((sum, alloc) => sum + (parseFloat(alloc.allocated_amount) || 0), 0);
  };

  const getUnallocated = () => {
    return (parseFloat(paymentData.payment_amount) || 0) - getTotalAllocated();
  };

  const handleSave = async () => {
    if (!paymentData.party_id) {
      showToast('Please select a vendor', 'error');
      return;
    }
    
    if (!paymentData.payment_amount || paymentData.payment_amount <= 0) {
      showToast('Please enter a valid payment amount', 'error');
      return;
    }
    
    if (paymentData.payment_mode === 'CASH' && !paymentData.cash_account_id) {
      showToast('Please select a cash account', 'error');
      return;
    }
    
    if (paymentData.payment_mode !== 'CASH' && !paymentData.bank_account_id) {
      showToast('Please select a bank account', 'error');
      return;
    }
    
    if (paymentData.payment_mode === 'CHEQUE' && (!chequeData.cheque_no || !chequeData.bank_name)) {
      showToast('Please enter cheque details', 'error');
      return;
    }

    // Validate total allocated amount doesn't exceed payment amount
    const totalAllocated = getTotalAllocated();
    const paymentAmount = parseFloat(paymentData.payment_amount) || 0;
    if (totalAllocated > paymentAmount) {
      showToast(`Total allocated amount (₹${totalAllocated.toFixed(2)}) cannot exceed payment amount (₹${paymentAmount.toFixed(2)})`, 'error');
      return;
    }
    
    setLoading(true);
    try {
      // Prepare cheque data with payment amount if cheque_amount is 0
      const chequePayload = paymentData.payment_mode === 'CHEQUE' ? {
        ...chequeData,
        cheque_amount: chequeData.cheque_amount > 0 ? chequeData.cheque_amount : paymentData.payment_amount
      } : null;

      const payload = {
        header: paymentData,
        allocations: allocations.filter(a => a.allocated_amount > 0),
        cheque: chequePayload
      };
      
      if (isEditMode) {
        await axios.put(`${API_BASE_URL}/api/payments/${id}`, payload, getAuthHeaders());
        showToast('Payment updated successfully', 'success');
        setIsSaved(true);
      } else {
        const response = await axios.post(`${API_BASE_URL}/api/payments`, payload, getAuthHeaders());
        showToast('Payment created successfully', 'success');
        setIsSaved(true);
        navigate(`/payment-voucher/${response.data.payment_id}`);
      }
    } catch (error) {
      console.error('Error saving payment:', error);
      showToast(error.response?.data?.error || 'Failed to save payment', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/api/payments/${id}/confirm`, {}, getAuthHeaders());
      showToast('Payment confirmed successfully', 'success');
      fetchPaymentData();
    } catch (error) {
      console.error('Error confirming payment:', error);
      showToast(error.response?.data?.error || 'Failed to confirm payment', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePost = async () => {
    setLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/api/payments/${id}/post`, {}, getAuthHeaders());
      showToast('Payment posted successfully', 'success');
      fetchPaymentData();
    } catch (error) {
      console.error('Error posting payment:', error);
      showToast(error.response?.data?.error || 'Failed to post payment', 'error');
    } finally {
      setLoading(false);
    }
  };

  const canEdit = !paymentData.is_confirmed && !paymentData.is_posted && !isSaved;
  const canConfirm = isEditMode && !paymentData.is_confirmed && !paymentData.is_posted;
  const canPost = isEditMode && paymentData.is_confirmed && !paymentData.is_posted;

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
                onClick={() => navigate('/payment-voucher')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {isEditMode ? `Payment #${paymentData.payment_no}` : 'New Payment Voucher'}
                </h1>
                {isEditMode && (
                  <div className="flex items-center space-x-2 mt-1">
                    {paymentData.is_posted ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Posted
                      </span>
                    ) : paymentData.is_confirmed ? (
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
              {(isSaved || paymentData.is_confirmed || paymentData.is_posted) && (
                <button
                  onClick={() => navigate('/payment-voucher/new')}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add New
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Payment Details */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment No
              </label>
              <input
                type="text"
                value={paymentData.payment_no || ''}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Calendar className="w-4 h-4 inline mr-1" />
                Payment Date *
              </label>
              <input
                type="date"
                value={paymentData.payment_date}
                onChange={(e) => updatePaymentData({ payment_date: e.target.value })}
                disabled={!canEdit}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Reference
              </label>
              <input
                type="text"
                value={paymentData.payment_reference}
                onChange={(e) => updatePaymentData({ payment_reference: e.target.value })}
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
                Vendor *
              </label>
              <select
                value={paymentData.party_id}
                onChange={(e) => updatePaymentData({ party_id: e.target.value })}
                disabled={!canEdit}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
              >
                <option value="">Select Vendor</option>
                {vendors.map(vendor => (
                  <option key={vendor.partyid} value={vendor.partyid}>
                    {vendor.partyname}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <DollarSign className="w-4 h-4 inline mr-1" />
                Payment Amount *
              </label>
              <input
                type="number"
                step="0.01"
                value={paymentData.payment_amount}
                onChange={(e) => updatePaymentData({ payment_amount: e.target.value })}
                disabled={!canEdit}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
              />
            </div>
          </div>

          {/* Payment Mode */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment Mode *
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
                  onClick={() => updatePaymentData({ payment_mode: mode.value })}
                  disabled={!canEdit}
                  className={`flex items-center justify-center px-4 py-3 border-2 rounded-lg transition-all ${
                    paymentData.payment_mode === mode.value
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
              {paymentData.payment_mode === 'CASH' ? 'Cash Account *' : 'Bank Account *'}
            </label>
            <select
              value={paymentData.payment_mode === 'CASH' ? paymentData.cash_account_id : paymentData.bank_account_id}
              onChange={(e) => {
                if (paymentData.payment_mode === 'CASH') {
                  updatePaymentData({ cash_account_id: e.target.value });
                } else {
                  updatePaymentData({ bank_account_id: e.target.value });
                }
              }}
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
              {paymentData.payment_mode === 'CASH' 
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
              value={paymentData.narration}
              onChange={(e) => updatePaymentData({ narration: e.target.value })}
              disabled={!canEdit}
              placeholder="Enter payment narration"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
            />
          </div>
        </div>


        {/* Cheque Details (Conditional) */}
        {paymentData.payment_mode === 'CHEQUE' && (
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
                  value={chequeData.cheque_amount > 0 ? chequeData.cheque_amount : paymentData.payment_amount}
                  onChange={(e) => setChequeData({ ...chequeData, cheque_amount: parseFloat(e.target.value) || 0 })}
                  disabled={!canEdit}
                  placeholder={paymentData.payment_amount}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
                />
                <p className="mt-1 text-xs text-gray-500">Defaults to payment amount if not specified</p>
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

          {!paymentData.party_id ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">Please select a vendor to view outstanding invoices</p>
            </div>
          ) : allocations.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
              <p className="text-gray-500">No outstanding invoices for this vendor</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Trn. No
                      </th>
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
                      <tr key={alloc.purchase_inv_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {alloc.inv_reference}
                        </td>
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
                      <td colSpan="6" className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                        Total Allocated:
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-blue-600">
                        ₹{getTotalAllocated().toFixed(2)}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan="6" className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
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

export default PaymentVoucherForm;
