import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { BookA, PlusCircle, MinusCircle, CheckCircle, Save, RotateCcw, ArrowLeft } from 'lucide-react';

const API_ENDPOINT = '/api/accounting/journals';

const initialLineItem = {
    tempId: 1,
    accountId: '',
    partyId: '',
    debitAmount: 0.00,
    creditAmount: 0.00,
    description: '',
};

const initialMasterState = {
    journalSerial: '',
    journalDate: new Date().toISOString().substring(0, 10),
    sourceDocumentType: 'Journal',
    sourceDocumentRef: '',
    narration: '',
};


const AccJournalEntryForm = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEditMode = Boolean(id);
    
    const [masterData, setMasterData] = useState(initialMasterState);
    const [journalDetails, setJournalDetails] = useState([initialLineItem]);
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
            fetchJournalData();
        } else {
            fetchJournalSerial();
        }
    }, [id, isEditMode]);

    const fetchAccounts = async () => {
        try {
            const response = await fetch('/api/coa');
            if (response.ok) {
                const data = await response.json();
                setAccounts(data);
            } else {
                console.error('Failed to fetch accounts');
            }
        } catch (error) {
            console.error('Error fetching accounts:', error);
        }
    };

    const fetchParties = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/party/all', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setParties(data);
            } else {
                console.error('Failed to fetch parties');
            }
        } catch (error) {
            console.error('Error fetching parties:', error);
        }
    };

    const fetchJournalSerial = async () => {
        try {
            const response = await fetch('/api/accounting/journals/serial/next');
            if (response.ok) {
                const data = await response.json();
                setMasterData(prev => ({ ...prev, journalSerial: data.journal_serial }));
            } else {
                console.error('Failed to fetch journal serial');
            }
        } catch (error) {
            console.error('Error fetching journal serial:', error);
        }
    };

    const fetchJournalData = async () => {
        try {
            setIsLoadingData(true);
            const response = await fetch(`${API_ENDPOINT}/${id}`);
            if (response.ok) {
                const data = await response.json();
                console.log('Journal data received:', data);
                
                // Extract master data from the response
                const master = data.master || data;
                
                // Set master data
                setMasterData({
                    journalSerial: master.journal_serial || '',
                    journalDate: master.journal_date ? master.journal_date.substring(0, 10) : '',
                    sourceDocumentType: master.source_document_type || 'Journal',
                    sourceDocumentRef: master.source_document_ref || '',
                    narration: master.narration || '',
                });
                
                console.log('Master data set:', {
                    journalSerial: master.journal_serial || '',
                    journalDate: master.journal_date ? master.journal_date.substring(0, 10) : '',
                    sourceDocumentType: master.source_document_type || 'Journal',
                    sourceDocumentRef: master.source_document_ref || '',
                    narration: master.narration || '',
                });

                // Set journal details (line items)
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
                    setJournalDetails(detailsWithTempId);
                    setNextTempId(detailsWithTempId.length + 1);
                } else {
                    setJournalDetails([initialLineItem]);
                    setNextTempId(2);
                }
            } else {
                showMessage('Error loading journal data', 'error');
                navigate('/journal-voucher');
            }
        } catch (error) {
            console.error('Error fetching journal data:', error);
            showMessage('Network error loading journal data', 'error');
            navigate('/journal-voucher');
        } finally {
            setIsLoadingData(false);
        }
    };

    const showMessage = (message, type) => {
        setStatus({ message, type });
        setTimeout(() => setStatus({ message: '', type: '' }), 6000);
    };

    const { totalDebit, totalCredit, isBalanced } = useMemo(() => {
        const totalDebit = journalDetails.reduce((sum, line) => sum + parseFloat(line.debitAmount || 0), 0);
        const totalCredit = journalDetails.reduce((sum, line) => sum + parseFloat(line.creditAmount || 0), 0);
        const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

        return { totalDebit, totalCredit, isBalanced };
    }, [journalDetails]);


    const handleMasterChange = (e) => {
        const { id, value } = e.target;
        setMasterData(prev => ({ ...prev, [id]: value }));
    };

    const handleLineChange = (tempId, field, value) => {
        setJournalDetails(prevDetails => 
            prevDetails.map(line => {
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
            })
        );
    };

    const addLine = () => {
        setJournalDetails(prevDetails => [...prevDetails, { ...initialLineItem, tempId: nextTempId }]);
        setNextTempId(prevId => prevId + 1);
    };

    const removeLine = (tempId) => {
        if (journalDetails.length === 1) {
            return showMessage("Journal must have at least one line item.", 'error');
        }
        setJournalDetails(prevDetails => prevDetails.filter(line => line.tempId !== tempId));
    };
    
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!isBalanced) {
            showMessage(`Journal is unbalanced. Debit (${totalDebit.toFixed(2)}) must equal Credit (${totalCredit.toFixed(2)}).`, 'error');
            return;
        }
        if (journalDetails.some(line => !line.accountId || (line.debitAmount <= 0 && line.creditAmount <= 0))) {
            showMessage('All lines must have a valid Account and a Debit or Credit amount.', 'error');
            return;
        }

        const storedFYearId = localStorage.getItem('selectedFYearID');
        if (!storedFYearId) {
            showMessage('Financial year is not set. Please select a financial year.', 'error');
            return;
        }

        const payload = {
            journal_date: masterData.journalDate,
            finyearid: parseInt(storedFYearId, 10),
            source_document_type: masterData.sourceDocumentType,
            source_document_ref: masterData.sourceDocumentRef,
            total_debit: totalDebit.toFixed(2),
            total_credit: totalCredit.toFixed(2),
            narration: masterData.narration,
            
            journal_details: journalDetails.map(line => ({
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
            const url = isEditMode ? `${API_ENDPOINT}/${id}` : API_ENDPOINT;
            const method = isEditMode ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const result = await response.json();

            if (response.ok) {
                const action = isEditMode ? 'updated' : 'created';
                showMessage(`Journal entry ${action} successfully! (Serial: ${result.journalSerial || masterData.journalSerial})`, 'success');
                
                if (isEditMode) {
                    // Stay on edit page but refresh data
                    fetchJournalData();
                } else {
                    // Clear form for new entry
                    setMasterData(initialMasterState);
                    setJournalDetails([initialLineItem]);
                    setNextTempId(2);
                    fetchJournalSerial();
                }
            } else {
                showMessage(`Error: ${result.error || 'Failed to save journal entry.'}`, 'error');
            }
        } catch (error) {
            showMessage(`Network Error: Cannot connect to the API. ${error.message}`, 'error');
            console.error('API Error:', error);
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

    const totalDiff = totalDebit - totalCredit;

    if (isLoadingData) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-4xl mx-auto p-4 md:p-8">
            <header className="mb-4">
                <div className="flex items-center mb-2">
                    <button
                        onClick={() => navigate('/journal-voucher')}
                        className="flex items-center text-gray-600 hover:text-gray-800 mr-4"
                    >
                        <ArrowLeft className="w-4 h-4 mr-1" />
                        Back to List
                    </button>
                </div>
                <h1 className="text-2xl font-bold text-gray-800 flex items-center">
                    <BookA className="w-6 h-6 mr-2 text-red-600" />
                    {isEditMode ? 'Edit' : 'Create'} Journal Entry
                </h1>
                <p className="text-gray-500 text-sm mt-1">
                    {isEditMode 
                        ? 'Update the journal entry details below.' 
                        : 'Record a manual double-entry transaction.'
                    }
                </p>
            </header>

            {/* Status Message - Moved to top for better visibility */}
            <div 
                className={`mb-4 p-3 rounded-lg border shadow-sm ${getStatusClasses()}`} 
                role="alert"
            >
                {status.message}
            </div>

            <form onSubmit={handleSubmit}>
                <div className="bg-white p-4 rounded-lg shadow border border-gray-100 mb-4">
                    <h2 className="text-lg font-semibold mb-3 border-b pb-1 text-gray-700">Journal Header</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        
                        <div>
                            <label htmlFor="journalSerial" className="block text-sm font-medium text-gray-700 mb-1">Journal Serial</label>
                            <input
                                type="text"
                                id="journalSerial"
                                value={masterData.journalSerial}
                                readOnly
                                className="w-full p-2 border border-gray-300 rounded bg-gray-100 text-gray-700 cursor-not-allowed font-semibold text-sm"
                            />
                        </div>

                        <div>
                            <label htmlFor="journalDate" className="block text-sm font-medium text-gray-700 mb-1">Journal Date</label>
                            <input
                                type="date"
                                id="journalDate"
                                required
                                value={masterData.journalDate}
                                onChange={handleMasterChange}
                                className="w-full p-2 border border-gray-300 rounded focus:ring-red-500 focus:border-red-500 text-sm"
                            />
                        </div>
                        
                        <div className="md:col-span-1">
                            <label htmlFor="sourceDocumentRef" className="block text-sm font-medium text-gray-700 mb-1">Reference</label>
                            <input
                                type="text"
                                id="sourceDocumentRef"
                                value={masterData.sourceDocumentRef}
                                onChange={handleMasterChange}
                                placeholder="e.g., MJE-001, JEV-010"
                                className="w-full p-2 border border-gray-300 rounded focus:ring-red-500 focus:border-red-500 text-sm"
                            />
                        </div>

                        <div className="md:col-span-3">
                            <label htmlFor="narration" className="block text-sm font-medium text-gray-700 mb-1">Narration / Description</label>
                            <textarea
                                id="narration"
                                value={masterData.narration}
                                onChange={handleMasterChange}
                                rows="1"
                                placeholder="Briefly describe the purpose of this journal entry..."
                                className="w-full p-2 border border-gray-300 rounded focus:ring-red-500 focus:border-red-500 resize-none text-sm"
                            />
                        </div>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-lg shadow border border-gray-100 mb-4">
                    <h2 className="text-lg font-semibold mb-3 border-b pb-1 text-gray-700">Journal Lines</h2>
                    
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/5">Account</th>
                                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/5">Party</th>
                                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/5">Description</th>
                                    <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">Debit</th>
                                    <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">Credit</th>
                                    <th className="w-8"></th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {journalDetails.map((line) => (
                                    <tr key={line.tempId} className="hover:bg-red-50">
                                        
                                        <td className="p-1 whitespace-nowrap">
                                            <select
                                                value={line.accountId}
                                                onChange={(e) => handleLineChange(line.tempId, 'accountId', e.target.value)}
                                                required
                                                className="w-full p-1 border border-gray-300 rounded focus:ring-red-500 focus:border-red-500 text-xs"
                                            >
                                                <option value="">Select Account</option>
                                                {accounts.map(account => (
                                                    <option key={account.account_id} value={account.account_id}>
                                                        {account.account_code} - {account.account_name}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                        
                                        <td className="p-1 whitespace-nowrap">
                                            <select
                                                value={line.partyId}
                                                onChange={(e) => handleLineChange(line.tempId, 'partyId', e.target.value)}
                                                className="w-full p-1 border border-gray-300 rounded focus:ring-red-500 focus:border-red-500 text-xs"
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
                                        
                                        <td className="p-1">
                                            <input
                                                type="text"
                                                value={line.description}
                                                onChange={(e) => handleLineChange(line.tempId, 'description', e.target.value)}
                                                placeholder="Description"
                                                className="w-full p-1 border border-gray-300 rounded focus:ring-red-500 focus:border-red-500 text-xs"
                                            />
                                        </td>

                                        <td className="p-1 whitespace-nowrap">
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={line.debitAmount > 0 ? line.debitAmount : ''}
                                                onChange={(e) => handleLineChange(line.tempId, 'debitAmount', e.target.value)}
                                                placeholder="0.00"
                                                className="w-full p-1 border border-gray-300 rounded focus:ring-red-500 focus:border-red-500 text-xs text-right bg-red-50"
                                            />
                                        </td>
                                        
                                        <td className="p-1 whitespace-nowrap">
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={line.creditAmount > 0 ? line.creditAmount : ''}
                                                onChange={(e) => handleLineChange(line.tempId, 'creditAmount', e.target.value)}
                                                placeholder="0.00"
                                                className="w-full p-1 border border-gray-300 rounded focus:ring-red-500 focus:border-red-500 text-xs text-right bg-green-50"
                                            />
                                        </td>
                                        
                                        <td className="p-1 text-center">
                                            <button 
                                                type="button" 
                                                onClick={() => removeLine(line.tempId)}
                                                className="text-gray-400 hover:text-red-500 transition duration-150"
                                                title="Remove Line"
                                            >
                                                <MinusCircle className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="border-t-2 border-red-300">
                                <tr>
                                    <td colSpan="2" className="py-1 px-2 text-right font-bold text-gray-800">
                                        <button 
                                            type="button" 
                                            onClick={addLine}
                                            className="inline-flex items-center text-xs text-red-600 hover:text-red-800 transition font-semibold"
                                        >
                                            <PlusCircle className="w-3 h-3 mr-1" /> Add Line
                                        </button>
                                    </td>
                                    <td className="py-1 px-2 text-right font-bold text-sm text-red-600">
                                        {totalDebit.toFixed(2)}
                                    </td>
                                    <td className="py-1 px-2 text-right font-bold text-sm text-green-600">
                                        {totalCredit.toFixed(2)}
                                    </td>
                                    <td></td>
                                </tr>
                                <tr className={isBalanced ? 'bg-green-50' : 'bg-red-50'}>
                                    <td colSpan="5" className="py-1 px-2 text-center">
                                        <div className={`font-bold text-sm flex items-center justify-center ${isBalanced ? 'text-green-700' : 'text-red-700'}`}>
                                            <CheckCircle className="w-4 h-4 mr-1" />
                                            {isBalanced ? 
                                                'Journal is Balanced' : 
                                                `Unbalanced by: ${totalDiff.toFixed(2)} ${totalDiff > 0 ? '(Credit needed)' : '(Debit needed)'}`
                                            }
                                        </div>
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>


                <div className="mt-8 pt-6 border-t border-gray-200 flex justify-end space-x-3">
                    <button
                        type="button"
                        onClick={() => { 
                            setMasterData({
                                journalSerial: masterData.journalSerial,
                                journalDate: new Date().toISOString().substring(0, 10),
                                sourceDocumentType: 'Journal',
                                sourceDocumentRef: '',
                                narration: '',
                            }); 
                            setJournalDetails([initialLineItem]); 
                        }}
                        className="flex items-center space-x-2 px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg shadow-sm hover:bg-gray-100 transition duration-200"
                    >
                        <RotateCcw className="w-4 h-4" />
                        <span>Clear Form</span>
                    </button>
                    <button
                        type="submit"
                        disabled={isLoading || !isBalanced || totalDebit === 0}
                        className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-lg hover:bg-blue-700 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Save className="w-4 h-4" />
                        <span>{isLoading ? (isEditMode ? 'Updating...' : 'Posting...') : (isEditMode ? 'Update Journal' : 'Post Journal Entry')}</span>
                    </button>
                </div>
            </form>
        </div>
    );
};

export default AccJournalEntryForm;
