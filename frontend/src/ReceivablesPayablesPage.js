import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import API_BASE_URL from './config/api';
import { FileText, Calendar, Download, Users, TrendingUp, Clock } from 'lucide-react';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return { headers: { Authorization: `Bearer ${token}` } };
};

const ReceivablesPayablesPage = () => {
  const [reportType, setReportType] = useState('customer-ledger');
  const [parties, setParties] = useState([]);
  const [filteredParties, setFilteredParties] = useState([]);
  const [selectedParty, setSelectedParty] = useState('');
  const [partySearchTerm, setPartySearchTerm] = useState('');
  const [showPartyDropdown, setShowPartyDropdown] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  
  const partyDropdownRef = useRef(null);

  const reportTypes = [
    { id: 'customer-ledger', name: 'Customer Ledger', icon: Users, partyType: 1 },
    { id: 'customer-aging', name: 'Customer Aging', icon: Clock, partyType: 1 },
    { id: 'supplier-ledger', name: 'Supplier Ledger', icon: Users, partyType: 2 },
    { id: 'supplier-aging', name: 'Supplier Aging', icon: TrendingUp, partyType: 2 }
  ];

  const currentReportConfig = reportTypes.find(r => r.id === reportType);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (partyDropdownRef.current && !partyDropdownRef.current.contains(event.target)) {
        setShowPartyDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (currentReportConfig) {
      fetchParties(currentReportConfig.partyType);
    }
  }, [reportType]);

  useEffect(() => {
    // Filter parties based on search term
    if (partySearchTerm.trim() === '') {
      setFilteredParties(parties);
    } else {
      const filtered = parties.filter(p =>
        p.partyname.toLowerCase().includes(partySearchTerm.toLowerCase())
      );
      setFilteredParties(filtered);
    }
  }, [partySearchTerm, parties]);

  const fetchParties = async (partyType) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/party/all`, getAuthHeaders());
      const filtered = response.data.filter(p => parseInt(p.partytype) === partyType);
      const sorted = filtered.sort((a, b) => (a.partyname || '').localeCompare(b.partyname || ''));
      setParties(sorted);
      setFilteredParties(sorted);
      setSelectedParty('');
      setPartySearchTerm('');
      setReportData(null);
    } catch (error) {
      console.error('Error fetching parties:', error);
      showToast('Failed to load parties', 'error');
    }
  };

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'success' });
    }, 3000);
  };

  const handlePartySelect = (party) => {
    setSelectedParty(party.partyid);
    setPartySearchTerm(party.partyname);
    setShowPartyDropdown(false);
  };

  const handlePartySearchChange = (value) => {
    setPartySearchTerm(value);
    setShowPartyDropdown(true);
    if (value.trim() === '') {
      setSelectedParty('');
    }
  };

  const handleGenerateReport = async () => {
    if (!selectedParty) {
      showToast(`Please select a ${currentReportConfig.partyType === 1 ? 'customer' : 'supplier'}`, 'error');
      return;
    }

    if (!fromDate || !toDate) {
      showToast('Please select from and to dates', 'error');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const endpoint = reportType.includes('ledger') 
        ? `${API_BASE_URL}/api/receivables-payables/ledger`
        : `${API_BASE_URL}/api/receivables-payables/aging`;

      const response = await axios.get(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          partyId: selectedParty,
          partyType: currentReportConfig.partyType,
          fromDate,
          toDate
        }
      });

      setReportData(response.data);
      showToast('Report generated successfully!', 'success');
    } catch (error) {
      console.error('Error generating report:', error);
      showToast(error.response?.data?.error || 'Failed to generate report', 'error');
    } finally {
      setLoading(false);
    }
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

  const renderLedgerReport = () => {
    if (!reportData) return null;

    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-900 mb-1">Opening Balance</h4>
            <p className="text-2xl font-bold text-blue-700">
              {formatCurrency(reportData.opening_balance?.amount || 0)}
              <span className="text-sm ml-2">{reportData.opening_balance?.type || ''}</span>
            </p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-green-900 mb-1">Total Transactions</h4>
            <p className="text-2xl font-bold text-green-700">
              {reportData.transactions?.length || 0}
            </p>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-purple-900 mb-1">Closing Balance</h4>
            <p className="text-2xl font-bold text-purple-700">
              {formatCurrency(reportData.closing_balance?.amount || 0)}
              <span className="text-sm ml-2">{reportData.closing_balance?.type || ''}</span>
            </p>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Document
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
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
                {reportData.transactions?.map((txn, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(txn.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {txn.document_no}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {txn.description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {formatCurrency(txn.debit)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {formatCurrency(txn.credit)}
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
                    {formatCurrency(reportData.totals?.total_debit || 0)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {formatCurrency(reportData.totals?.total_credit || 0)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {formatCurrency(reportData.closing_balance?.amount || 0)} {reportData.closing_balance?.type || ''}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderAgingReport = () => {
    if (!reportData) return null;

    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-900 mb-1">Total Outstanding</h4>
            <p className="text-2xl font-bold text-blue-700">
              {formatCurrency(reportData.total_outstanding || 0)}
            </p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-green-900 mb-1">Current (0-30 days)</h4>
            <p className="text-2xl font-bold text-green-700">
              {formatCurrency(reportData.aging_buckets?.current || 0)}
            </p>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-yellow-900 mb-1">31-60 days</h4>
            <p className="text-2xl font-bold text-yellow-700">
              {formatCurrency(reportData.aging_buckets?.['31_60'] || 0)}
            </p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-red-900 mb-1">Over 60 days</h4>
            <p className="text-2xl font-bold text-red-700">
              {formatCurrency(reportData.aging_buckets?.over_60 || 0)}
            </p>
          </div>
        </div>

        {/* Aging Details Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Document No
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount (₹)
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Paid (₹)
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Outstanding (₹)
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Days Overdue
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reportData.aging_details?.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {item.document_no}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(item.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {formatCurrency(item.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {formatCurrency(item.paid)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                      {formatCurrency(item.outstanding)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900">
                      {item.days_overdue}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        item.days_overdue <= 30 ? 'bg-green-100 text-green-800' :
                        item.days_overdue <= 60 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {item.days_overdue <= 30 ? 'Current' :
                         item.days_overdue <= 60 ? 'Due' : 'Overdue'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Print Styles */}
      <style>{`
        @media print {
          /* Hide everything except the report */
          body * {
            visibility: hidden;
          }
          
          /* Show only the printable content */
          .printable-report,
          .printable-report * {
            visibility: visible;
          }
          
          .printable-report {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          
          /* Hide non-printable elements */
          .no-print {
            display: none !important;
          }
          
          /* Adjust page margins */
          @page {
            margin: 1cm;
          }
          
          /* Preserve grid layout for summary cards */
          .grid {
            display: grid !important;
          }
          
          .grid-cols-1 {
            grid-template-columns: repeat(1, minmax(0, 1fr)) !important;
          }
          
          /* Ledger report - 3 columns */
          .grid-cols-3,
          .md\\:grid-cols-3 {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          }
          
          /* Aging report - 4 columns */
          .grid-cols-4,
          .md\\:grid-cols-4 {
            grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
          }
          
          .gap-4 {
            gap: 1rem !important;
          }
          
          /* Ensure tables don't break awkwardly */
          table {
            page-break-inside: auto;
          }
          
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          
          thead {
            display: table-header-group;
          }
          
          tfoot {
            display: table-footer-group;
          }
          
          /* Remove shadows and borders for cleaner print */
          .printable-report {
            box-shadow: none !important;
          }
          
          /* Adjust colors for print */
          .bg-gradient-to-r {
            background: #2563eb !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          /* Ensure colored badges and cards print correctly */
          .bg-green-100, .bg-yellow-100, .bg-red-100,
          .bg-blue-50, .bg-green-50, .bg-yellow-50, .bg-red-50,
          .bg-blue-100, .bg-green-200, .bg-yellow-200, .bg-red-200 {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          /* Preserve border colors */
          .border-blue-200, .border-green-200, .border-yellow-200, .border-red-200 {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          /* Preserve text colors */
          .text-blue-900, .text-green-900, .text-yellow-900, .text-red-900,
          .text-blue-700, .text-green-700, .text-yellow-700, .text-red-700 {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>

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

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6 no-print">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <FileText className="w-8 h-8 mr-3 text-blue-600" />
                Receivables & Payables Reports
              </h1>
              <p className="text-gray-600 mt-2">
                View customer and supplier ledgers and aging reports
              </p>
            </div>
          </div>
        </div>

        {/* Report Type Selection */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6 no-print">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Select Report Type</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {reportTypes.map((report) => {
              const Icon = report.icon;
              return (
                <button
                  key={report.id}
                  onClick={() => setReportType(report.id)}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    reportType === report.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                  }`}
                >
                  <Icon className={`w-8 h-8 mx-auto mb-2 ${
                    reportType === report.id ? 'text-blue-600' : 'text-gray-400'
                  }`} />
                  <h3 className="font-semibold text-gray-900 text-center">
                    {report.name}
                  </h3>
                </button>
              );
            })}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6 no-print">
          <h2 className="text-xl font-semibold mb-4 text-gray-800 flex items-center">
            <Calendar className="w-5 h-5 mr-2 text-blue-600" />
            Report Filters
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Party Selection with Search */}
            <div className="relative" ref={partyDropdownRef}>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {currentReportConfig?.partyType === 1 ? 'Select Customer' : 'Select Supplier'} *
              </label>
              <input
                type="text"
                value={partySearchTerm}
                onChange={(e) => handlePartySearchChange(e.target.value)}
                onFocus={() => setShowPartyDropdown(true)}
                placeholder={`Search ${currentReportConfig?.partyType === 1 ? 'customer' : 'supplier'} by name...`}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              
              {/* Dropdown List */}
              {showPartyDropdown && filteredParties.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {filteredParties.map((party) => (
                    <div
                      key={party.partyid}
                      onClick={() => handlePartySelect(party)}
                      className="px-4 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                    >
                      <div className="font-medium text-gray-900">{party.partyname}</div>
                      {party.gstnum && (
                        <div className="text-xs text-gray-500">GST: {party.gstnum}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              {/* No results message */}
              {showPartyDropdown && partySearchTerm && filteredParties.length === 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-4 text-center text-gray-500">
                  No {currentReportConfig?.partyType === 1 ? 'customers' : 'suppliers'} found
                </div>
              )}
            </div>

            {/* From Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                From Date *
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
                To Date *
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
              <button
                onClick={() => window.print()}
                className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center"
              >
                <Download className="w-5 h-5 mr-2" />
                Print
              </button>
            )}
          </div>
        </div>

        {/* Report Display */}
        {reportData && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden printable-report">
            {/* Report Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
              <h2 className="text-2xl font-bold text-center">
                {currentReportConfig?.name}
              </h2>
              <div className="mt-4 text-center">
                <p className="text-lg font-semibold">{reportData.party?.partyname}</p>
                <p className="text-sm text-blue-100">
                  Code: {reportData.party?.partycode} | GST: {reportData.party?.gstnum || 'N/A'}
                </p>
                <p className="text-sm text-blue-100 mt-2">
                  Period: {new Date(fromDate).toLocaleDateString()} to {new Date(toDate).toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Report Content */}
            <div className="p-6">
              {reportType.includes('ledger') ? renderLedgerReport() : renderAgingReport()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReceivablesPayablesPage;
