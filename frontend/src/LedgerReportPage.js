import React, { useState, useEffect } from 'react';
import { FileText, Calendar, Download, Printer, Search } from 'lucide-react';
import axios from 'axios';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const LedgerReportPage = () => {
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [parties, setParties] = useState([]);
  const [selectedParty, setSelectedParty] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState({ show: false, message: '', type: '' });
  const [companyInfo, setCompanyInfo] = useState(null);

  // Auto-hide toast after 3 seconds
  React.useEffect(() => {
    if (toast.show) {
      const timer = setTimeout(() => {
        setToast({ show: false, message: '', type: '' });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast.show]);

  const showToast = (message, type = 'info') => {
    setToast({ show: true, message, type });
  };

  // Fetch accounts on component mount
  useEffect(() => {
    fetchAccounts();
    fetchParties();
    const token = localStorage.getItem('token');
    axios.get(`${API_BASE_URL}/api/company`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setCompanyInfo(r.data || {}))
      .catch(() => {});
  }, []);

  const fetchParties = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/api/reports/ledger-parties`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setParties(response.data?.parties || []);
    } catch (error) {
      console.error('Error fetching parties:', error);
    }
  };

  const fetchAccounts = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/api/coa/all`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAccounts(response.data || []);
    } catch (error) {
      console.error('Error fetching accounts:', error);
      if (error.response?.status === 401) {
        showToast('Session expired. Please login again.', 'error');
      } else if (error.response?.status === 403) {
        showToast('Access denied. You do not have permission to view accounts.', 'error');
      } else {
        showToast('Failed to load accounts. Please refresh the page.', 'error');
      }
    }
  };

  const handleGenerateReport = async () => {
    // Validation with custom toast messages
    if (!selectedAccount) {
      showToast('Please select an account to generate the ledger report', 'warning');
      return;
    }

    if (!fromDate) {
      showToast('Please select a "From Date" to generate the report', 'warning');
      return;
    }

    if (!toDate) {
      showToast('Please select a "To Date" to generate the report', 'warning');
      return;
    }

    // Date validation
    const fromDateObj = new Date(fromDate);
    const toDateObj = new Date(toDate);
    
    if (fromDateObj > toDateObj) {
      showToast('"From Date" cannot be later than "To Date". Please check your date selection.', 'warning');
      return;
    }

    // Check if date range is too large (more than 5 years)
    const daysDifference = (toDateObj - fromDateObj) / (1000 * 60 * 60 * 24);
    if (daysDifference > 1825) { // 5 years
      showToast('Date range is too large. Please select a period of 5 years or less for better performance.', 'warning');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = { accountId: selectedAccount, fromDate, toDate };
      if (selectedParty) params.partyId = selectedParty;

      const response = await axios.get(
        `${API_BASE_URL}/api/reports/ledger`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params
        }
      );

      setReportData(response.data);
      
      // Show success message with transaction count
      const transactionCount = response.data.transactions?.length || 0;
      if (transactionCount === 0) {
        showToast('Ledger report generated successfully, but no transactions found for the selected period.', 'info');
      } else {
        showToast(`Ledger report generated successfully! Found ${transactionCount} transaction${transactionCount !== 1 ? 's' : ''}.`, 'success');
      }
    } catch (error) {
      console.error('Error generating report:', error);
      
      // Custom error messages based on error type
      if (error.response?.status === 401) {
        showToast('Session expired. Please login again to generate the report.', 'error');
      } else if (error.response?.status === 403) {
        showToast('Access denied. You do not have permission to view ledger reports.', 'error');
      } else if (error.response?.status === 404) {
        showToast('Selected account not found. Please refresh the page and try again.', 'error');
      } else if (error.response?.status === 400) {
        const errorMsg = error.response?.data?.error || 'Invalid request parameters';
        showToast(`Validation Error: ${errorMsg}`, 'error');
      } else if (error.response?.status === 500) {
        showToast('Server error occurred while generating the ledger report. Please try again later.', 'error');
      } else if (error.code === 'NETWORK_ERROR' || !error.response) {
        showToast('Network connection error. Please check your internet connection and try again.', 'error');
      } else {
        showToast('Failed to generate ledger report. Please try again or contact support.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    const pdf = generatePDF();
    if (pdf) {
      pdf.autoPrint();
      window.open(pdf.output('bloburl'), '_blank');
    }
  };

  const handleDownload = () => {
    const pdf = generatePDF();
    if (pdf) {
      const fileName = `Ledger_${reportData.account.account_name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
    }
  };

  const generatePDF = () => {
    if (!reportData) return null;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Company header - top left
    let cursorY = 14;
    if (companyInfo?.company_name) {
      doc.setFontSize(13);
      doc.setFont(undefined, 'bold');
      doc.text(companyInfo.company_name, 14, cursorY);
      cursorY += 6;
      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      const line2 = [companyInfo.address_line1, companyInfo.city].filter(Boolean).join(', ');
      const line3 = [companyInfo.address_line2, companyInfo.state].filter(Boolean).join(', ');
      if (line2) { doc.text(line2, 14, cursorY); cursorY += 5; }
      if (line3) { doc.text(line3, 14, cursorY); cursorY += 5; }
      cursorY += 2;
    }

    // Report title
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('Ledger Report', pageWidth / 2, cursorY, { align: 'center' });
    cursorY += 8;

    // Separator line
    doc.setDrawColor(59, 130, 246);
    doc.setLineWidth(0.5);
    doc.line(14, cursorY, pageWidth - 14, cursorY);
    cursorY += 6;

    // Add account details
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text(`Account: ${reportData.account.account_name}`, 20, cursorY);
    cursorY += 6;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Code: ${reportData.account.account_code} | Group: ${reportData.account.group_name}`, 20, cursorY);
    cursorY += 6;
    doc.text(`Period: ${new Date(reportData.period.from).toLocaleDateString()} to ${new Date(reportData.period.to).toLocaleDateString()}`, 20, cursorY);
    cursorY += 8;

    // Opening balance
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text(`Opening Balance: ${formatNumberForPDF(reportData.opening_balance.amount)} ${reportData.opening_balance.type}`, 20, cursorY);
    cursorY += 8;

    // Transactions table
    const tableData = reportData.transactions.map(txn => [
      new Date(txn.date).toLocaleDateString(),
      txn.journal_no,
      txn.narration,
      txn.debit ? formatNumberForPDF(txn.debit) : '',
      txn.credit ? formatNumberForPDF(txn.credit) : '',
      `${formatNumberForPDF(txn.balance)} ${txn.balance_type}`
    ]);

    // Add totals row
    tableData.push([
      { content: 'Total', colSpan: 3, styles: { fontStyle: 'bold', halign: 'right' } },
      { content: formatNumberForPDF(reportData.totals.total_debit), styles: { fontStyle: 'bold' } },
      { content: formatNumberForPDF(reportData.totals.total_credit), styles: { fontStyle: 'bold' } },
      { content: `${formatNumberForPDF(reportData.closing_balance.amount)} ${reportData.closing_balance.type}`, styles: { fontStyle: 'bold' } }
    ]);

    autoTable(doc, {
      startY: cursorY,
      head: [['Date', 'Voucher No', 'Narration', 'Debit (Rs.)', 'Credit (Rs.)', 'Balance']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246], fontStyle: 'bold' },
      styles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 25 },
        2: { cellWidth: 60 },
        3: { halign: 'right', cellWidth: 25 },
        4: { halign: 'right', cellWidth: 25 },
        5: { halign: 'right', cellWidth: 30 }
      }
    });

    // Add closing balance
    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text(`Closing Balance: ${formatNumberForPDF(reportData.closing_balance.amount)} ${reportData.closing_balance.type}`, 20, finalY);

    // Add footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(
        `Page ${i} of ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
      doc.text(
        `Generated on ${new Date().toLocaleString()}`,
        pageWidth - 20,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'right' }
      );
    }

    return doc;
  };

  const formatCurrency = (amount) => {
    if (!amount) return '₹0.00';
    const num = parseFloat(amount.toString().replace(/,/g, ''));
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(num);
  };

  const formatNumberForPDF = (amount) => {
    if (!amount) return '0.00';
    const num = parseFloat(amount.toString().replace(/,/g, ''));
    return new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  };

  // Filter accounts based on search term
  const filteredAccounts = accounts.filter(account =>
    account.account_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    account.account_code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Toast Notification */}
      {toast.show && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg text-white font-medium transition-all duration-300 ${
          toast.type === 'success' ? 'bg-green-500' :
          toast.type === 'error' ? 'bg-red-500' :
          toast.type === 'warning' ? 'bg-yellow-500' :
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
            {toast.type === 'warning' && (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            )}
            {toast.type === 'info' && (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <span>{toast.message}</span>
            <button 
              onClick={() => setToast({ show: false, message: '', type: '' })}
              className="ml-2 text-white hover:text-gray-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <FileText className="w-8 h-8 mr-3 text-blue-600" />
                Ledger Report
              </h1>
              <p className="text-gray-600 mt-2">
                View detailed transaction history for any account
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-800 flex items-center">
            <Calendar className="w-5 h-5 mr-2 text-blue-600" />
            Report Filters
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Party Filter (optional - for customer/supplier ledger) */}
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Party (Customer/Supplier) <span className="text-gray-400 font-normal">— optional, auto-selects account</span>
              </label>
              <select
                value={selectedParty}
                onChange={(e) => {
                  const pid = e.target.value;
                  setSelectedParty(pid);
                  if (pid) {
                    const party = parties.find(p => String(p.partyid) === String(pid));
                    if (party?.accountid) setSelectedAccount(String(party.accountid));
                  }
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">-- All Parties (no filter) --</option>
                {parties.filter(p => p.partytype === 1).length > 0 && (
                  <optgroup label="Customers">
                    {parties.filter(p => p.partytype === 1).map(p => (
                      <option key={p.partyid} value={p.partyid}>
                        {p.partyname} ({p.account_name || `Acc #${p.accountid}`})
                      </option>
                    ))}
                  </optgroup>
                )}
                {parties.filter(p => p.partytype === 2).length > 0 && (
                  <optgroup label="Suppliers">
                    {parties.filter(p => p.partytype === 2).map(p => (
                      <option key={p.partyid} value={p.partyid}>
                        {p.partyname} ({p.account_name || `Acc #${p.accountid}`})
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            {/* Account Selection */}
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Account
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search account by name or code..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-2"
                />
              </div>
              <select
                value={selectedAccount}
                onChange={(e) => { setSelectedAccount(e.target.value); setSelectedParty(''); }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                size="5"
              >
                <option value="">-- Select an Account --</option>
                {filteredAccounts.map((account) => (
                  <option key={account.account_id} value={account.account_id}>
                    {account.account_code} - {account.account_name}
                  </option>
                ))}
              </select>
            </div>

            {/* From Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                From Date
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* To Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                To Date
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3 mt-6">
            <button
              onClick={handleGenerateReport}
              disabled={loading}
              className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Generating...
                </>
              ) : (
                <>
                  <FileText className="w-5 h-5 mr-2" />
                  Generate Report
                </>
              )}
            </button>
            
            {reportData && (
              <>
                <button
                  onClick={handlePrint}
                  className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center"
                >
                  <Printer className="w-5 h-5 mr-2" />
                  Print
                </button>
                <button
                  onClick={handleDownload}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center"
                >
                  <Download className="w-5 h-5 mr-2" />
                  Download
                </button>
              </>
            )}
          </div>
        </div>

        {/* Report Display */}
        {reportData && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            {/* Report Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
              {/* Company info - top left */}
              {companyInfo && (
                <div className="text-left text-sm text-blue-100 mb-3">
                  <div className="font-bold text-white text-base">{companyInfo.company_name}</div>
                  {(companyInfo.address_line1 || companyInfo.city) && (
                    <div>{[companyInfo.address_line1, companyInfo.city].filter(Boolean).join(', ')}</div>
                  )}
                  {(companyInfo.address_line2 || companyInfo.state) && (
                    <div>{[companyInfo.address_line2, companyInfo.state].filter(Boolean).join(', ')}</div>
                  )}
                </div>
              )}
              <h2 className="text-2xl font-bold text-center">Ledger Report</h2>
              <div className="mt-4 text-center">
                <p className="text-lg font-semibold">
                  {reportData.account.party_name || reportData.account.account_name}
                </p>
                {reportData.account.party_name && (
                  <p className="text-sm text-blue-100">{reportData.account.account_name}</p>
                )}
                <p className="text-sm text-blue-100">
                  Code: {reportData.account.account_code} | Group: {reportData.account.group_name}
                </p>
                <p className="text-sm text-blue-100 mt-2">
                  Period: {new Date(reportData.period.from).toLocaleDateString()} to {new Date(reportData.period.to).toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Report Content */}
            <div className="p-6">
              {/* Opening Balance */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-700">Opening Balance:</span>
                  <span className="text-lg font-bold text-blue-600">
                    {formatCurrency(reportData.opening_balance.amount)} {reportData.opening_balance.type}
                  </span>
                </div>
              </div>

              {/* Transactions Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Voucher No
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Narration
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Debit (₹)
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Credit (₹)
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Balance
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {reportData.transactions.map((txn, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(txn.date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {txn.journal_no}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {txn.narration}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                          {txn.debit ? formatCurrency(txn.debit) : ''}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                          {txn.credit ? formatCurrency(txn.credit) : ''}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                          {formatCurrency(txn.balance)} {txn.balance_type}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-100">
                    <tr className="font-semibold">
                      <td colSpan="3" className="px-6 py-4 text-right text-sm text-gray-900">
                        Total:
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                        {formatCurrency(reportData.totals.total_debit)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                        {formatCurrency(reportData.totals.total_credit)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                        {formatCurrency(reportData.closing_balance.amount)} {reportData.closing_balance.type}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Closing Balance */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-6">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-700">Closing Balance:</span>
                  <span className="text-lg font-bold text-green-600">
                    {formatCurrency(reportData.closing_balance.amount)} {reportData.closing_balance.type}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LedgerReportPage;
