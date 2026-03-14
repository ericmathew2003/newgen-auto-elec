import React, { useEffect, useState, useCallback, useMemo } from "react";
import axios from "axios";
import API_BASE_URL from "./config/api";

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return { headers: { Authorization: `Bearer ${token}` } };
};

const n = (v) => (isNaN(Number(v)) ? 0 : Number(v));
const dateToInput = (val) => {
  if (!val) return "";
  const d = new Date(val);
  if (isNaN(d)) return "";
  const tzOff = d.getTimezoneOffset();
  const local = new Date(d.getTime() - tzOff * 60000);
  return local.toISOString().slice(0, 10);
};

export default function SalesReturnForm({ initialData, onClose, onDataChanged, viewMode = false }) {
  const [header, setHeader] = useState({
    SalesRetNo: "",
    SalesRetDate: new Date().toISOString().slice(0, 10),
    PartyID: "",
    Reason: "",
    TaxableAmount: 0,
    CGSTAmount: 0,
    SGSTAmount: 0,
    IGSTAmount: 0,
    RoundedOff: 0,
    TotalAmount: 0,
    IsConfirmed: false,
    IsPosted: false,
    IsCancelled: false,
  });

  const [items, setItems] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [soldItems, setSoldItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState({ open: false, type: "", message: "" });
  const [lastSavedState, setLastSavedState] = useState(null);
  const [justSaved, setJustSaved] = useState(false);

  // Item selection modal state
  const [showItemModal, setShowItemModal] = useState(false);
  const [itemSearchTerm, setItemSearchTerm] = useState("");
  const [selectedSoldItem, setSelectedSoldItem] = useState(null);
  const [returnQty, setReturnQty] = useState("");
  const [itemReason, setItemReason] = useState("");

  const effectiveInitialData = initialData?.header || initialData;

  useEffect(() => {
    fetchCustomers();
    if (effectiveInitialData?.sales_ret_id) {
      loadExistingReturn();
    } else {
      fetchNextReturnNumber();
    }
  }, []);

  useEffect(() => {
    if (justSaved) {
      const timer = setTimeout(() => setJustSaved(false), 100);
      return () => clearTimeout(timer);
    }
  }, [justSaved]);

  const fetchCustomers = async () => {
    try {
      const r = await axios.get(`${API_BASE_URL}/api/party/all`, getAuthHeaders());
      const onlyCustomers = (r.data || []).filter(p => parseInt(p.partytype ?? 0, 10) === 1);
      setCustomers(onlyCustomers.sort((a, b) => 
        String(a.partyname || '').localeCompare(String(b.partyname || ''), undefined, { sensitivity: 'base' })
      ));
    } catch (e) {
      console.error(e);
    }
  };

  const fetchNextReturnNumber = async () => {
    try {
      const fyearId = localStorage.getItem("selectedFYearID");
      const r = await axios.get(`${API_BASE_URL}/api/sales-return/next-number`, {
        params: { fyear_id: fyearId },
        ...getAuthHeaders()
      });
      setHeader(h => ({ ...h, SalesRetNo: String(r.data.next_no || 1) }));
    } catch (e) {
      console.error(e);
    }
  };

  const loadExistingReturn = async () => {
    try {
      const r = await axios.get(
        `${API_BASE_URL}/api/sales-return/${effectiveInitialData.sales_ret_id}`,
        getAuthHeaders()
      );
      const h = r.data.header;
      const d = r.data.details || [];

      setHeader({
        SalesRetNo: h.sales_ret_no || "",
        SalesRetDate: h.sales_ret_date?.slice(0, 10) || "",
        PartyID: h.party_id || "",
        Reason: h.reason || "",
        TaxableAmount: n(h.taxable_amount),
        CGSTAmount: n(h.cgst_amount),
        SGSTAmount: n(h.sgst_amount),
        IGSTAmount: n(h.igst_amount),
        RoundedOff: n(h.rounded_off),
        TotalAmount: n(h.total_amount),
        IsConfirmed: !!h.is_confirmed,
        IsPosted: !!h.is_posted,
        IsCancelled: !!h.is_cancelled,
      });

      const mappedItems = d.map(it => ({
        sales_inv_master_id: it.sales_inv_master_id,
        sales_inv_detail_id: it.sales_inv_detail_id,
        item_id: it.item_id,
        itemname: it.itemname || "",
        original_invoice_no: it.original_invoice_no || "",
        sold_qty: n(it.sold_qty),
        sold_rate: n(it.sold_rate),
        return_qty: n(it.return_qty),
        return_rate: n(it.return_rate),
        return_amount: n(it.return_amount),
        item_cost: n(it.item_cost || 0),
        cgst_per: n(it.cgst_per),
        sgst_per: n(it.sgst_per),
        igst_per: n(it.igst_per),
        cgst_amount: n(it.cgst_amount),
        sgst_amount: n(it.sgst_amount),
        igst_amount: n(it.igst_amount),
        reason: it.reason || "",
      }));
      setItems(mappedItems);

      // Set initial saved state
      setLastSavedState({
        header: { ...header },
        items: [...mappedItems]
      });

      // Load sold items for this customer
      if (h.party_id) {
        fetchSoldItems(h.party_id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSoldItems = async (partyId) => {
    if (!partyId) return;
    try {
      const r = await axios.get(
        `${API_BASE_URL}/api/sales-return/sold-items/${partyId}`,
        getAuthHeaders()
      );
      setSoldItems(r.data || []);
    } catch (e) {
      console.error(e);
      setNoticeMessage("error", "Failed to load sold items");
    }
  };

  const handleCustomerChange = (partyId) => {
    setHeader(h => ({ ...h, PartyID: partyId }));
    if (partyId) {
      fetchSoldItems(partyId);
    } else {
      setSoldItems([]);
    }
  };

  const handleAddItem = () => {
    if (!selectedSoldItem) {
      setNoticeMessage("warning", "Please select an item");
      return;
    }

    const qty = parseFloat(returnQty);
    if (!qty || qty <= 0) {
      setNoticeMessage("warning", "Please enter a valid return quantity");
      return;
    }

    if (qty > selectedSoldItem.available_return_qty) {
      setNoticeMessage("error", `Cannot return more than ${selectedSoldItem.available_return_qty} units`);
      return;
    }

    // Calculate amounts with proper rounding to avoid floating point precision issues
    const rate = n(selectedSoldItem.sold_rate);
    const taxableAmount = Math.round((qty * rate) * 100) / 100;
    const cgstPer = n(selectedSoldItem.cgst_per);
    const sgstPer = n(selectedSoldItem.sgst_per);
    const igstPer = n(selectedSoldItem.igst_per);
    const cgstAmount = Math.round((taxableAmount * cgstPer / 100) * 100) / 100;
    const sgstAmount = Math.round((taxableAmount * sgstPer / 100) * 100) / 100;
    const igstAmount = Math.round((taxableAmount * igstPer / 100) * 100) / 100;
    const totalAmount = taxableAmount + cgstAmount + sgstAmount + igstAmount;

    const newItem = {
      sales_inv_master_id: selectedSoldItem.sales_inv_master_id,
      sales_inv_detail_id: selectedSoldItem.sales_inv_detail_id,
      item_id: selectedSoldItem.itemcode,
      itemname: selectedSoldItem.itemname || "",
      original_invoice_no: selectedSoldItem.invoice_no || "",
      original_invoice_date: selectedSoldItem.invoice_date || "",
      unit: selectedSoldItem.unit || "",
      sold_qty: n(selectedSoldItem.sold_qty),
      sold_rate: rate,
      return_qty: qty,
      return_rate: rate,
      return_amount: taxableAmount,
      item_cost: n(selectedSoldItem.item_cost || 0),
      cgst_per: cgstPer,
      sgst_per: sgstPer,
      igst_per: igstPer,
      cgst_amount: cgstAmount,
      sgst_amount: sgstAmount,
      igst_amount: igstAmount,
      reason: itemReason,
    };

    setItems([...items, newItem]);
    setNoticeMessage("success", "Item added to return");
    
    // Reset modal state
    setSelectedSoldItem(null);
    setReturnQty("");
    setItemReason("");
    setItemSearchTerm("");
  };

  const handleAddAndContinue = () => {
    handleAddItem();
    // Keep modal open for adding more items
  };

  const handleAddAndClose = () => {
    handleAddItem();
    setShowItemModal(false);
  };

  const openItemModal = () => {
    if (!header.PartyID) {
      setNoticeMessage("warning", "Please select a customer first");
      return;
    }
    if (soldItems.length === 0) {
      setNoticeMessage("warning", "No returnable items found for this customer");
      return;
    }
    setShowItemModal(true);
  };

  const closeItemModal = () => {
    setShowItemModal(false);
    setSelectedSoldItem(null);
    setReturnQty("");
    setItemReason("");
    setItemSearchTerm("");
  };

  // Filter sold items based on search term
  const filteredSoldItems = useMemo(() => {
    if (!itemSearchTerm) return soldItems;
    const term = itemSearchTerm.toLowerCase();
    return soldItems.filter(item => 
      String(item.itemcode || '').toLowerCase().includes(term) ||
      String(item.itemname || '').toLowerCase().includes(term) ||
      String(item.invoice_no || '').toLowerCase().includes(term)
    );
  }, [soldItems, itemSearchTerm]);

  const handleRemoveItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const recalculateTotals = useCallback(() => {
    const taxable = items.reduce((sum, it) => sum + n(it.return_amount), 0);
    const cgst = items.reduce((sum, it) => sum + n(it.cgst_amount), 0);
    const sgst = items.reduce((sum, it) => sum + n(it.sgst_amount), 0);
    const igst = items.reduce((sum, it) => sum + n(it.igst_amount), 0);
    
    // Fix floating point precision issues by rounding to 2 decimal places
    const total = Math.round((taxable + cgst + sgst + igst) * 100) / 100;

    setHeader(h => ({
      ...h,
      TaxableAmount: Math.round(taxable * 100) / 100,
      CGSTAmount: Math.round(cgst * 100) / 100,
      SGSTAmount: Math.round(sgst * 100) / 100,
      IGSTAmount: Math.round(igst * 100) / 100,
      TotalAmount: total,
    }));
  }, [items]);

  useEffect(() => {
    recalculateTotals();
  }, [items, recalculateTotals]);

  const handleSave = async () => {
    if (!header.PartyID) {
      setNoticeMessage("warning", "Please select a customer");
      return;
    }

    if (items.length === 0) {
      setNoticeMessage("warning", "Please add at least one item");
      return;
    }

    try {
      setSaving(true);
      const fyearId = localStorage.getItem("selectedFYearID");

      const payload = {
        header: {
          fyear_id: fyearId,
          sales_ret_no: header.SalesRetNo,
          sales_ret_date: header.SalesRetDate,
          party_id: header.PartyID,
          reason: header.Reason,
          taxable_amount: header.TaxableAmount,
          cgst_amount: header.CGSTAmount,
          sgst_amount: header.SGSTAmount,
          igst_amount: header.IGSTAmount,
          rounded_off: header.RoundedOff,
          total_amount: header.TotalAmount,
          is_confirmed: header.IsConfirmed,
          is_posted: header.IsPosted,
          is_cancelled: header.IsCancelled,
        },
        items: items.map(it => ({
          sales_inv_master_id: it.sales_inv_master_id,
          sales_inv_detail_id: it.sales_inv_detail_id,
          item_id: it.item_id,
          sold_qty: it.sold_qty,
          sold_rate: it.sold_rate,
          return_qty: it.return_qty,
          return_rate: it.return_rate,
          return_amount: it.return_amount,
          item_cost: it.item_cost || 0,
          cgst_per: it.cgst_per,
          sgst_per: it.sgst_per,
          igst_per: it.igst_per,
          cgst_amount: it.cgst_amount,
          sgst_amount: it.sgst_amount,
          igst_amount: it.igst_amount,
          reason: it.reason,
        })),
      };

      if (effectiveInitialData?.sales_ret_id) {
        // Update existing
        await axios.put(
          `${API_BASE_URL}/api/sales-return/${effectiveInitialData.sales_ret_id}`,
          payload.header,
          getAuthHeaders()
        );
        await axios.post(
          `${API_BASE_URL}/api/sales-return/${effectiveInitialData.sales_ret_id}/items/replace`,
          { items: payload.items },
          getAuthHeaders()
        );
      } else {
        // Create new
        const r = await axios.post(
          `${API_BASE_URL}/api/sales-return`,
          payload,
          getAuthHeaders()
        );
        effectiveInitialData.sales_ret_id = r.data.sales_ret_id;
      }

      setNoticeMessage("success", "Sales return saved successfully");
      
      // Update saved state
      setLastSavedState({
        header: { ...header },
        items: [...items]
      });
      setJustSaved(true);

      if (onDataChanged) onDataChanged();
    } catch (e) {
      console.error(e);
      setNoticeMessage("error", e.response?.data?.error || "Failed to save sales return");
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = async () => {
    if (!effectiveInitialData?.sales_ret_id) {
      setNoticeMessage("warning", "Save the sales return before confirming");
      return;
    }

    if (header.IsConfirmed) {
      setNoticeMessage("info", "Sales return is already confirmed");
      return;
    }

    if (header.IsPosted) {
      setNoticeMessage("info", "Sales return is already posted");
      return;
    }

    try {
      setSaving(true);
      await axios.post(
        `${API_BASE_URL}/api/sales-return/${effectiveInitialData.sales_ret_id}/confirm`,
        {},
        getAuthHeaders()
      );
      
      setHeader(prev => ({ ...prev, IsConfirmed: true }));
      setNoticeMessage("success", `Sales Return ${header.SalesRetNo} confirmed successfully! It is now locked for editing and ready for posting.`);
      
      setTimeout(() => {
        setHeader(currentHeader => {
          setItems(currentItems => {
            setLastSavedState({
              header: { ...currentHeader },
              items: [...currentItems]
            });
            setJustSaved(true);
            return currentItems;
          });
          return currentHeader;
        });
      }, 100);
      
      if (onDataChanged) onDataChanged();
    } catch (error) {
      console.error(error);
      setNoticeMessage("error", error?.response?.data?.error || "Failed to confirm sales return");
    } finally {
      setSaving(false);
    }
  };

  const handlePost = async () => {
    if (!effectiveInitialData?.sales_ret_id) {
      setNoticeMessage("warning", "Save the sales return before posting");
      return;
    }

    if (!header.IsConfirmed) {
      setNoticeMessage("warning", "Sales return must be confirmed before posting");
      return;
    }

    if (header.IsPosted) {
      setNoticeMessage("info", "Sales return is already posted");
      return;
    }

    try {
      setSaving(true);
      await axios.post(
        `${API_BASE_URL}/api/sales-return/${effectiveInitialData.sales_ret_id}/post`,
        {},
        getAuthHeaders()
      );
      
      setHeader(prev => ({ ...prev, IsPosted: true }));
      setNoticeMessage("success", `Sales Return ${header.SalesRetNo} posted successfully! Stock ledger entries created and inventory updated.`);
      
      setTimeout(() => {
        setHeader(currentHeader => {
          setItems(currentItems => {
            setLastSavedState({
              header: { ...currentHeader },
              items: [...currentItems]
            });
            setJustSaved(true);
            return currentItems;
          });
          return currentHeader;
        });
      }, 100);
      
      if (onDataChanged) onDataChanged();
    } catch (error) {
      console.error(error);
      setNoticeMessage("error", error?.response?.data?.error || "Failed to post sales return");
    } finally {
      setSaving(false);
    }
  };

  const setNoticeMessage = (type, message) => {
    setNotice({ open: true, type, message });
    setTimeout(() => setNotice({ open: false, type: "", message: "" }), 3000);
  };

  const isReadOnly = header.IsPosted || header.IsConfirmed || viewMode;

  return (
    <div className="p-4">
      {/* Notice Toast */}
      {notice.open && (
        <div className={`fixed top-4 right-4 px-4 py-2 rounded shadow-lg z-50 ${
          notice.type === 'success' ? 'bg-green-500' :
          notice.type === 'error' ? 'bg-red-500' :
          notice.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
        } text-white`}>
          {notice.message}
        </div>
      )}

      {/* Form header controls + status */}
      <div className="flex items-start justify-between mb-4">
        {/* Left: section heading and command buttons */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-semibold text-gray-900">Sales Return</h2>
            {viewMode && (
              <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
                View Mode (Read-Only)
              </span>
            )}
            {header.IsPosted && (
              <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
                Posted
              </span>
            )}
            {header.IsConfirmed && !header.IsPosted && (
              <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-sm font-medium rounded-full">
                Confirmed
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border bg-white text-gray-800 hover:bg-gray-50"
            >
              New
            </button>
            {!isReadOnly && (
              <button
                disabled={saving || !header.PartyID || items.length === 0}
                onClick={handleSave}
                className="px-4 py-2 rounded-lg text-white shadow bg-gradient-to-r from-purple-400 to-purple-600 hover:from-purple-500 hover:to-purple-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            )}
            
            {/* Confirm Button - only show for saved, unconfirmed returns */}
            {effectiveInitialData?.sales_ret_id && !header.IsConfirmed && !header.IsPosted && (
              <button
                disabled={saving}
                onClick={handleConfirm}
                className="px-4 py-2 rounded-lg text-white shadow bg-gradient-to-r from-yellow-400 to-yellow-600 hover:from-yellow-500 hover:to-yellow-700 disabled:opacity-50"
              >
                {saving ? "Confirming..." : "Confirm"}
              </button>
            )}
            
            {/* Post Button - only show for confirmed, unposted returns */}
            {effectiveInitialData?.sales_ret_id && header.IsConfirmed && !header.IsPosted && (
              <button
                disabled={saving}
                onClick={handlePost}
                className="px-4 py-2 rounded-lg text-white shadow bg-gradient-to-r from-green-400 to-green-600 hover:from-green-500 hover:to-green-700 disabled:opacity-50"
              >
                {saving ? "Posting..." : "Post"}
              </button>
            )}
            
            <button
              disabled={!effectiveInitialData?.sales_ret_id}
              className="px-4 py-2 rounded-lg border bg-white text-gray-800 hover:bg-gray-50 disabled:opacity-50"
              title="Print current return"
            >
              Print
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border bg-white text-gray-800 hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>

        {/* Right: Status Pills */}
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold shadow ${
            header.IsPosted ? 'bg-gray-100 text-gray-500' : 
            header.IsConfirmed ? 'bg-gray-100 text-gray-500' : 
            'bg-blue-500 text-white'
          }`}>
            DRAFT
          </span>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold shadow ${
            header.IsPosted ? 'bg-gray-100 text-gray-500' : 
            header.IsConfirmed ? 'bg-yellow-500 text-white' : 
            'bg-gray-100 text-gray-500'
          }`}>
            CONFIRMED
          </span>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold shadow ${
            header.IsPosted ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500'
          }`}>
            POSTED
          </span>
        </div>
      </div>

      {/* Header Section */}
      <div className="border rounded p-4 mb-4 bg-gray-50">
        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Return No</label>
            <input
              type="text"
              value={header.SalesRetNo}
              readOnly
              className="w-full border rounded px-2 py-1 bg-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Return Date</label>
            <input
              type="date"
              value={header.SalesRetDate}
              onChange={(e) => setHeader({ ...header, SalesRetDate: e.target.value })}
              disabled={isReadOnly}
              className="w-full border rounded px-2 py-1"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium mb-1">Customer *</label>
            <select
              value={header.PartyID}
              onChange={(e) => handleCustomerChange(e.target.value)}
              disabled={isReadOnly || items.length > 0}
              className="w-full border rounded px-2 py-1"
            >
              <option value="">Select Customer</option>
              {customers.map(c => (
                <option key={c.partyid} value={c.partyid}>{c.partyname}</option>
              ))}
            </select>
          </div>
          <div className="col-span-4">
            <label className="block text-sm font-medium mb-1">Reason</label>
            <textarea
              value={header.Reason}
              onChange={(e) => setHeader({ ...header, Reason: e.target.value })}
              disabled={isReadOnly}
              className="w-full border rounded px-2 py-1"
              rows={2}
            />
          </div>
        </div>
      </div>

      {/* Add Item Section */}
      {!isReadOnly && header.PartyID && (
        <div className="border rounded p-4 mb-4 bg-blue-50">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Items to Return</h3>
            <button
              onClick={openItemModal}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              + Add Item
            </button>
          </div>
          {soldItems.length === 0 && (
            <p className="text-sm text-gray-600 mt-2">No returnable items found for this customer</p>
          )}
        </div>
      )}

      {/* Item Selection Modal */}
      {showItemModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-[85vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
              <h2 className="text-xl font-bold">Select Item to Return</h2>
              <button
                onClick={closeItemModal}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            {/* Modal Body - Fixed Height */}
            <div className="flex-1 overflow-hidden flex min-h-0">
              {/* Left Side - Item List */}
              <div className="w-2/3 border-r flex flex-col min-h-0">
                {/* Search Bar */}
                <div className="p-4 border-b flex-shrink-0">
                  <input
                    type="text"
                    placeholder="Search by code, name, or invoice number..."
                    value={itemSearchTerm}
                    onChange={(e) => setItemSearchTerm(e.target.value)}
                    className="w-full border rounded px-3 py-2"
                    autoFocus
                  />
                </div>

                {/* Item List */}
                <div className="flex-1 overflow-auto min-h-0">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>
                        <th className="p-2 text-left">Item Code</th>
                        <th className="p-2 text-left">Item Name</th>
                        <th className="p-2 text-left">Invoice No</th>
                        <th className="p-2 text-left">Invoice Date</th>
                        <th className="p-2 text-right">Qty Sold</th>
                        <th className="p-2 text-left">Unit</th>
                        <th className="p-2 text-right">Rate</th>
                        <th className="p-2 text-right">CGST%</th>
                        <th className="p-2 text-right">SGST%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSoldItems.map((item) => (
                        <tr
                          key={item.sales_inv_detail_id}
                          onClick={() => {
                            setSelectedSoldItem(item);
                            setReturnQty("");
                          }}
                          className={`border-t cursor-pointer hover:bg-blue-50 ${
                            selectedSoldItem?.sales_inv_detail_id === item.sales_inv_detail_id
                              ? 'bg-blue-100'
                              : ''
                          }`}
                        >
                          <td className="p-2">{item.itemcode}</td>
                          <td className="p-2">{item.itemname}</td>
                          <td className="p-2">{item.invoice_no}</td>
                          <td className="p-2">{dateToInput(item.invoice_date)}</td>
                          <td className="p-2 text-right">{n(item.sold_qty).toFixed(3)}</td>
                          <td className="p-2">{item.unit}</td>
                          <td className="p-2 text-right">{n(item.sold_rate).toFixed(2)}</td>
                          <td className="p-2 text-right">{n(item.cgst_per).toFixed(2)}</td>
                          <td className="p-2 text-right">{n(item.sgst_per).toFixed(2)}</td>
                        </tr>
                      ))}
                      {filteredSoldItems.length === 0 && (
                        <tr>
                          <td colSpan={9} className="p-4 text-center text-gray-500">
                            No items found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right Side - Selected Item Details */}
              <div className="w-1/3 border-l flex flex-col min-h-0">
                {selectedSoldItem ? (
                  <>
                    <div className="p-4 border-b flex-shrink-0">
                      <h3 className="font-bold text-lg">Selected Item Details</h3>
                    </div>
                    
                    {/* Scrollable Details Section */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Item Code</label>
                        <div className="mt-1 text-sm">{selectedSoldItem.itemcode}</div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">Item Name</label>
                        <div className="mt-1 text-sm">{selectedSoldItem.itemname}</div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Invoice No</label>
                          <div className="mt-1 text-sm">{selectedSoldItem.invoice_no}</div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Invoice Date</label>
                          <div className="mt-1 text-sm">{dateToInput(selectedSoldItem.invoice_date)}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Sold Qty</label>
                          <div className="mt-1 text-sm font-medium">{n(selectedSoldItem.sold_qty).toFixed(3)}</div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Unit</label>
                          <div className="mt-1 text-sm">{selectedSoldItem.unit}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Already Returned</label>
                          <div className="mt-1 text-sm text-red-600 font-medium">
                            {n(selectedSoldItem.already_returned_qty).toFixed(3)}
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Available</label>
                          <div className="mt-1 text-sm text-green-600 font-bold">
                            {n(selectedSoldItem.available_return_qty).toFixed(3)}
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">Rate</label>
                        <div className="mt-1 text-sm font-medium">₹{n(selectedSoldItem.sold_rate).toFixed(2)}</div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">CGST%</label>
                          <div className="mt-1 text-sm">{n(selectedSoldItem.cgst_per).toFixed(2)}%</div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">SGST%</label>
                          <div className="mt-1 text-sm">{n(selectedSoldItem.sgst_per).toFixed(2)}%</div>
                        </div>
                      </div>

                      <div className="border-t pt-3">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Return Quantity *
                        </label>
                        <input
                          type="number"
                          value={returnQty}
                          onChange={(e) => setReturnQty(e.target.value)}
                          step="0.001"
                          min="0"
                          max={selectedSoldItem.available_return_qty}
                          className="w-full border rounded px-3 py-2"
                          placeholder="Enter quantity"
                        />
                      </div>

                      {returnQty && parseFloat(returnQty) > 0 && (
                        <div className="bg-gray-50 p-3 rounded space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Taxable Amount:</span>
                            <span className="font-medium">
                              ₹{(parseFloat(returnQty) * n(selectedSoldItem.sold_rate)).toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>CGST:</span>
                            <span className="font-medium">
                              ₹{((parseFloat(returnQty) * n(selectedSoldItem.sold_rate) * n(selectedSoldItem.cgst_per)) / 100).toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>SGST:</span>
                            <span className="font-medium">
                              ₹{((parseFloat(returnQty) * n(selectedSoldItem.sold_rate) * n(selectedSoldItem.sgst_per)) / 100).toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm font-bold border-t pt-2">
                            <span>Total:</span>
                            <span>
                              ₹{(
                                parseFloat(returnQty) * n(selectedSoldItem.sold_rate) * 
                                (1 + (n(selectedSoldItem.cgst_per) + n(selectedSoldItem.sgst_per)) / 100)
                              ).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Reason (Optional)
                        </label>
                        <textarea
                          value={itemReason}
                          onChange={(e) => setItemReason(e.target.value)}
                          className="w-full border rounded px-3 py-2"
                          rows={2}
                          placeholder="Enter reason for return"
                        />
                      </div>
                    </div>

                    {/* Fixed Action Buttons at Bottom */}
                    <div className="p-4 border-t bg-white space-y-2 flex-shrink-0">
                      <button
                        onClick={handleAddAndContinue}
                        disabled={!returnQty || parseFloat(returnQty) <= 0}
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                      >
                        Add & Continue
                      </button>
                      <button
                        onClick={handleAddAndClose}
                        disabled={!returnQty || parseFloat(returnQty) <= 0}
                        className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                      >
                        Add Item
                      </button>
                      <button
                        onClick={closeItemModal}
                        className="w-full px-4 py-2 border rounded hover:bg-gray-100"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <div className="text-center p-4">
                      <p className="text-lg mb-2">Select an item from the list</p>
                      <p className="text-sm">Click on any item to view details and add to return</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Items Table */}
      <div className="border rounded mb-4">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 text-left">Item Code</th>
              <th className="p-2 text-left">Item Name</th>
              <th className="p-2 text-left">Orig. Invoice</th>
              <th className="p-2 text-left">Invoice Date</th>
              <th className="p-2 text-right">Sold Qty</th>
              <th className="p-2 text-right">Return Qty</th>
              <th className="p-2 text-right">Rate</th>
              <th className="p-2 text-right">Amount</th>
              <th className="p-2 text-right">CGST</th>
              <th className="p-2 text-right">SGST</th>
              <th className="p-2 text-right">Total</th>
              {!isReadOnly && <th className="p-2 text-center">Action</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={idx} className="border-t">
                <td className="p-2">{it.item_id}</td>
                <td className="p-2">{it.itemname}</td>
                <td className="p-2">{it.original_invoice_no}</td>
                <td className="p-2">{dateToInput(it.original_invoice_date)}</td>
                <td className="p-2 text-right">{n(it.sold_qty).toFixed(3)}</td>
                <td className="p-2 text-right">{n(it.return_qty).toFixed(3)}</td>
                <td className="p-2 text-right">{n(it.return_rate).toFixed(2)}</td>
                <td className="p-2 text-right">{n(it.return_amount).toFixed(2)}</td>
                <td className="p-2 text-right">{n(it.cgst_amount).toFixed(2)}</td>
                <td className="p-2 text-right">{n(it.sgst_amount).toFixed(2)}</td>
                <td className="p-2 text-right font-medium">
                  {(n(it.return_amount) + n(it.cgst_amount) + n(it.sgst_amount) + n(it.igst_amount)).toFixed(2)}
                </td>
                {!isReadOnly && (
                  <td className="p-2 text-center">
                    <button
                      onClick={() => handleRemoveItem(idx)}
                      className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      Remove
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={isReadOnly ? 11 : 12} className="p-4 text-center text-gray-500">No items added</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Totals Section */}
      <div className="border rounded p-4 mb-4 bg-gray-50">
        <div className="grid grid-cols-6 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Taxable Amount</label>
            <input
              type="text"
              value={n(header.TaxableAmount).toFixed(2)}
              readOnly
              className="w-full border rounded px-2 py-1 bg-gray-100 text-right"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">CGST</label>
            <input
              type="text"
              value={n(header.CGSTAmount).toFixed(2)}
              readOnly
              className="w-full border rounded px-2 py-1 bg-gray-100 text-right"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">SGST</label>
            <input
              type="text"
              value={n(header.SGSTAmount).toFixed(2)}
              readOnly
              className="w-full border rounded px-2 py-1 bg-gray-100 text-right"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">IGST</label>
            <input
              type="text"
              value={n(header.IGSTAmount).toFixed(2)}
              readOnly
              className="w-full border rounded px-2 py-1 bg-gray-100 text-right"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Rounded Off</label>
            <input
              type="number"
              value={header.RoundedOff}
              onChange={(e) => setHeader({ ...header, RoundedOff: parseFloat(e.target.value) || 0 })}
              disabled={isReadOnly}
              step="0.01"
              className="w-full border rounded px-2 py-1 text-right"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Total Amount</label>
            <input
              type="text"
              value={(n(header.TotalAmount) + n(header.RoundedOff)).toFixed(2)}
              readOnly
              className="w-full border rounded px-2 py-1 bg-yellow-100 text-right font-bold"
            />
          </div>
        </div>
      </div>

    </div>
  );
}