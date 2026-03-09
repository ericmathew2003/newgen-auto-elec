import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_BASE_URL from '../config/api';
import { 
  X, Banknote, CreditCard, Smartphone, Calendar, 
  DollarSign, User, FileText, CheckCircle, XCircle
} from 'lucide-react';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return { headers: { Authorization: `Bearer ${token}` } };
};

const ReceivePaymentModal = ({ isOpen, onClose, invoiceData, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const [receiptData, setReceiptData] = useState({
    fyear_id: parseInt(localStorage.getItem('selectedFYearID')) || 1,
    receipt_date: new Date().toISOString().split('T')[0],
    party_id: '',
    receipt_mode: 'CASH',
    receipt_account_id: '',
    receipt_amount: 0,
    reference_number: '',
    narration: ''
  });

  useEffect(() => {
    if (isOpen && invoiceData) {
      fetchAccounts();
      setReceiptData(prev => ({
        ...prev,
        party_id: invoiceData.party_id,
        receipt_amount: invoiceData.balance_amount || invoiceData.tot_amount || 0,
        narration: `Payment received for Invoice #${invoiceData.inv_no}`
      }));
    }
  }, [isOpen, invoiceData]);

  const fetchAccounts = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/coa/all`, getAuthHeaders());
      setAccounts(response.data);
    } catch (error) {
      console.error('Error fetching accounts:', error);
      showToast('Failed to load accounts', 'error');
    }
  };

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'success' });
    }, 3000);
  };

  const getFilteredAccounts = () => {
    if (receiptData.receipt_mode === 'CASH') {
      return accounts.filter(acc => 
        acc.account_tag?.trim().toUpperCase() === 'CASH'
      );
    } else {
      return accounts.filter(acc => 
        acc.account_tag?.trim().toUpperCase() === 'BANK'
      );
    }
  };

  const handleConfirm = async () => {
    // Validation
    if (!receiptData.receipt_amount || receiptData.receipt_amount <= 0) {
      showToast('Please enter a valid receipt amount', 'error');
      return;
    }

    if (!receiptData.receipt_account_id) {
      showToast('Please select an account', 'error');
      return;
    }

    setLoading(true);
    try {
      // First, get the tran_id from acc_trn_invoice using inv_master_id
      const invoiceResponse = await axios.get(
        `${API_BASE_URL}/api/invoices/by-master/${invoiceData.inv_master_id}`,
        getAuthHeaders()
      );
      
      const tranId = invoiceResponse.data.tran_id;
      
      if (!tranId) {
        showToast('Invoice not found in accounts receivable', 'error');
        setLoading(false);
        return;
      }

      // Create receipt with allocation using tran_id
      const payload = {
        header: receiptData,
        allocations: [{
          invoice_id: tranId, // Use tran_id from acc_trn_invoice
          allocated_amount: receiptData.receipt_amount
        }],
        cheque: null
      };

      const response = await axios.post(`${API_BASE_URL}/api/receipts`, payload, getAuthHeaders());
      const receiptId = response.data.receipt_id;

      // Auto-confirm the receipt (this updates acc_trn_invoice paid_amount)
      await axios.post(`${API_BASE_URL}/api/receipts/${receiptId}/confirm`, {}, getAuthHeaders());

      // Auto-post the receipt (this creates journal entries and updates is_paid)
      await axios.post(`${API_BASE_URL}/api/receipts/${receiptId}/post`, {}, getAuthHeaders());

      showToast('Payment received and posted successfully!', 'success');
      
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 1500);
    } catch (error) {
      console.error('Error receiving payment:', error);
      showToast(error.response?.data?.error || 'Failed to receive payment', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setReceiptData({
      fyear_id: parseInt(localStorage.getItem('selectedFYearID')) || 1,
      receipt_date: new Date().toISOString().split('T')[0],
      party_id: '',
      receipt_mode: 'CASH',
      receipt_account_id: '',
      receipt_amount: 0,
      reference_number: '',
      narration: ''
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-4 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-white flex items-center">
            <DollarSign className="w-6 h-6 mr-2" />
            Receive Payment
          </h3>
          <button
            onClick={handleCancel}
            className="text-white hover:text-gray-200 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Invoice Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">Invoice Details</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-600">Invoice No:</span>
                <span className="ml-2 font-medium">{invoiceData?.inv_no}</span>
              </div>
              <div>
                <span className="text-gray-600">Date:</span>
                <span className="ml-2 font-medium">
                  {invoiceData?.inv_date ? new Date(invoiceData.inv_date).toLocaleDateString() : '-'}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Customer:</span>
                <span className="ml-2 font-medium">{invoiceData?.customer_name || '-'}</span>
              </div>
              <div>
                <span className="text-gray-600">Total Amount:</span>
                <span className="ml-2 font-medium">
                  ₹{parseFloat(invoiceData?.tot_amount || 0).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Receipt Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar className="w-4 h-4 inline mr-1" />
              Receipt Date *
            </label>
            <input
              type="date"
              value={receiptData.receipt_date}
              onChange={(e) => setReceiptData({ ...receiptData, receipt_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          {/* Receipt Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <DollarSign className="w-4 h-4 inline mr-1" />
              Receipt Amount *
            </label>
            <input
              type="number"
              step="0.01"
              value={receiptData.receipt_amount}
              onChange={(e) => setReceiptData({ ...receiptData, receipt_amount: parseFloat(e.target.value) || 0 })}
              placeholder="0.00"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          {/* Receipt Mode */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment Mode *
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: 'CASH', icon: Banknote, label: 'Cash' },
                { value: 'CARD', icon: CreditCard, label: 'Card' },
                { value: 'UPI', icon: Smartphone, label: 'UPI' }
              ].map(mode => (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => setReceiptData({ ...receiptData, receipt_mode: mode.value, receipt_account_id: '' })}
                  className={`flex items-center justify-center px-4 py-3 border-2 rounded-lg transition-all ${
                    receiptData.receipt_mode === mode.value
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  <mode.icon className="w-5 h-5 mr-2" />
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          {/* Account Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {receiptData.receipt_mode === 'CASH' ? 'Cash Account *' : 'Bank Account *'}
            </label>
            <select
              value={receiptData.receipt_account_id}
              onChange={(e) => setReceiptData({ ...receiptData, receipt_account_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
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

          {/* Reference Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reference Number
            </label>
            <input
              type="text"
              value={receiptData.reference_number}
              onChange={(e) => setReceiptData({ ...receiptData, reference_number: e.target.value })}
              placeholder="Enter reference (optional)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          {/* Narration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Narration
            </label>
            <textarea
              rows="2"
              value={receiptData.narration}
              onChange={(e) => setReceiptData({ ...receiptData, narration: e.target.value })}
              placeholder="Enter narration"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={handleCancel}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <XCircle className="w-4 h-4 mr-2" />
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Processing...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Confirm Payment
              </>
            )}
          </button>
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

export default ReceivePaymentModal;
