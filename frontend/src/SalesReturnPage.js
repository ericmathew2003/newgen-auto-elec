import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import SalesReturnForm from "./SalesReturnForm";
import API_BASE_URL from "./config/api";
import { usePermissions } from "./hooks/usePermissions";
import { useAuth } from "./contexts/AuthContext";
import { useNavigate } from "react-router-dom";

// Helper to get auth headers
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return { headers: { Authorization: `Bearer ${token}` } };
};

const n = (v) => (isNaN(Number(v)) ? 0 : Number(v));
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

export default function SalesReturnPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { canCreate, canEdit, canView } = usePermissions();

  const [salesReturns, setSalesReturns] = useState([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [sortField, setSortField] = useState("sales_ret_date");
  const [sortDirection, setSortDirection] = useState("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(20);
  const [editingReturn, setEditingReturn] = useState(null);
  const [saving, setSaving] = useState(false);

  // Check permissions
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login');
      return;
    }
    // For non-admin users, check permissions
    if (!canView('INVENTORY', 'SALES_RETURN')) {
      alert('You do not have permission to view Sales Returns');
      navigate('/dashboard');
    }
  }, [user, authLoading, canView, navigate]);

  useEffect(() => {
    fetchSalesReturns();
  }, [fromDate, toDate]);

  const fetchSalesReturns = async () => {
    try {
      const params = {};
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;

      const selectedFYearID = localStorage.getItem("selectedFYearID");
      if (selectedFYearID) {
        params.fyearId = selectedFYearID;
      }

      const r = await axios.get(`${API_BASE_URL}/api/sales-return`, { params, ...getAuthHeaders() });
      const mapped = (r.data || []).map(x => ({
        sales_ret_id: x.sales_ret_id,
        sales_ret_no: x.sales_ret_no,
        sales_ret_date: x.sales_ret_date,
        partyname: x.partyname ?? '',
        taxable_amount: x.taxable_amount ?? 0,
        cgst_amount: x.cgst_amount ?? 0,
        sgst_amount: x.sgst_amount ?? 0,
        igst_amount: x.igst_amount ?? 0,
        rounded_off: x.rounded_off ?? 0,
        total_amount: x.total_amount ?? 0,
        is_confirmed: !!x.is_confirmed,
        is_posted: !!x.is_posted,
        is_cancelled: !!x.is_cancelled,
      }));
      setSalesReturns(mapped);
    } catch (e) {
      console.error(e);
    }
  };

  const handleNew = () => {
    const selectedFYearID = localStorage.getItem("selectedFYearID");
    if (!selectedFYearID) {
      alert("Please select an accounting period first");
      return;
    }
    setEditingReturn({ sales_ret_id: null });
  };

  const handleEdit = async (sr) => {
    if (!sr.sales_ret_id) return;
    try {
      const r = await axios.get(`${API_BASE_URL}/api/sales-return/${sr.sales_ret_id}`, getAuthHeaders());
      setEditingReturn(r.data);
    } catch (e) {
      console.error(e);
      alert("Failed to load sales return for editing");
    }
  };

  const handleView = async (sr) => {
    if (!sr.sales_ret_id) return;
    try {
      const r = await axios.get(`${API_BASE_URL}/api/sales-return/${sr.sales_ret_id}`, getAuthHeaders());
      setEditingReturn({ ...r.data, viewMode: true });
    } catch (e) {
      console.error(e);
      alert("Failed to load sales return for viewing");
    }
  };

  const handleRowClick = (sr) => {
    if (sr.is_posted) {
      handleView(sr);
    } else if (canEdit('INVENTORY', 'SALES_RETURN')) {
      handleEdit(sr);
    }
  };

  const handleClose = () => {
    setEditingReturn(null);
    fetchSalesReturns();
  };

  // Confirm sales return
  const handleConfirm = async (sr) => {
    if (!sr.sales_ret_id) return;

    try {
      setSaving(true);
      await axios.post(`${API_BASE_URL}/api/sales-return/${sr.sales_ret_id}/confirm`, {}, getAuthHeaders());
      await fetchSalesReturns();
      alert(`Sales Return ${sr.sales_ret_no} confirmed successfully! It is now locked for editing and ready for posting.`);
    } catch (e) {
      console.error(e);
      alert(e.response?.data?.error || 'Failed to confirm sales return');
    } finally {
      setSaving(false);
    }
  };

  // Post sales return
  const handlePost = async (sr) => {
    if (!sr.sales_ret_id) return;
    
    if (!sr.is_confirmed) {
      alert('Sales return must be confirmed before posting');
      return;
    }

    try {
      setSaving(true);
      await axios.post(`${API_BASE_URL}/api/sales-return/${sr.sales_ret_id}/post`, {}, getAuthHeaders());
      await fetchSalesReturns();
      alert(`Sales Return ${sr.sales_ret_no} posted successfully! Stock ledger entries created and inventory updated.`);
    } catch (e) {
      console.error(e);
      alert(e.response?.data?.error || 'Failed to post sales return');
    } finally {
      setSaving(false);
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedReturns = useMemo(() => {
    const sorted = [...salesReturns].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (sortField === 'sales_ret_date') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      } else if (['taxable_amount', 'total_amount'].includes(sortField)) {
        aVal = Number(aVal || 0);
        bVal = Number(bVal || 0);
      } else if (sortField === 'is_confirmed' || sortField === 'is_posted') {
        aVal = a[sortField] ? 1 : 0;
        bVal = b[sortField] ? 1 : 0;
      } else {
        aVal = String(aVal || '').toLowerCase();
        bVal = String(bVal || '').toLowerCase();
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [salesReturns, sortField, sortDirection]);

  const currentRecords = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return sortedReturns.slice(start, start + rowsPerPage);
  }, [sortedReturns, currentPage, rowsPerPage]);

  const totalPages = Math.ceil(sortedReturns.length / rowsPerPage);

  const toggleRow = (id) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const toggleSelectAllOnPage = () => {
    if (allSelectedOnPage) {
      const newSet = new Set(selectedIds);
      currentRecords.forEach(r => newSet.delete(r.sales_ret_id));
      setSelectedIds(newSet);
    } else {
      const newSet = new Set(selectedIds);
      currentRecords.forEach(r => newSet.add(r.sales_ret_id));
      setSelectedIds(newSet);
    }
  };

  const allSelectedOnPage = currentRecords.length > 0 && currentRecords.every(r => selectedIds.has(r.sales_ret_id));
  const anySelectedOnPage = currentRecords.some(r => selectedIds.has(r.sales_ret_id));

  if (editingReturn) {
    return (
      <SalesReturnForm
        initialData={editingReturn}
        onClose={handleClose}
        onDataChanged={fetchSalesReturns}
        viewMode={editingReturn.viewMode}
      />
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Sales Returns</h1>
          <p className="text-sm text-gray-600 mt-1">
            Click on any row to edit (unposted) or view (posted) sales returns. Posted records open in read-only mode.
          </p>
        </div>
        {canCreate('INVENTORY', 'SALES_RETURN') && (
          <button
            onClick={handleNew}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            + New Sales Return
          </button>
        )}
      </div>

      <div className="mb-4 flex gap-4 items-end">
        <div>
          <label className="block text-sm mb-1">From Date</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="border rounded px-2 py-1"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">To Date</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="border rounded px-2 py-1"
          />
        </div>
        <button
          onClick={() => { setFromDate(""); setToDate(""); }}
          className="px-3 py-1 border rounded hover:bg-gray-100"
        >
          Clear
        </button>
      </div>

      <div className="border rounded">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 text-center w-8">
                <input
                  type="checkbox"
                  checked={allSelectedOnPage}
                  ref={el => {
                    if (el) el.indeterminate = !allSelectedOnPage && anySelectedOnPage;
                  }}
                  onChange={toggleSelectAllOnPage}
                  title="Select/Deselect all rows on this page"
                />
              </th>
              <th
                className="p-2 text-left cursor-pointer hover:bg-gray-200 select-none"
                onClick={() => handleSort('sales_ret_no')}
                title="Click to sort"
              >
                <div className="flex items-center justify-between">
                  <span>Return No</span>
                  <span className="ml-1">
                    {sortField === 'sales_ret_no' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                  </span>
                </div>
              </th>
              <th
                className="p-2 text-left cursor-pointer hover:bg-gray-200 select-none"
                onClick={() => handleSort('sales_ret_date')}
                title="Click to sort"
              >
                <div className="flex items-center justify-between">
                  <span>Date</span>
                  <span className="ml-1">
                    {sortField === 'sales_ret_date' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                  </span>
                </div>
              </th>
              <th
                className="p-2 text-left cursor-pointer hover:bg-gray-200 select-none"
                onClick={() => handleSort('partyname')}
                title="Click to sort"
              >
                <div className="flex items-center justify-between">
                  <span>Customer</span>
                  <span className="ml-1">
                    {sortField === 'partyname' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                  </span>
                </div>
              </th>
              <th className="p-2 text-right">Taxable</th>
              <th className="p-2 text-right">CGST</th>
              <th className="p-2 text-right">SGST</th>
              <th className="p-2 text-right">IGST</th>
              <th className="p-2 text-right">Total</th>
              <th
                className="p-2 text-center cursor-pointer hover:bg-gray-200 select-none"
                onClick={() => handleSort('is_confirmed')}
                title="Click to sort"
              >
                <div className="flex items-center justify-center">
                  <span>Confirmed</span>
                  <span className="ml-1">
                    {sortField === 'is_confirmed' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                  </span>
                </div>
              </th>
              <th
                className="p-2 text-center cursor-pointer hover:bg-gray-200 select-none"
                onClick={() => handleSort('is_posted')}
                title="Click to sort"
              >
                <div className="flex items-center justify-center">
                  <span>Posted</span>
                  <span className="ml-1">
                    {sortField === 'is_posted' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                  </span>
                </div>
              </th>
              <th className="p-2 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentRecords.map((sr) => (
              <tr
                key={sr.sales_ret_id}
                className={`border-t hover:bg-blue-50 transition-colors cursor-pointer`}
                onClick={() => handleRowClick(sr)}
                title={
                  sr.is_posted 
                    ? "Click to view this posted sales return (read-only)" 
                    : canEdit('INVENTORY', 'SALES_RETURN')
                      ? "Click to edit this sales return" 
                      : "You don't have permission to edit"
                }
              >
                <td className="p-2 text-center" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(sr.sales_ret_id)}
                    onChange={() => toggleRow(sr.sales_ret_id)}
                  />
                </td>
                <td className="p-2">
                  <div className="flex items-center">
                    {sr.is_posted ? (
                      <svg className="w-4 h-4 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    ) : canEdit('INVENTORY', 'SALES_RETURN') ? (
                      <svg className="w-4 h-4 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    ) : null}
                    {sr.sales_ret_no}
                  </div>
                </td>
                <td className="p-2">{dateToInput(sr.sales_ret_date)}</td>
                <td className="p-2">{sr.partyname}</td>
                <td className="p-2 text-right">{n(sr.taxable_amount).toFixed(2)}</td>
                <td className="p-2 text-right">{n(sr.cgst_amount).toFixed(2)}</td>
                <td className="p-2 text-right">{n(sr.sgst_amount).toFixed(2)}</td>
                <td className="p-2 text-right">{n(sr.igst_amount).toFixed(2)}</td>
                <td className="p-2 text-right">{n(sr.total_amount).toFixed(2)}</td>
                <td className="p-2 text-center">
                  <input type="checkbox" checked={!!sr.is_confirmed} readOnly onClick={(e) => e.stopPropagation()} />
                </td>
                <td className="p-2 text-center">
                  <input type="checkbox" checked={!!sr.is_posted} readOnly onClick={(e) => e.stopPropagation()} />
                </td>
                <td className="p-2 text-center" onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-1 justify-center">
                    {sr.is_posted ? (
                      <button
                        onClick={() => handleView(sr)}
                        className="px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
                        title="View Sales Return (Read-only)"
                      >
                        View
                      </button>
                    ) : canEdit('INVENTORY', 'SALES_RETURN') ? (
                      <button
                        onClick={() => handleEdit(sr)}
                        className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                        title="Edit Sales Return"
                      >
                        Edit
                      </button>
                    ) : null}
                    {!sr.is_confirmed && !sr.is_posted && canEdit('INVENTORY', 'SALES_RETURN') && (
                      <button
                        onClick={() => handleConfirm(sr)}
                        disabled={saving}
                        className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                        title="Confirm"
                      >
                        Confirm
                      </button>
                    )}
                    {sr.is_confirmed && !sr.is_posted && canEdit('INVENTORY', 'SALES_RETURN') && (
                      <button
                        onClick={() => handlePost(sr)}
                        disabled={saving}
                        className="px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                        title="Post"
                      >
                        Post
                      </button>
                    )}
                    {sr.is_posted && (
                      <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded font-medium">
                        Posted
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {currentRecords.length === 0 && (
              <tr><td colSpan={12} className="p-4 text-center text-gray-500">No records</td></tr>
            )}
          </tbody>
        </table>
        <div className="flex items-center justify-between p-2 border-t">
          <div className="text-sm text-gray-600">
            Showing {currentRecords.length} of {sortedReturns.length} records
          </div>
          <div className="flex gap-2">
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              Prev
            </button>
            <span className="px-3 py-1">
              Page {currentPage} of {totalPages || 1}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}