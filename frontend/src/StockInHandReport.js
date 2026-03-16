import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_BASE_URL from './config/api';
import { Package, Download, Filter } from 'lucide-react';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return { headers: { Authorization: `Bearer ${token}` } };
};

const StockInHandReport = () => {
  const [reportType, setReportType] = useState('all-items');
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [includeZeroStock, setIncludeZeroStock] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [companyInfo, setCompanyInfo] = useState(null);

  useEffect(() => {
    fetchGroups();
    const token = localStorage.getItem('token');
    axios.get(`${API_BASE_URL}/api/company`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setCompanyInfo(r.data || {}))
      .catch(() => {});
  }, []);

  const fetchGroups = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/stock-reports/groups`, getAuthHeaders());
      setGroups(response.data);
    } catch (error) {
      showToast('Failed to load groups', 'error');
    }
  };

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'success' });
    }, 3000);
  };

  const handleGenerateReport = async () => {
    setLoading(true);
    try {
      const params = {
        reportType,
        includeZeroStock: includeZeroStock.toString(),
        ...(reportType === 'group-wise' && selectedGroup && { groupId: selectedGroup })
      };

      const response = await axios.get(
        `${API_BASE_URL}/api/stock-reports/stock-in-hand`,
        { ...getAuthHeaders(), params }
      );

      setReportData(response.data);
      showToast('Report generated successfully', 'success');
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to generate report', 'error');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value || 0);
  };

  const formatQuantity = (value) => {
    return new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value || 0);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          
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
          
          .no-print {
            display: none !important;
          }
          
          @page {
            margin: 1cm;
          }
          
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
          
          .bg-gradient-to-r {
            background: #2563eb !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          .bg-gray-50, .bg-gray-100 {
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
                <Package className="w-8 h-8 mr-3 text-blue-600" />
                Stock In Hand Report
              </h1>
              <p className="text-gray-600 mt-2">
                View current stock levels with cost and value
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6 no-print">
          <h2 className="text-xl font-semibold mb-4 text-gray-800 flex items-center">
            <Filter className="w-5 h-5 mr-2 text-blue-600" />
            Report Options
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Report Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Report Type *
              </label>
              <select
                value={reportType}
                onChange={(e) => {
                  setReportType(e.target.value);
                  setSelectedGroup('');
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all-items">All Items</option>
                <option value="group-wise">Group Wise</option>
              </select>
            </div>

            {/* Group Selection (only for group-wise) */}
            {reportType === 'group-wise' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Group (Optional)
                </label>
                <select
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Groups</option>
                  {groups.map(group => (
                    <option key={group.groupid} value={group.groupid}>
                      {group.groupname}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Include Zero Stock Checkbox */}
          <div className="mt-4">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeZeroStock}
                onChange={(e) => setIncludeZeroStock(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">
                Include items with zero stock
              </span>
            </label>
            <p className="text-xs text-gray-500 ml-6 mt-1">
              By default, items with zero stock are excluded from the report
            </p>
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
                  <Package className="w-5 h-5 mr-2" />
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
              <h2 className="text-2xl font-bold text-center">
                Stock In Hand Report
              </h2>
              <div className="mt-2 text-center">
                <p className="text-sm text-blue-100">
                  Report Type: {reportType === 'all-items' ? 'All Items' : 'Group Wise'}
                </p>
                <p className="text-sm text-blue-100">
                  Generated: {new Date(reportData.generatedAt).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Report Content */}
            <div className="p-6">
              {reportData.groups.map((group, groupIndex) => (
                <div key={groupIndex} className="mb-8">
                  {/* Group Header */}
                  <div className="bg-gray-100 px-4 py-2 mb-2 rounded">
                    <h3 className="font-bold text-lg text-gray-800">{group.groupname}</h3>
                  </div>

                  {/* Items Table */}
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Item ID
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Item Name
                          </th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Unit
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Qty
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Cost (₹)
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Value (₹)
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {group.items.map((item, itemIndex) => (
                          <tr key={itemIndex} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {item.item_id}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900">
                              {item.item_name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900">
                              {item.unit || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                              {formatQuantity(item.qty)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                              {formatCurrency(item.cost)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                              {formatCurrency(item.value)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      {/* Group Totals */}
                      <tfoot className="bg-gray-100">
                        <tr className="font-semibold">
                          <td colSpan="3" className="px-6 py-4 text-right text-sm text-gray-900">
                            Group Total:
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                            {formatQuantity(group.totals.qty)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                            -
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                            {formatCurrency(group.totals.value)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              ))}

              {/* Grand Total */}
              <div className="mt-6 bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold text-blue-900">Grand Total:</h3>
                  <div className="text-right">
                    <p className="text-sm text-blue-700">
                      Total Quantity: <span className="font-bold">{formatQuantity(reportData.grandTotal.qty)}</span>
                    </p>
                    <p className="text-xl font-bold text-blue-900">
                      Total Value: ₹{formatCurrency(reportData.grandTotal.value)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StockInHandReport;
