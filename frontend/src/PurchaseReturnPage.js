import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import PurchaseReturnForm from "./PurchaseReturnForm";
import API_BASE_URL from "./config/api";

const n = (v) => (isNaN(Number(v)) ? 0 : Number(v));
const formatNumber = (val) => {
  if (val === null || val === undefined || val === '') return '';
  const str = String(val).replace(/,/g, '');
  const [intPart, decPart] = str.split('.');
  const sign = intPart?.startsWith('-') ? '-' : '';
  const nint = (intPart || '').replace('-', '');
  const withCommas = nint.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return sign + withCommas + (decPart !== undefined ? '.' + decPart : '');
};
const formatCurrency = (v) => {
  if (v === null || v === undefined || v === '') return '-';
  const num = Number(v);
  if (Number.isNaN(num)) return '-';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};
const dateToInput = (val) => {
  if (!val) return "";
  const d = new Date(val);
  if (isNaN(d)) return "";
  const tzOff = d.getTimezoneOffset();
  const local = new Date(d.getTime() - tzOff * 60000);
  return local.toISOString().slice(0, 10);
};

export default function PurchaseReturnPage() {
  // List state
  const [purchaseReturns, setPurchaseReturns] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage] = useState(50);
  const [showForm, setShowForm] = useState(false);
  const [editingReturn, setEditingReturn] = useState(null);
  const [saving, setSaving] = useState(false);

  // Sorting state
  const [sortField, setSortField] = useState('tran_date');
  const [sortDirection, setSortDirection] = useState('desc');

  // Fetch purchase returns
  const fetchPurchaseReturns = async () => {
    try {
      const params = {};
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      
      // Add financial year filter - critical for data isolation
      const selectedFYearID = localStorage.getItem("selectedFYearID");
      if (selectedFYearID) {
        params.fyearId = selectedFYearID;
      }
      
      const r = await axios.get(`${API_BASE_URL}/api/purchase-return`, { params });
      const raw = r.data || [];
      // Map API to UI fields
      const mapped = raw.map(x => ({
        purch_ret_id: x.purch_ret_id,
        purch_ret_no: x.purch_ret_no,
        tran_date: x.tran_date,
        partyname: x.partyname ?? '',
        taxable_total: x.taxable_total ?? 0,
        cgst_amount: x.cgst_amount ?? 0,
        sgst_amount: x.sgst_amount ?? 0,
        igst_amount: x.igst_amount ?? 0,
        rounded_off: x.rounded_off ?? 0,
        total_amount: x.total_amount ?? 0,
        is_posted: !!x.is_posted,
      }));
      setPurchaseReturns(mapped);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => { fetchPurchaseReturns(); }, []);
  useEffect(() => { setCurrentPage(1); }, [searchTerm, fromDate, toDate]);

  const handleNewReturn = () => {
    const selectedFYearID = localStorage.getItem("selectedFYearID");
    if (!selectedFYearID) {
      alert("Please select an accounting period first");
      return;
    }
    setEditingReturn(null);
    setShowForm(true);
  };

  const handleEdit = async (pr) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/purchase-return/${pr.purch_ret_id}`);
      const { header, details } = res.data;

      // Restructure the data to match what PurchaseReturnForm expects
      const structuredData = {
        ...header,
        items: details || [],
        // Ensure both ID fields are available for the form
        purch_ret_id: pr.purch_ret_id,
        pret_id: header.pret_id || pr.purch_ret_id
      };

      setEditingReturn(structuredData);
      setShowForm(true);
    } catch (e) {
      console.error(e);
      alert("Failed to load purchase return for editing");
    }
  };

  const closeForm = (shouldRefresh = false) => {
    setShowForm(false);
    setEditingReturn(null);
    if (shouldRefresh) {
      fetchPurchaseReturns();
    }
  };

  // Sorting function
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Filtered, sorted and paginated data
  const filtered = useMemo(() => {
    const q = (searchTerm || '').toLowerCase();
    let result = (purchaseReturns || []).filter(pr =>
      String(pr.purch_ret_no || '').includes(q) ||
      String(pr.partyname || '').toLowerCase().includes(q)
    );

    // Apply sorting
    result.sort((a, b) => {
      let aVal, bVal;

      switch (sortField) {
        case 'purch_ret_no':
          // Extract numeric part from return number for proper numeric sorting
          aVal = parseInt(String(a.purch_ret_no || '0').replace(/[^0-9]/g, ''), 10) || 0;
          bVal = parseInt(String(b.purch_ret_no || '0').replace(/[^0-9]/g, ''), 10) || 0;
          break;
        case 'tran_date':
          aVal = new Date(a.tran_date || 0);
          bVal = new Date(b.tran_date || 0);
          break;
        case 'partyname':
          aVal = String(a.partyname || '').toLowerCase();
          bVal = String(b.partyname || '').toLowerCase();
          break;
        case 'taxable_total':
          aVal = Number(a.taxable_total || 0);
          bVal = Number(b.taxable_total || 0);
          break;
        case 'cgst_amount':
          aVal = Number(a.cgst_amount || 0);
          bVal = Number(b.cgst_amount || 0);
          break;
        case 'sgst_amount':
          aVal = Number(a.sgst_amount || 0);
          bVal = Number(b.sgst_amount || 0);
          break;
        case 'igst_amount':
          aVal = Number(a.igst_amount || 0);
          bVal = Number(b.igst_amount || 0);
          break;
        case 'total_amount':
          aVal = Number(a.total_amount || 0);
          bVal = Number(b.total_amount || 0);
          break;
        case 'is_posted':
          aVal = a.is_posted ? 1 : 0;
          bVal = b.is_posted ? 1 : 0;
          break;
        default:
          aVal = a[sortField];
          bVal = b[sortField];
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [purchaseReturns, searchTerm, sortField, sortDirection]);

  const totalRecords = filtered.length;
  const totalPages = Math.ceil(totalRecords / recordsPerPage) || 1;
  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = startIndex + recordsPerPage;
  const currentRecords = filtered.slice(startIndex, endIndex);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* List View */}
      {!showForm && (
        <div>
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Purchase Return</h1>
              <p className="text-gray-600 mt-1">View and manage purchase returns</p>
            </div>
          </div>

          {/* Filters and Actions */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
            <div className="flex flex-col md:flex-row md:items-end md:gap-4 lg:gap-6">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by return no or party"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div className="w-full md:w-auto min-w-[160px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div className="w-full md:w-auto min-w-[160px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div className="flex items-center gap-2 mt-4 md:mt-0 md:ml-auto">
                <button onClick={fetchPurchaseReturns} className="px-3 py-2 border rounded">Refresh</button>
                <button onClick={handleNewReturn} className="px-3 py-2 bg-blue-600 text-white rounded">New Purchase Return</button>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="border rounded">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th
                    className="p-2 text-left cursor-pointer hover:bg-gray-200 select-none"
                    onClick={() => handleSort('purch_ret_no')}
                    title="Click to sort by Return Number"
                  >
                    <div className="flex items-center justify-between">
                      <span>Return No</span>
                      <span className="ml-1">
                        {sortField === 'purch_ret_no' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th
                    className="p-2 text-left cursor-pointer hover:bg-gray-200 select-none"
                    onClick={() => handleSort('tran_date')}
                    title="Click to sort by Date"
                  >
                    <div className="flex items-center justify-between">
                      <span>Date</span>
                      <span className="ml-1">
                        {sortField === 'tran_date' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th
                    className="p-2 text-left cursor-pointer hover:bg-gray-200 select-none"
                    onClick={() => handleSort('partyname')}
                    title="Click to sort by Supplier"
                  >
                    <div className="flex items-center justify-between">
                      <span>Supplier</span>
                      <span className="ml-1">
                        {sortField === 'partyname' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th
                    className="p-2 text-right cursor-pointer hover:bg-gray-200 select-none"
                    onClick={() => handleSort('taxable_total')}
                    title="Click to sort by Taxable Amount"
                  >
                    <div className="flex items-center justify-between">
                      <span>Taxable</span>
                      <span className="ml-1">
                        {sortField === 'taxable_total' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th
                    className="p-2 text-right cursor-pointer hover:bg-gray-200 select-none"
                    onClick={() => handleSort('cgst_amount')}
                    title="Click to sort by CGST"
                  >
                    <div className="flex items-center justify-between">
                      <span>CGST</span>
                      <span className="ml-1">
                        {sortField === 'cgst_amount' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th
                    className="p-2 text-right cursor-pointer hover:bg-gray-200 select-none"
                    onClick={() => handleSort('sgst_amount')}
                    title="Click to sort by SGST"
                  >
                    <div className="flex items-center justify-between">
                      <span>SGST</span>
                      <span className="ml-1">
                        {sortField === 'sgst_amount' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th
                    className="p-2 text-right cursor-pointer hover:bg-gray-200 select-none"
                    onClick={() => handleSort('igst_amount')}
                    title="Click to sort by IGST"
                  >
                    <div className="flex items-center justify-between">
                      <span>IGST</span>
                      <span className="ml-1">
                        {sortField === 'igst_amount' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th
                    className="p-2 text-right cursor-pointer hover:bg-gray-200 select-none"
                    onClick={() => handleSort('total_amount')}
                    title="Click to sort by Total Amount"
                  >
                    <div className="flex items-center justify-between">
                      <span>Total</span>
                      <span className="ml-1">
                        {sortField === 'total_amount' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th
                    className="p-2 text-center cursor-pointer hover:bg-gray-200 select-none"
                    onClick={() => handleSort('is_posted')}
                    title="Click to sort by Posted Status"
                  >
                    <div className="flex items-center justify-center">
                      <span>Posted</span>
                      <span className="ml-1">
                        {sortField === 'is_posted' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {currentRecords.map((pr) => (
                  <tr
                    key={pr.purch_ret_id}
                    className="border-t hover:bg-blue-50 cursor-pointer"
                    onClick={() => handleEdit(pr)}
                    title="Click to edit"
                  >
                    <td className="p-2">{pr.purch_ret_no}</td>
                    <td className="p-2">{dateToInput(pr.tran_date)}</td>
                    <td className="p-2">{pr.partyname}</td>
                    <td className="p-2 text-right">{n(pr.taxable_total).toFixed(2)}</td>
                    <td className="p-2 text-right">{n(pr.cgst_amount).toFixed(2)}</td>
                    <td className="p-2 text-right">{n(pr.sgst_amount).toFixed(2)}</td>
                    <td className="p-2 text-right">{n(pr.igst_amount).toFixed(2)}</td>
                    <td className="p-2 text-right">{n(pr.total_amount).toFixed(2)}</td>
                    <td className="p-2 text-center">
                      <input type="checkbox" checked={!!pr.is_posted} readOnly onClick={(e) => e.stopPropagation()} />
                    </td>
                  </tr>
                ))}
                <tr className="border-t bg-gray-50 font-semibold">
                  <td className="p-2 text-right" colSpan={3}>Totals</td>
                  <td className="p-2 text-right">{currentRecords.reduce((a, x) => a + n(x.taxable_total || 0), 0).toFixed(2)}</td>
                  <td className="p-2 text-right">{currentRecords.reduce((a, x) => a + n(x.cgst_amount || 0), 0).toFixed(2)}</td>
                  <td className="p-2 text-right">{currentRecords.reduce((a, x) => a + n(x.sgst_amount || 0), 0).toFixed(2)}</td>
                  <td className="p-2 text-right">{currentRecords.reduce((a, x) => a + n(x.igst_amount || 0), 0).toFixed(2)}</td>
                  <td className="p-2 text-right">{currentRecords.reduce((a, x) => a + n(x.total_amount || 0), 0).toFixed(2)}</td>
                  <td className="p-2"></td>
                </tr>
                {currentRecords.length === 0 && (
                  <tr><td colSpan={9} className="p-4 text-center text-gray-500">No records</td></tr>
                )}
              </tbody>
            </table>
            <div className="flex items-center justify-between p-2">
              <button disabled={currentPage <= 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className="px-3 py-1 border rounded">Prev</button>
              <div>Page {currentPage} / {totalPages}</div>
              <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} className="px-3 py-1 border rounded">Next</button>
            </div>
          </div>
        </div>
      )}

      {/* Form View */}
      {showForm && (
        <PurchaseReturnForm
          onClose={closeForm}
          onSaved={() => closeForm(true)}
          onDataChanged={fetchPurchaseReturns}
          initialData={editingReturn}
          allReturns={purchaseReturns}
          onNavigate={handleEdit}
        />
      )}
    </div>
  );
}