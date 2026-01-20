import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FileText, PlusCircle, MinusCircle, CheckCircle, Save, RotateCcw, ArrowLeft, Calculator } from 'lucide-react';
import axios from 'axios';
import API_BASE_URL from './config/api';
import { usePermissions } from './hooks/usePermissions';

const initialLineItem = {
  tempId: 1,
  accountId: '',
  partyId: '',
  debitAmount: 0.00,
  creditAmount: 0.00,
  description: '',
};

const initialMasterState = {
  debitNoteSerial: '',
  debitNoteDate: new Date().toISOString().substring(0, 10),
  partyId: '',
  sourceDocumentRef: '',
  narration: '',
};

const DebitNoteForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = Boolean(id);
  const { canCreate, canEdit, canDelete, canView } = usePermissions();

  const [masterData, setMasterData] = useState(initialMasterState);
  const [debitNoteDetails, setDebitNoteDetails] = useState([initialLineItem]);
  const [status, setStatus] = useState({ message: '', type: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(isEditMode);
  const [nextTempId, setNextTempId] = useState(2);
  const [accounts, setAccounts] = useState([]);
  const [parties, setParties] = useState([]);

  useEffect(() => {
    fetchAccounts();
    fetchParties();
    if (isEditMode) {
      fetchDebitNoteData();
    } else {
      fetchDebitNoteSerial();
    }
  }, [id, isEditMode]);

  const fetchAccounts = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/api/coa/all`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAccounts(response.data);
    } catch (error) {
      console.error('Error fetching accounts:', error);
      showMessage('Failed to load accounts', 'error');
    }
  };

  const fetchParties = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/api/party/all`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setParties(response.data);
    } catch (error) {
      console.error('Error fetching parties:', error);
      showMessage('Failed to load parties', 'error');
    }
  };

  const fetchDebitNoteSerial = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/api/accounting/journals/debit-notes/serial/next`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMasterData(prev => ({ ...prev, debitNoteSerial: response.data.debit_note_serial }));
    } catch (error) {
      console.error('Error fetching debit note serial:', error);
      showMessage('Failed to generate debit note serial', 'error');
    }
  };

  const fetchDebitNoteData = async () => {
    try {
      setIsLoadingData(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/api/accounting/journals/debit-notes/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = response.data;

      const master = data.master || data;

      setMasterData({
        debitNoteSerial: master.journal_serial || '',
        debitNoteDate: master.journal_date ? master.journal_date.substring(0, 10) : '',
        partyId: master.party_id || '',
        sourceDocumentRef: master.source_document_ref || '',
        narration: master.narration || '',
      });

      const details = data.details || [];
      if (details.length > 0) {
        const detailsWithTempId = details.map((detail, index) => ({
          tempId: index + 1,
          accountId: detail.account_id || '',
          partyId: detail.party_id || '',
          debitAmount: detail.debit_amount || 0.00,
          creditAmount: detail.credit_amount || 0.00,
          description: detail.description || '',
        }));
        setDebitNoteDetails(detailsWithTempId);
        setNextTempId(detailsWithTempId.length + 1);
      } else {
        setDebitNoteDetails([initialLineItem]);
        setNextTempId(2);
      }
    } catch (error) {
      console.error('Error fetching debit note data:', error);
      showMessage('Error loading debit note data', 'error');
      navigate('/accounts/debit-note');
    } finally {
      setIsLoadingData(false);
    }
  };

  const showMessage = (message, type) => {
    setStatus({ message, type });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => setStatus({ message: '', type: '' }), 6000);
  };

  const { totalDebit, totalCredit, isBalanced } = useMemo(() => {
    const totalDebit = debitNoteDetails.reduce((sum, line) => sum + parseFloat(line.debitAmount || 0), 0);
    const totalCredit = debitNoteDetails.reduce((sum, line) => sum + parseFloat(line.creditAmount || 0), 0);
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;
    return { totalDebit, totalCredit, isBalanced };
  }, [debitNoteDetails]);

  const handleMasterChange = (e) => {
    const { id, value } = e.target;
    setMasterData(prev => ({ ...prev, [id]: value }));
  };

  const handleLineChange = (tempId, field, value) => {
    setDebitNoteDetails(prevDetails => prevDetails.map(line => {
      if (line.tempId === tempId) {
        let updatedValue = value;
        if (field === 'debitAmount' || field === 'creditAmount') {
          if (field === 'debitAmount' && parseFloat(value) > 0) {
            return { ...line, debitAmount: value, creditAmount: 0.00 };
          }
          if (field === 'creditAmount' && parseFloat(value) > 0) {
            return { ...line, debitAmount: 0.00, creditAmount: value };
          }
        }
        return { ...line, [field]: updatedValue };
      }
      return line;
    }));
  };

  const addLine = () => {
    setDebitNoteDetails(prevDetails => [...prevDetails, { ...initialLineItem, tempId: nextTempId }]);
    setNextTempId(prevId => prevId + 1);
  };

  const removeLine = (tempId) => {
    if (debitNoteDetails.length === 1) {
      return showMessage("Debit note must have at least one line item.", 'error');
    }
    setDebitNoteDetails(prevDetails => prevDetails.filter(line => line.tempId !== tempId));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isBalanced) {
      showMessage(`Debit note is unbalanced. Debit (${totalDebit.toFixed(2)}) must equal Credit (${totalCredit.toFixed(2)}).`, 'error');
      return;
    }

    if (debitNoteDetails.some(line => !line.accountId || (line.debitAmount <= 0 && line.creditAmount <= 0))) {
      showMessage('All lines must have a valid Account and a Debit or Credit amount.', 'error');
      return;
    }

    const storedFYearId = localStorage.getItem('selectedFYearID');
    if (!storedFYearId) {
      showMessage('Financial year is not set. Please select a financial year.', 'error');
      return;
    }

    const payload = {
      debit_note_date: masterData.debitNoteDate,
      finyearid: parseInt(storedFYearId, 10),
      debit_note_serial: masterData.debitNoteSerial,
      source_document_ref: masterData.sourceDocumentRef,
      total_debit: totalDebit.toFixed(2),
      total_credit: totalCredit.toFixed(2),
      narration: masterData.narration,
      debit_note_details: debitNoteDetails.map(line => ({
        account_id: parseInt(line.accountId, 10),
        party_id: line.partyId ? parseInt(line.partyId, 10) : null,
        debit_amount: parseFloat(line.debitAmount || 0).toFixed(2),
        credit_amount: parseFloat(line.creditAmount || 0).toFixed(2),
        description: line.description,
        allocation_ref_id: null,
      })),
    };

    setIsLoading(true);
    setStatus({ message: '', type: '' });

    try {
      const token = localStorage.getItem('token');
      let response;
      if (isEditMode) {
        response = await axios.put(`${API_BASE_URL}/api/accounting/journals/debit-notes/${id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        response = await axios.post(`${API_BASE_URL}/api/accounting/journals/debit-notes`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }

      const result = response.data;
      const action = isEditMode ? 'updated' : 'created';
      showMessage(`Debit note ${action} successfully! (Serial: ${result.debitNoteSerial || masterData.debitNoteSerial})`, 'success');

      if (isEditMode) {
        fetchDebitNoteData();
      } else {
        setMasterData(initialMasterState);
        setDebitNoteDetails([initialLineItem]);
        setNextTempId(2);
        fetchDebitNoteSerial();
      }
    } catch (error) {
      console.error('API Error:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to save debit note';
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

  if (isLoadingData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading debit note...</p>
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
              onClick={() => navigate('/accounts/debit-note')}
              className="inline-flex items-center text-sm font-medium text-gray-700 hover:text-blue-600"
            >
              <FileText className="w-4 h-4 mr-2" />
              Debit Notes
            </button>
          </li>
          <li>
            <div className="flex items-center">
              <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"></path>
              </svg>
              <span className="ml-1 text-sm font-medium text-gray-500 md:ml-2">
                {isEditMode ? "Edit Debit Note" : "New Debit Note"}
              </span>
            </div>
          </li>
        </ol>
      </nav>

      <div className="w-full max-w-4xl mx-auto">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800 flex items-center">
            <FileText className="w-7 h-7 mr-3 text-blue-600" />
            {isEditMode ? 'Edit' : 'Create'} Debit Note
          </h1>
          <p className="text-gray-500 mt-1">
            {isEditMode ? 'Update the debit note details below.' : 'Create a new debit note for additional charges or adjustments.'}
          </p>
        </header>

        {/* Status Message */}
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

        <form onSubmit={handleSubmit}>
          {/* Debit Note Header */}
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 mb-6">
            <h2 className="text-lg font-semibold mb-4 border-b pb-2 text-gray-700">Debit Note Header</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="debitNoteSerial" className="block text-sm font-medium text-gray-700 mb-1">
                  Debit Note Serial
                </label>
                <input
                  type="text"
                  id="debitNoteSerial"
                  value={masterData.debitNoteSerial}
                  readOnly
                  className="w-full p-3 border border-gray-300 rounded-lg bg-gray-100 text-gray-700 cursor-not-allowed font-semibold"
                />
              </div>

              <div>
                <label htmlFor="debitNoteDate" className="block text-sm font-medium text-gray-700 mb-1">
                  Debit Note Date
                </label>
                <input
                  type="date"
                  id="debitNoteDate"
                  required
                  value={masterData.debitNoteDate}
                  onChange={handleMasterChange}
                  disabled={(isEditMode && !canEdit('ACCOUNTS', 'DEBIT_NOTE')) || (!isEditMode && !canCreate('ACCOUNTS', 'DEBIT_NOTE'))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-150 shadow-sm"
                />
              </div>

              <div>
                <label htmlFor="sourceDocumentRef" className="block text-sm font-medium text-gray-700 mb-1">
                  Reference No.
                </label>
                <input
                  type="text"
                  id="sourceDocumentRef"
                  value={masterData.sourceDocumentRef}
                  onChange={handleMasterChange}
                  disabled={(isEditMode && !canEdit('ACCOUNTS', 'DEBIT_NOTE')) || (!isEditMode && !canCreate('ACCOUNTS', 'DEBIT_NOTE'))}
                  placeholder="e.g., INV-001, PO-123"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-150 shadow-sm"
                />
              </div>

              <div className="md:col-span-2">
                <label htmlFor="narration" className="block text-sm font-medium text-gray-700 mb-1">
                  Narration / Description
                </label>
                <textarea
                  id="narration"
                  value={masterData.narration}
                  onChange={handleMasterChange}
                  disabled={(isEditMode && !canEdit('ACCOUNTS', 'DEBIT_NOTE')) || (!isEditMode && !canCreate('ACCOUNTS', 'DEBIT_NOTE'))}
                  rows="2"
                  placeholder="Briefly describe the purpose of this debit note..."
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 resize-none transition duration-150 shadow-sm"
                />
              </div>
            </div>
          </div>

          {/* Debit Note Lines */}
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 mb-6">
            <h2 className="text-lg font-semibold mb-4 border-b pb-2 text-gray-700">Debit Note Lines</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/5">
                      Account
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/5">
                      Party
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/5">
                      Description
                    </th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                      Debit
                    </th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                      Credit
                    </th>
                    <th className="w-12"></th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {debitNoteDetails.map((line) => (
                    <tr key={line.tempId} className="hover:bg-blue-50">
                      <td className="p-2 whitespace-nowrap">
                        <select
                          value={line.accountId}
                          onChange={(e) => handleLineChange(line.tempId, 'accountId', e.target.value)}
                          required
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm"
                        >
                          <option value="">Select Account</option>
                          {accounts.map(account => (
                            <option key={account.account_id} value={account.account_id}>
                              {account.account_code} - {account.account_name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2 whitespace-nowrap">
                        <select
                          value={line.partyId}
                          onChange={(e) => handleLineChange(line.tempId, 'partyId', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm"
                        >
                          <option value="">Select Party (Optional)</option>
                          {parties.length === 0 ? (
                            <option value="" disabled>No parties available</option>
                          ) : (
                            parties.map(party => (
                              <option key={party.partyid} value={party.partyid}>
                                {party.partyname}
                              </option>
                            ))
                          )}
                        </select>
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={line.description}
                          onChange={(e) => handleLineChange(line.tempId, 'description', e.target.value)}
                          placeholder="Description"
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm"
                        />
                      </td>
                      <td className="p-2 whitespace-nowrap">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.debitAmount > 0 ? line.debitAmount : ''}
                          onChange={(e) => handleLineChange(line.tempId, 'debitAmount', e.target.value)}
                          placeholder="0.00"
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm text-right bg-red-50"
                        />
                      </td>
                      <td className="p-2 whitespace-nowrap">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.creditAmount > 0 ? line.creditAmount : ''}
                          onChange={(e) => handleLineChange(line.tempId, 'creditAmount', e.target.value)}
                          placeholder="0.00"
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm text-right bg-green-50"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <button 
                          type="button" 
                          onClick={() => removeLine(line.tempId)}
                          className="text-gray-400 hover:text-red-500 transition duration-150"
                          title="Remove Line"
                        >
                          <MinusCircle className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-blue-300">
                  <tr>
                    <td colSpan="3" className="py-3 px-3 text-right font-bold text-gray-800">
                      <button 
                        type="button" 
                        onClick={addLine}
                        className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 transition font-semibold"
                      >
                        <PlusCircle className="w-4 h-4 mr-1" /> Add Line
                      </button>
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-sm text-red-600">
                      {totalDebit.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-sm text-green-600">
                      {totalCredit.toFixed(2)}
                    </td>
                    <td></td>
                  </tr>
                  <tr className={isBalanced ? 'bg-green-50' : 'bg-red-50'}>
                    <td colSpan="6" className="py-3 px-3 text-center">
                      <div className={`font-bold text-sm flex items-center justify-center ${
                        isBalanced ? 'text-green-700' : 'text-red-700'
                      }`}>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        {isBalanced 
                          ? 'Debit Note is Balanced' 
                          : `Unbalanced by: ${Math.abs(totalDebit - totalCredit).toFixed(2)} ${totalDebit > totalCredit ? '(Credit needed)' : '(Debit needed)'}`
                        }
                      </div>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex justify-between">
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => { 
                  setMasterData({
                    ...initialMasterState,
                    debitNoteSerial: masterData.debitNoteSerial,
                  }); 
                  setDebitNoteDetails([initialLineItem]); 
                }}
                className="flex items-center space-x-2 px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg shadow-sm hover:bg-gray-100 transition duration-200"
                disabled={isLoading}
              >
                <RotateCcw className="w-4 h-4" />
                <span>Clear Form</span>
              </button>
              
              <button
                type="button"
                onClick={() => navigate('/accounts/debit-note')}
                className="flex items-center space-x-2 px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg shadow-sm hover:bg-gray-100 transition duration-200"
                disabled={isLoading}
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to List</span>
              </button>
            </div>

            {((isEditMode && canEdit('ACCOUNTS', 'DEBIT_NOTE')) || (!isEditMode && canCreate('ACCOUNTS', 'DEBIT_NOTE'))) && (
              <button
                type="submit"
                disabled={isLoading || !isBalanced || totalDebit === 0}
                className={`flex items-center space-x-2 px-6 py-3 font-semibold rounded-lg shadow-lg transition duration-200 ${
                  isLoading || !isBalanced || totalDebit === 0
                    ? 'bg-gray-400 text-white cursor-not-allowed' 
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                <Save className="w-4 h-4" />
                <span>
                  {isLoading 
                    ? (isEditMode ? 'Updating...' : 'Creating...') 
                    : (isEditMode ? 'Update Debit Note' : 'Create Debit Note')
                  }
                </span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default DebitNoteForm;