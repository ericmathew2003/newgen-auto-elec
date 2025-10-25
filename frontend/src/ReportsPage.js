import React, { useState } from "react";
import axios from "axios";
import API_BASE_URL from "./config/api";

const ReportsPage = () => {
  const [showGSTModal, setShowGSTModal] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGSTReportClick = () => {
    setShowGSTModal(true);
  };

  const handleCloseModal = () => {
    setShowGSTModal(false);
    setFromDate("");
    setToDate("");
  };

  const handlePrintReport = async () => {
    if (!fromDate || !toDate) {
      alert("Please select both from and to dates");
      return;
    }

    if (new Date(fromDate) > new Date(toDate)) {
      alert("From date cannot be greater than to date");
      return;
    }

    setLoading(true);
    try {
      console.log("Fetching report data for dates:", { fromDate, toDate });
      
      // Fetch company data and sales data
      console.log("Making API calls...");
      const [compRes, salesRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/company`),
        axios.get(`http://localhost:5000/api/sales/report?fromDate=${fromDate}&toDate=${toDate}`)
      ]);

      console.log("Company response:", compRes.data);
      console.log("Sales response:", salesRes.data);

      const company = compRes.data || {};
      const salesData = salesRes.data || [];

      generateGSTReport(company, salesData, fromDate, toDate);
    } catch (error) {
      console.error("Error generating report:", error);
      let errorMessage = "Failed to generate report. Please try again.";
      
      if (error.response) {
        // Server responded with error status
        console.error("Response status:", error.response.status);
        console.error("Response data:", error.response.data);
        console.error("Full response:", error.response);
        errorMessage = `Server error: ${error.response.status} - ${JSON.stringify(error.response.data)}`;
      } else if (error.request) {
        // Request was made but no response received
        console.error("No response received:", error.request);
        errorMessage = "No response from server. Please check if the server is running.";
      } else {
        // Something else happened
        console.error("Error message:", error.message);
        errorMessage = `Error: ${error.message}`;
      }
      
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const generateGSTReport = (company, salesData, fromDate, toDate) => {
    const safe = (v) => (v == null ? '' : String(v));
    const fmt = (v) => Number(v || 0).toFixed(2);

    // Calculate totals
    const totals = salesData.reduce((acc, item) => {
      acc.qty += Number(item.qty || 0);
      acc.taxableAmount += Number(item.taxable_amount || 0);
      acc.cgstAmount += Number(item.cgst_amount || 0);
      acc.sgstAmount += Number(item.sgst_amount || 0);
      acc.total += Number(item.total_amount || 0);
      return acc;
    }, { qty: 0, taxableAmount: 0, cgstAmount: 0, sgstAmount: 0, total: 0 });

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>GST Invoice Report</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; font-size: 12px; line-height: 1.4; color: #000; }
            .container { max-width: 210mm; margin: 0 auto; padding: 10mm; }
            .header { text-align: left; margin-bottom: 20px; }
            .company-info { margin-bottom: 15px; }
            .title { text-align: center; font-size: 16px; font-weight: bold; margin: 20px 0; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
            th, td { border: 1px solid #000; padding: 4px; text-align: left; font-size: 11px; }
            th { background-color: #f5f5f5; font-weight: bold; text-align: center; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .total-row { background-color: #f0f0f0; font-weight: bold; }
            @media print {
              body { margin: 0; }
              .container { padding: 5mm; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <!-- Company Header -->
            <div class="header">
              <div class="company-info">
                <div style="font-weight: bold; font-size: 14px;">${safe(company.company_name)}</div>
                <div>${safe(company.address_line1)}</div>
                <div>${safe(company.state)}</div>
                <div>GST Number: ${safe(company.gst_number)}</div>
              </div>
            </div>

            <!-- Title -->
            <div class="title">Sales invoices for the period from ${new Date(fromDate).toLocaleDateString()} to ${new Date(toDate).toLocaleDateString()}</div>

            <!-- Report Table -->
            <table>
              <thead>
                <tr>
                  <th style="width: 60px;">Invoice#</th>
                  <th style="width: 80px;">Invoice Date</th>
                  <th style="width: 120px;">Customer name</th>
                  <th style="width: 70px;">HSN Code</th>
                  <th style="width: 200px;">Item Name</th>
                  <th style="width: 40px;">Qty</th>
                  <th style="width: 60px;">Rate</th>
                  <th style="width: 80px;">Taxable Amt</th>
                  <th style="width: 50px;">CGST%</th>
                  <th style="width: 70px;">CGST Amt</th>
                  <th style="width: 50px;">SGST%</th>
                  <th style="width: 70px;">SGST Amt</th>
                  <th style="width: 70px;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${salesData.map((item, index) => `
                  <tr>
                    <td class="text-center">${safe(item.invoice_no)}</td>
                    <td class="text-center">${item.invoice_date ? new Date(item.invoice_date).toLocaleDateString() : ''}</td>
                    <td>${safe(item.customer_name)}</td>
                    <td class="text-center">${safe(item.hsn_code)}</td>
                    <td>${safe(item.item_name)}</td>
                    <td class="text-right">${fmt(item.qty)}</td>
                    <td class="text-right">${fmt(item.rate)}</td>
                    <td class="text-right">${fmt(item.taxable_amount)}</td>
                    <td class="text-center">${fmt(item.cgst_per)}%</td>
                    <td class="text-right">${fmt(item.cgst_amount)}</td>
                    <td class="text-center">${fmt(item.sgst_per)}%</td>
                    <td class="text-right">${fmt(item.sgst_amount)}</td>
                    <td class="text-right">${fmt(item.total_amount)}</td>
                  </tr>
                `).join('')}
                <tr class="total-row">
                  <td colspan="5" class="text-center">Total</td>
                  <td class="text-right">${fmt(totals.qty)}</td>
                  <td></td>
                  <td class="text-right">${fmt(totals.taxableAmount)}</td>
                  <td></td>
                  <td class="text-right">${fmt(totals.cgstAmount)}</td>
                  <td></td>
                  <td class="text-right">${fmt(totals.sgstAmount)}</td>
                  <td class="text-right">${fmt(totals.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <script>
            window.onload = () => { 
              window.print(); 
            };
          </script>
        </body>
      </html>
    `;

    const win = window.open('', '_blank');
    if (!win) {
      alert('Popup blocked. Please allow popups to print.');
      return;
    }

    win.document.write(html);
    win.document.close();
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Reports</h1>
        <p className="text-gray-600">Generate various business reports</p>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* GST Invoice Report Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
             onClick={handleGSTReportClick}>
          <div className="flex items-center mb-4">
            <div className="p-3 bg-blue-100 rounded-lg mr-4">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">GST Invoice Report</h3>
              <p className="text-sm text-gray-600">Sales invoices with GST details</p>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            Click to generate a detailed GST invoice report for a specific date range
          </div>
        </div>

        {/* Placeholder for future reports */}
        <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-6 text-center">
          <div className="text-gray-400 mb-2">
            <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <p className="text-gray-500 text-sm">More reports coming soon</p>
        </div>
      </div>

      {/* GST Report Modal */}
      {showGSTModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">GST Invoice Report</h3>
              <p className="text-sm text-gray-600 mt-1">Select date range for the report</p>
            </div>
            
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  From Date
                </label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  To Date
                </label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Close
              </button>
              <button
                onClick={handlePrintReport}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Generating..." : "Print Report"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsPage;