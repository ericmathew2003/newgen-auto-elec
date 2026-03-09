import React, { useState } from 'react';
import { FileText, Calendar, Download, Printer, Eye } from 'lucide-react';
import axios from 'axios';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const FinancialStatementsPage = () => {
  const [selectedReport, setSelectedReport] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '', type: '' });

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

  // Report types with their configurations
  const reports = [
    {
      id: 'trial-balance',
      name: 'Trial Balance',
      description: 'List of all accounts with debit and credit balances',
      icon: '⚖️',
      filters: ['dateRange']
    },
    {
      id: 'trading-account',
      name: 'Trading Account',
      description: 'Shows gross profit or loss from trading activities',
      icon: '📈',
      filters: ['dateRange']
    },
    {
      id: 'profit-loss',
      name: 'Profit & Loss Statement',
      description: 'Shows net profit or loss for the period',
      icon: '💰',
      filters: ['dateRange']
    },
    {
      id: 'balance-sheet',
      name: 'Balance Sheet',
      description: 'Statement of assets, liabilities and equity',
      icon: '📊',
      filters: ['asOnDate']
    },
    {
      id: 'cash-flow',
      name: 'Cash Flow Statement',
      description: 'Shows cash inflows and outflows',
      icon: '💵',
      filters: ['dateRange']
    }
  ];

  const handleGenerateReport = async () => {
    if (!selectedReport) {
      showToast('Please select a report type to generate', 'error');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = {
        fromDate,
        toDate
      };

      const response = await axios.get(
        `${API_BASE_URL}/api/reports/${selectedReport}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params
        }
      );

      setReportData(response.data);
      showToast('Report generated successfully!', 'success');
    } catch (error) {
      console.error('Error generating report:', error);
      
      // Custom error messages based on error type
      if (error.response?.status === 401) {
        showToast('You are not authorized to access this report. Please check your permissions.', 'error');
      } else if (error.response?.status === 403) {
        showToast('Access denied. You do not have permission to view this report.', 'error');
      } else if (error.response?.status === 400) {
        const errorMsg = error.response?.data?.error || 'Invalid request parameters';
        showToast(`Validation Error: ${errorMsg}`, 'error');
      } else if (error.response?.status === 500) {
        showToast('Server error occurred while generating the report. Please try again later.', 'error');
      } else if (error.code === 'NETWORK_ERROR' || !error.response) {
        showToast('Network connection error. Please check your internet connection and try again.', 'error');
      } else {
        showToast('Failed to generate report. Please try again or contact support.', 'error');
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
      const fileName = `${selectedReportConfig?.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
    }
  };

  // Generate PDF for the current report
  const generatePDF = () => {
    if (!reportData) return null;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Add header
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text(reportData.report_name || selectedReportConfig?.name, pageWidth / 2, 20, { align: 'center' });
    
    // Add period/date
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    let dateText = '';
    if (reportData.period?.from && reportData.period?.to) {
      dateText = `Period: ${new Date(reportData.period.from).toLocaleDateString()} to ${new Date(reportData.period.to).toLocaleDateString()}`;
    } else if (reportData.as_on_date) {
      dateText = `As on: ${new Date(reportData.as_on_date).toLocaleDateString()}`;
    }
    doc.text(dateText, pageWidth / 2, 28, { align: 'center' });

    // Generate content based on report type
    switch (selectedReport) {
      case 'trial-balance':
        generateTrialBalancePDF(doc);
        break;
      case 'trading-account':
        generateTradingAccountPDF(doc);
        break;
      case 'profit-loss':
        generateProfitLossPDF(doc);
        break;
      case 'balance-sheet':
        generateBalanceSheetPDF(doc);
        break;
      case 'cash-flow':
        generateCashFlowPDF(doc);
        break;
      default:
        doc.text('Report generation not implemented', 20, 40);
    }

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

  // Generate Trial Balance PDF
  const generateTrialBalancePDF = (doc) => {
    if (!reportData.accounts) return;

    const tableData = reportData.accounts.map(account => [
      account.account_code,
      account.account_name,
      account.group_name,
      formatNumberForPDF(account.debit),
      formatNumberForPDF(account.credit)
    ]);

    // Add totals row
    tableData.push([
      { content: 'Total', colSpan: 3, styles: { fontStyle: 'bold', halign: 'right' } },
      { content: formatNumberForPDF(reportData.totals.total_debit), styles: { fontStyle: 'bold' } },
      { content: formatNumberForPDF(reportData.totals.total_credit), styles: { fontStyle: 'bold' } }
    ]);

    autoTable(doc, {
      startY: 35,
      head: [['Account Code', 'Account Name', 'Group', 'Debit (Rs.)', 'Credit (Rs.)']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246], fontStyle: 'bold' },
      styles: { fontSize: 9 },
      columnStyles: {
        3: { halign: 'right' },
        4: { halign: 'right' }
      }
    });

    // Add difference warning if needed
    if (parseFloat(reportData.totals.difference) > 0.01) {
      const finalY = doc.lastAutoTable.finalY + 10;
      doc.setFontSize(10);
      doc.setTextColor(255, 0, 0);
      doc.text(`Warning: Trial Balance is not balanced. Difference: Rs. ${formatNumberForPDF(reportData.totals.difference)}`, 20, finalY);
    }
  };

  // Generate Trading Account PDF
  const generateTradingAccountPDF = (doc) => {
    if (!reportData.particulars) return;

    const { particulars } = reportData;

    const tableData = [
      ['Opening Stock', formatNumberForPDF(particulars.opening_stock), 'Sales', formatNumberForPDF(particulars.sales)],
      ['Purchases', formatNumberForPDF(particulars.purchases), '', ''],
      ['Less: Closing Stock', `(${formatNumberForPDF(particulars.closing_stock)})`, '', ''],
      [{ content: 'Cost of Goods Sold', styles: { fontStyle: 'bold' } }, 
       { content: formatNumberForPDF(particulars.cost_of_goods_sold), styles: { fontStyle: 'bold' } }, 
       { content: 'Total Sales', styles: { fontStyle: 'bold' } }, 
       { content: formatNumberForPDF(particulars.sales), styles: { fontStyle: 'bold' } }]
    ];

    autoTable(doc, {
      startY: 35,
      head: [['Debit', 'Amount (Rs.)', 'Credit', 'Amount (Rs.)']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246], fontStyle: 'bold' },
      styles: { fontSize: 10 },
      columnStyles: {
        1: { halign: 'right' },
        3: { halign: 'right' }
      }
    });

    // Add Gross Profit
    const finalY = doc.lastAutoTable.finalY + 15;
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    const profitText = parseFloat(particulars.gross_profit) >= 0 ? 'Gross Profit' : 'Gross Loss';
    doc.text(profitText, 20, finalY);
    doc.text(`Rs. ${formatNumberForPDF(Math.abs(parseFloat(particulars.gross_profit)))}`, 190, finalY, { align: 'right' });
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Margin: ${particulars.gross_profit_percentage}`, 20, finalY + 7);
  };

  // Generate Profit & Loss PDF
  const generateProfitLossPDF = (doc) => {
    if (!reportData.revenue || !reportData.expenses) return;

    let startY = 35;

    // Revenue Section
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Revenue & Income', 20, startY);
    
    const revenueData = reportData.revenue.items.map(item => [item.account, formatNumberForPDF(item.amount)]);
    revenueData.push([
      { content: 'Total Revenue', styles: { fontStyle: 'bold' } },
      { content: formatNumberForPDF(reportData.revenue.total), styles: { fontStyle: 'bold' } }
    ]);

    autoTable(doc, {
      startY: startY + 5,
      body: revenueData,
      theme: 'grid',
      styles: { fontSize: 10 },
      columnStyles: {
        1: { halign: 'right' }
      }
    });

    // Expenses Section
    startY = doc.lastAutoTable.finalY + 15;
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Expenses', 20, startY);

    const expenseData = reportData.expenses.items.map(item => [item.account, formatNumberForPDF(item.amount)]);
    expenseData.push([
      { content: 'Total Expenses', styles: { fontStyle: 'bold' } },
      { content: formatNumberForPDF(reportData.expenses.total), styles: { fontStyle: 'bold' } }
    ]);

    autoTable(doc, {
      startY: startY + 5,
      body: expenseData,
      theme: 'grid',
      styles: { fontSize: 10 },
      columnStyles: {
        1: { halign: 'right' }
      }
    });

    // Net Profit/Loss
    startY = doc.lastAutoTable.finalY + 15;
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text(`Net ${reportData.net_profit_type}`, 20, startY);
    doc.text(`Rs. ${formatNumberForPDF(Math.abs(parseFloat(reportData.net_profit)))}`, 190, startY, { align: 'right' });
  };

  // Generate Balance Sheet PDF
  const generateBalanceSheetPDF = (doc) => {
    if (!reportData.assets || !reportData.liabilities) return;

    let startY = 35;

    // Assets
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Assets', 20, startY);

    const assetData = reportData.assets.items.map(item => [
      item.account,
      item.group,
      formatNumberForPDF(item.amount)
    ]);
    assetData.push([
      { content: 'Total Assets', colSpan: 2, styles: { fontStyle: 'bold', halign: 'right' } },
      { content: formatNumberForPDF(reportData.assets.total), styles: { fontStyle: 'bold' } }
    ]);

    autoTable(doc, {
      startY: startY + 5,
      body: assetData,
      theme: 'grid',
      styles: { fontSize: 9 },
      columnStyles: {
        2: { halign: 'right' }
      }
    });

    // Liabilities
    startY = doc.lastAutoTable.finalY + 15;
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Liabilities', 20, startY);

    const liabilityData = reportData.liabilities.items.map(item => [
      item.account,
      item.group,
      formatNumberForPDF(item.amount)
    ]);
    liabilityData.push([
      { content: 'Total Liabilities', colSpan: 2, styles: { fontStyle: 'bold', halign: 'right' } },
      { content: formatNumberForPDF(reportData.liabilities.total), styles: { fontStyle: 'bold' } }
    ]);

    autoTable(doc, {
      startY: startY + 5,
      body: liabilityData,
      theme: 'grid',
      styles: { fontSize: 9 },
      columnStyles: {
        2: { halign: 'right' }
      }
    });

    // Equity (if exists)
    if (reportData.equity && reportData.equity.items.length > 0) {
      startY = doc.lastAutoTable.finalY + 15;
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text('Equity', 20, startY);

      const equityData = reportData.equity.items.map(item => [
        item.account,
        item.group,
        formatNumberForPDF(item.amount)
      ]);
      equityData.push([
        { content: 'Total Equity', colSpan: 2, styles: { fontStyle: 'bold', halign: 'right' } },
        { content: formatNumberForPDF(reportData.equity.total), styles: { fontStyle: 'bold' } }
      ]);

      autoTable(doc, {
        startY: startY + 5,
        body: equityData,
        theme: 'grid',
        styles: { fontSize: 9 },
        columnStyles: {
          2: { halign: 'right' }
        }
      });
    }

    // Balance status
    startY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    const balanceText = reportData.balanced ? '✓ Balance Sheet is balanced' : '⚠ Balance Sheet is not balanced';
    doc.text(balanceText, 20, startY);
  };

  // Generate Cash Flow PDF
  const generateCashFlowPDF = (doc) => {
    if (!reportData.operating_activities) return;

    let startY = 35;

    // Operating Activities
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Operating Activities', 20, startY);

    const operatingData = reportData.operating_activities.items.map(item => [
      item.description,
      formatNumberForPDF(item.amount)
    ]);
    operatingData.push([
      { content: 'Net Cash from Operating', styles: { fontStyle: 'bold' } },
      { content: formatNumberForPDF(reportData.operating_activities.total), styles: { fontStyle: 'bold' } }
    ]);

    autoTable(doc, {
      startY: startY + 5,
      body: operatingData,
      theme: 'grid',
      styles: { fontSize: 10 },
      columnStyles: {
        1: { halign: 'right' }
      }
    });

    // Investing Activities
    if (reportData.investing_activities && reportData.investing_activities.items.length > 0) {
      startY = doc.lastAutoTable.finalY + 15;
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text('Investing Activities', 20, startY);

      const investingData = reportData.investing_activities.items.map(item => [
        item.description,
        formatNumberForPDF(item.amount)
      ]);
      investingData.push([
        { content: 'Net Cash from Investing', styles: { fontStyle: 'bold' } },
        { content: formatNumberForPDF(reportData.investing_activities.total), styles: { fontStyle: 'bold' } }
      ]);

      autoTable(doc, {
        startY: startY + 5,
        body: investingData,
        theme: 'grid',
        styles: { fontSize: 10 },
        columnStyles: {
          1: { halign: 'right' }
        }
      });
    }

    // Financing Activities
    if (reportData.financing_activities && reportData.financing_activities.items.length > 0) {
      startY = doc.lastAutoTable.finalY + 15;
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text('Financing Activities', 20, startY);

      const financingData = reportData.financing_activities.items.map(item => [
        item.description,
        formatNumberForPDF(item.amount)
      ]);
      financingData.push([
        { content: 'Net Cash from Financing', styles: { fontStyle: 'bold' } },
        { content: formatNumberForPDF(reportData.financing_activities.total), styles: { fontStyle: 'bold' } }
      ]);

      autoTable(doc, {
        startY: startY + 5,
        body: financingData,
        theme: 'grid',
        styles: { fontSize: 10 },
        columnStyles: {
          1: { halign: 'right' }
        }
      });
    }

    // Net Cash Flow
    startY = doc.lastAutoTable.finalY + 15;
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Net Cash Flow', 20, startY);
    doc.text(`Rs. ${formatNumberForPDF(reportData.net_cash_flow)}`, 190, startY, { align: 'right' });
  };

  // Format currency for display
  const formatCurrency = (amount) => {
    if (!amount) return '₹0.00';
    const num = parseFloat(amount.toString().replace(/,/g, ''));
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(num);
  };

  // Format number for PDF (without currency symbol, with thousand separator)
  const formatNumberForPDF = (amount) => {
    if (!amount) return '0.00';
    const num = parseFloat(amount.toString().replace(/,/g, ''));
    return new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  };

  // Render Trial Balance
  const renderTrialBalance = () => {
    if (!reportData.accounts) return null;

    return (
      <div className="space-y-6">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Account Code
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Account Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Group
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Debit (₹)
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Credit (₹)
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {reportData.accounts.map((account, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {account.account_code}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {account.account_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {account.group_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {formatCurrency(account.debit)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {formatCurrency(account.credit)}
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
              </tr>
            </tfoot>
          </table>
        </div>
        
        {parseFloat(reportData.totals.difference) > 0.01 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800">
              ⚠️ Trial Balance is not balanced. Difference: {formatCurrency(reportData.totals.difference)}
            </p>
          </div>
        )}
      </div>
    );
  };

  // Render Trading Account
  const renderTradingAccount = () => {
    if (!reportData.particulars) return null;

    const { particulars } = reportData;

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Debit Side */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-gray-800 border-b pb-2">Debit</h3>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span>Opening Stock</span>
                <span className="font-medium">{formatCurrency(particulars.opening_stock)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span>Purchases</span>
                <span className="font-medium">{formatCurrency(particulars.purchases)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span>Less: Closing Stock</span>
                <span className="font-medium text-red-600">({formatCurrency(particulars.closing_stock)})</span>
              </div>
              <div className="flex justify-between py-3 border-t-2 border-gray-300 font-semibold text-lg">
                <span>Cost of Goods Sold</span>
                <span>{formatCurrency(particulars.cost_of_goods_sold)}</span>
              </div>
            </div>
          </div>

          {/* Credit Side */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-gray-800 border-b pb-2">Credit</h3>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span>Sales</span>
                <span className="font-medium">{formatCurrency(particulars.sales)}</span>
              </div>
              <div className="flex justify-between py-3 border-t-2 border-gray-300 font-semibold text-lg">
                <span>Total Sales</span>
                <span>{formatCurrency(particulars.sales)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Gross Profit Summary */}
        <div className={`p-6 rounded-lg ${parseFloat(particulars.gross_profit) >= 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <div className="text-center">
            <h4 className="text-xl font-bold mb-2">
              {parseFloat(particulars.gross_profit) >= 0 ? 'Gross Profit' : 'Gross Loss'}
            </h4>
            <p className={`text-3xl font-bold ${parseFloat(particulars.gross_profit) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(Math.abs(parseFloat(particulars.gross_profit)))}
            </p>
            <p className="text-sm text-gray-600 mt-2">
              Margin: {particulars.gross_profit_percentage}
            </p>
          </div>
        </div>
      </div>
    );
  };

  // Render Profit & Loss
  const renderProfitLoss = () => {
    if (!reportData.revenue || !reportData.expenses) return null;

    return (
      <div className="space-y-8">
        {/* Revenue Section */}
        <div>
          <h3 className="text-lg font-semibold mb-4 text-green-700 border-b border-green-200 pb-2">
            Revenue & Income
          </h3>
          <div className="bg-green-50 rounded-lg p-4">
            {reportData.revenue.items.map((item, index) => (
              <div key={index} className="flex justify-between py-2 border-b border-green-100 last:border-b-0">
                <span>{item.account}</span>
                <span className="font-medium">{formatCurrency(formatNumberForPDF(item.amount))}</span>
              </div>
            ))}
            <div className="flex justify-between py-3 border-t-2 border-green-300 font-semibold text-lg mt-3">
              <span>Total Revenue</span>
              <span className="text-green-600">{formatCurrency(reportData.revenue.total)}</span>
            </div>
          </div>
        </div>

        {/* Expenses Section */}
        <div>
          <h3 className="text-lg font-semibold mb-4 text-red-700 border-b border-red-200 pb-2">
            Expenses
          </h3>
          <div className="bg-red-50 rounded-lg p-4">
            {reportData.expenses.items.map((item, index) => (
              <div key={index} className="flex justify-between py-2 border-b border-red-100 last:border-b-0">
                <span>{item.account}</span>
                <span className="font-medium">{formatCurrency(formatNumberForPDF(item.amount))}</span>
              </div>
            ))}
            <div className="flex justify-between py-3 border-t-2 border-red-300 font-semibold text-lg mt-3">
              <span>Total Expenses</span>
              <span className="text-red-600">{formatCurrency(reportData.expenses.total)}</span>
            </div>
          </div>
        </div>

        {/* Net Profit/Loss */}
        <div className={`p-6 rounded-lg ${reportData.net_profit_type === 'Profit' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <div className="text-center">
            <h4 className="text-2xl font-bold mb-2">
              Net {reportData.net_profit_type}
            </h4>
            <p className={`text-4xl font-bold ${reportData.net_profit_type === 'Profit' ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(Math.abs(parseFloat(reportData.net_profit)))}
            </p>
          </div>
        </div>
      </div>
    );
  };

  // Render Balance Sheet
  const renderBalanceSheet = () => {
    if (!reportData.assets || !reportData.liabilities) return null;

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Assets */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-blue-700 border-b border-blue-200 pb-2">
              Assets
            </h3>
            <div className="bg-blue-50 rounded-lg p-4">
              {reportData.assets.items.map((item, index) => (
                <div key={index} className="flex justify-between py-2 border-b border-blue-100 last:border-b-0">
                  <div>
                    <div className="font-medium">{item.account}</div>
                    <div className="text-sm text-gray-600">{item.group}</div>
                  </div>
                  <span className="font-medium">{formatCurrency(formatNumberForPDF(item.amount))}</span>
                </div>
              ))}
              <div className="flex justify-between py-3 border-t-2 border-blue-300 font-semibold text-lg mt-3">
                <span>Total Assets</span>
                <span className="text-blue-600">{formatCurrency(reportData.assets.total)}</span>
              </div>
            </div>
          </div>

          {/* Liabilities & Equity */}
          <div className="space-y-6">
            {/* Liabilities */}
            <div>
              <h3 className="text-lg font-semibold mb-4 text-red-700 border-b border-red-200 pb-2">
                Liabilities
              </h3>
              <div className="bg-red-50 rounded-lg p-4">
                {reportData.liabilities.items.map((item, index) => (
                  <div key={index} className="flex justify-between py-2 border-b border-red-100 last:border-b-0">
                    <div>
                      <div className="font-medium">{item.account}</div>
                      <div className="text-sm text-gray-600">{item.group}</div>
                    </div>
                    <span className="font-medium">{formatCurrency(formatNumberForPDF(item.amount))}</span>
                  </div>
                ))}
                <div className="flex justify-between py-3 border-t-2 border-red-300 font-semibold text-lg mt-3">
                  <span>Total Liabilities</span>
                  <span className="text-red-600">{formatCurrency(reportData.liabilities.total)}</span>
                </div>
              </div>
            </div>

            {/* Equity */}
            {reportData.equity && reportData.equity.items.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-4 text-purple-700 border-b border-purple-200 pb-2">
                  Equity
                </h3>
                <div className="bg-purple-50 rounded-lg p-4">
                  {reportData.equity.items.map((item, index) => (
                    <div key={index} className="flex justify-between py-2 border-b border-purple-100 last:border-b-0">
                      <div>
                        <div className="font-medium">{item.account}</div>
                        <div className="text-sm text-gray-600">{item.group}</div>
                      </div>
                      <span className="font-medium">{formatCurrency(formatNumberForPDF(item.amount))}</span>
                    </div>
                  ))}
                  <div className="flex justify-between py-3 border-t-2 border-purple-300 font-semibold text-lg mt-3">
                    <span>Total Equity</span>
                    <span className="text-purple-600">{formatCurrency(reportData.equity.total)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Balance Check */}
        <div className={`p-4 rounded-lg ${reportData.balanced ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
          <p className={reportData.balanced ? 'text-green-800' : 'text-yellow-800'}>
            {reportData.balanced ? '✅ Balance Sheet is balanced' : '⚠️ Balance Sheet is not balanced'}
          </p>
        </div>
      </div>
    );
  };

  // Render Cash Flow
  const renderCashFlow = () => {
    if (!reportData.operating_activities) return null;

    return (
      <div className="space-y-6">
        {/* Operating Activities */}
        <div>
          <h3 className="text-lg font-semibold mb-4 text-blue-700 border-b border-blue-200 pb-2">
            Operating Activities
          </h3>
          <div className="bg-blue-50 rounded-lg p-4">
            {reportData.operating_activities.items.map((item, index) => (
              <div key={index} className="flex justify-between py-2 border-b border-blue-100 last:border-b-0">
                <span>{item.description}</span>
                <span className="font-medium">{formatCurrency(formatNumberForPDF(item.amount))}</span>
              </div>
            ))}
            <div className="flex justify-between py-3 border-t-2 border-blue-300 font-semibold text-lg mt-3">
              <span>Net Cash from Operating</span>
              <span className="text-blue-600">{formatCurrency(reportData.operating_activities.total)}</span>
            </div>
          </div>
        </div>

        {/* Investing Activities */}
        {reportData.investing_activities && reportData.investing_activities.items.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-4 text-purple-700 border-b border-purple-200 pb-2">
              Investing Activities
            </h3>
            <div className="bg-purple-50 rounded-lg p-4">
              {reportData.investing_activities.items.map((item, index) => (
                <div key={index} className="flex justify-between py-2 border-b border-purple-100 last:border-b-0">
                  <span>{item.description}</span>
                  <span className="font-medium">{formatCurrency(formatNumberForPDF(item.amount))}</span>
                </div>
              ))}
              <div className="flex justify-between py-3 border-t-2 border-purple-300 font-semibold text-lg mt-3">
                <span>Net Cash from Investing</span>
                <span className="text-purple-600">{formatCurrency(reportData.investing_activities.total)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Financing Activities */}
        {reportData.financing_activities && reportData.financing_activities.items.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-4 text-green-700 border-b border-green-200 pb-2">
              Financing Activities
            </h3>
            <div className="bg-green-50 rounded-lg p-4">
              {reportData.financing_activities.items.map((item, index) => (
                <div key={index} className="flex justify-between py-2 border-b border-green-100 last:border-b-0">
                  <span>{item.description}</span>
                  <span className="font-medium">{formatCurrency(formatNumberForPDF(item.amount))}</span>
                </div>
              ))}
              <div className="flex justify-between py-3 border-t-2 border-green-300 font-semibold text-lg mt-3">
                <span>Net Cash from Financing</span>
                <span className="text-green-600">{formatCurrency(reportData.financing_activities.total)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Net Cash Flow */}
        <div className="bg-gray-100 rounded-lg p-6">
          <div className="flex justify-between items-center">
            <span className="text-xl font-bold">Net Cash Flow</span>
            <span className="text-2xl font-bold text-blue-600">{formatCurrency(reportData.net_cash_flow)}</span>
          </div>
        </div>
      </div>
    );
  };

  // Main render function for report content
  const renderReportContent = () => {
    if (!reportData) return null;

    switch (selectedReport) {
      case 'trial-balance':
        return renderTrialBalance();
      case 'trading-account':
        return renderTradingAccount();
      case 'profit-loss':
        return renderProfitLoss();
      case 'balance-sheet':
        return renderBalanceSheet();
      case 'cash-flow':
        return renderCashFlow();
      default:
        return (
          <div className="text-center text-gray-500">
            Report rendering not implemented for this report type
          </div>
        );
    }
  };

  const selectedReportConfig = reports.find(r => r.id === selectedReport);

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
                Financial Statements
              </h1>
              <p className="text-gray-600 mt-2">
                Generate and view financial reports for your business
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Report Selection */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">
                Select Report Type
              </h2>
              
              <div className="space-y-3">
                {reports.map((report) => (
                  <button
                    key={report.id}
                    onClick={() => setSelectedReport(report.id)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      selectedReport === report.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start">
                      <span className="text-2xl mr-3">{report.icon}</span>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">
                          {report.name}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {report.description}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Panel - Filters and Report */}
          <div className="lg:col-span-2">
            {selectedReport ? (
              <>
                {/* Filters */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                  <h2 className="text-xl font-semibold mb-4 text-gray-800 flex items-center">
                    <Calendar className="w-5 h-5 mr-2 text-blue-600" />
                    Report Filters
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* From Date */}
                    {selectedReportConfig?.filters.includes('dateRange') && (
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
                    )}

                    {/* To Date */}
                    {selectedReportConfig?.filters.includes('dateRange') && (
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
                    )}

                    {/* As On Date (for Balance Sheet) */}
                    {selectedReportConfig?.filters.includes('asOnDate') && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          As On Date
                        </label>
                        <input
                          type="date"
                          value={toDate}
                          onChange={(e) => setToDate(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    )}
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
                          <Eye className="w-5 h-5 mr-2" />
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

                {/* Report Display Area */}
                {reportData && (
                  <div className="bg-white rounded-lg shadow-md overflow-hidden">
                    {/* Report Header */}
                    <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
                      <h2 className="text-2xl font-bold text-center">
                        {reportData.report_name || selectedReportConfig?.name}
                      </h2>
                      <p className="text-center text-blue-100 mt-2">
                        {reportData.period?.from && reportData.period?.to
                          ? `Period: ${new Date(reportData.period.from).toLocaleDateString()} to ${new Date(reportData.period.to).toLocaleDateString()}`
                          : reportData.as_on_date
                          ? `As on: ${new Date(reportData.as_on_date).toLocaleDateString()}`
                          : ''}
                      </p>
                    </div>

                    {/* Report Content */}
                    <div className="p-6">
                      {renderReportContent()}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white rounded-lg shadow-md p-12 text-center">
                <FileText className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <h3 className="text-xl font-semibold text-gray-600 mb-2">
                  No Report Selected
                </h3>
                <p className="text-gray-500">
                  Please select a report type from the left panel to continue
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinancialStatementsPage;


