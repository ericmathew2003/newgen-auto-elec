import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import jsPDF from "jspdf";
import { validateTransactionDate, getDefaultTransactionDate } from "./utils/accountingPeriodUtils";
import API_BASE_URL from "./config/api";

// Helper to format number safely
const n = (v) => (isNaN(Number(v)) ? 0 : Number(v));

// Format number with thousand separators (keeps decimals)
const formatNumber = (val) => {
  if (val === null || val === undefined || val === '') return '';
  const str = String(val).replace(/,/g, '');
  const [intPart, decPart] = str.split('.');
  const sign = intPart?.startsWith('-') ? '-' : '';
  const nint = (intPart || '').replace('-', '');
  const withCommas = nint.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return sign + withCommas + (decPart !== undefined ? '.' + decPart : '');
};

// Parse formatted number string back to numeric
const parseNumber = (val) => {
  if (val === null || val === undefined || val === '') return 0;
  const num = Number(String(val).replace(/,/g, ''));
  return isNaN(num) ? 0 : num;
};

// Format arbitrary date string to YYYY-MM-DD for <input type="date">
const dateToInput = (val) => {
  if (!val) return "";
  const d = new Date(val);
  if (isNaN(d)) return "";
  const tzOff = d.getTimezoneOffset();
  const local = new Date(d.getTime() - tzOff * 60000);
  return local.toISOString().slice(0, 10);
};

export default function PurchasePage() {
  // List state
  const [purchases, setPurchases] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage] = useState(50);
  
  // Sorting state
  const [sortField, setSortField] = useState('trdate');
  const [sortDirection, setSortDirection] = useState('desc');

  // Filters for list endpoint
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [dateError, setDateError] = useState("");

  // Suppliers for filter and form (PartyType = 1)
  const [suppliers, setSuppliers] = useState([]);

  // UI mode
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [grnStatus, setGrnStatus] = useState("draft");
  const [editingPurchase, setEditingPurchase] = useState(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  // Validation and notice state
  const [headerErrors, setHeaderErrors] = useState({});
  const [notice, setNotice] = useState({ open: false, type: 'error', message: '' });

  // Auto-dismiss alert after 3 seconds when open
  useEffect(() => {
    if (!notice.open) return;
    const timer = setTimeout(() => {
      setNotice({ open: false, type: 'error', message: '' });
    }, 3000);
    return () => clearTimeout(timer);
  }, [notice.open]);
  
  // Item selection modal
  const [showItemModal, setShowItemModal] = useState(false);
  const [allItems, setAllItems] = useState([]);
  const [itemSearchTerm, setItemSearchTerm] = useState("");
  const [selectedItemIndex, setSelectedItemIndex] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [highlightIndex, setHighlightIndex] = useState(0); // for keyboard navigation in item list
  const listRef = useRef(null);
  const filteredItems = useMemo(() => {
    const search = (itemSearchTerm || '').trim().toLowerCase();
    const tokens = search.split(/\s+/).filter(Boolean);
    const list = (allItems || []).filter(item => {
      if (tokens.length === 0) return true;
      const name = (item.itemname || '').toLowerCase();
      return tokens.every(t => name.includes(t));
    });
    return list.slice(0, 100);
  }, [allItems, itemSearchTerm]);
  const ensureRowVisible = (idx) => {
    const el = document.getElementById(`item-row-${idx}`);
    if (el) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };
  const handleListKeyDown = (e) => {
    const maxIndex = Math.max(0, filteredItems.length - 1);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = Math.min(highlightIndex + 1, maxIndex);
      setHighlightIndex(next);
      ensureRowVisible(next);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const next = Math.max(highlightIndex - 1, 0);
      setHighlightIndex(next);
      ensureRowVisible(next);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const chosen = filteredItems[highlightIndex] || filteredItems[0];
      if (chosen) selectItemInModal(chosen);
    }
  };
  const qtyInputRef = useRef(null);
  const rateInputRef = useRef(null);
  const saveAddNewRef = useRef(null);
  const searchInputRef = useRef(null);
  useEffect(() => {
    if (showItemModal && selectedItem) {
      setTimeout(() => {
        if (qtyInputRef.current) {
          qtyInputRef.current.focus();
          qtyInputRef.current.select();
        }
      }, 0);
    }
  }, [showItemModal, selectedItem]);
  const [modalItemData, setModalItemData] = useState({
    Qty: 1,
    Rate: 0,
    InvAmount: 0,
    CGSTAmount: 0,
    SGSTAmount: 0,
    IGSTAmount: 0,
    GTotal: 0,
    CGSTPer: 0,
    SGSTPer: 0,
    IGSTPer: 0
  });
  const [companyProfile, setCompanyProfile] = useState({});

  // Costing modal state
  const [showCostingModal, setShowCostingModal] = useState(false);
  const [costingRows, setCostingRows] = useState([
    { OHType: 'Transportation', Amount: 0 },
    { OHType: 'Labour', Amount: 0 },
    { OHType: 'Misc', Amount: 0 },
  ]);
  const [currentTranId, setCurrentTranId] = useState(null);

  // Load saved costing rows when modal opens
  useEffect(() => {
    if (!showCostingModal) return;
    const id = currentTranId || editingPurchase?.tranid;
    if (!id) return;
    (async () => {
      try {
        const res = await axios.get(`http://localhost:5000/api/purchase/${id}/costing`);
        const rows = Array.isArray(res.data) ? res.data : [];
        if (rows.length > 0) {
          setCostingRows(rows.map(r => ({
            OHType: r.ohtype ?? r.OHType ?? '',
            Amount: Number(r.amount ?? r.Amount ?? 0) || 0
          })));
        } else {
          // Default only when nothing exists in DB
          setCostingRows([
            { OHType: 'Transportation', Amount: 0 },
            { OHType: 'Labour', Amount: 0 },
            { OHType: 'Misc', Amount: 0 },
          ]);
        }
      } catch (e) {
        console.error(e);
        setNotice({ open: true, type: 'error', message: 'Failed to load saved costing' });
      }
    })();
  }, [showCostingModal, currentTranId, editingPurchase]);

  const [costingPreview, setCostingPreview] = useState([]); // computed allocation preview
  const [itemTab, setItemTab] = useState('items'); // 'items' | 'costing'
  const [noOverhead, setNoOverhead] = useState(false);

  // Refs and handlers to control tab/enter navigation in Cost Sheet
  const tptAmtRef = useRef(null);
  const labAmtRef = useRef(null);
  const miscAmtRef = useRef(null);
  const saveCostingBtnRef = useRef(null);

  // Find row indexes by overhead type for assigning refs/tab order
  const costingTypeIndex = useMemo(() => {
    const findIndex = (name) => (costingRows || []).findIndex(r => (r.OHType || '').toLowerCase() === name);
    return {
      tpt: findIndex('transportation'),
      lab: findIndex('labour'),
      misc: findIndex('misc'),
    };
  }, [costingRows]);

  const handleCostingAmountKeyDown = (e, current) => {
    const forward = () => {
      if (current === 'tpt') {
        labAmtRef.current?.focus();
      } else if (current === 'lab') {
        miscAmtRef.current?.focus();
      } else if (current === 'misc') {
        saveCostingBtnRef.current?.focus();
      }
    };
    if (e.key === 'Enter') {
      e.preventDefault();
      forward();
    } else if (e.key === 'Tab' && !e.shiftKey) {
      // Force forward tab order across amount fields then Save button
      e.preventDefault();
      forward();
    }
  };

  // Autofocus Transportation amount when Cost Sheet modal opens
  useEffect(() => {
    if (!showCostingModal) return;
    setTimeout(() => {
      tptAmtRef.current?.focus();
      tptAmtRef.current?.select?.();
    }, 0);
  }, [showCostingModal, costingTypeIndex.tpt]);

  // Header form state (use only fields defined in routes)
  const [header, setHeader] = useState({
    FYearID: "",
    TrNo: "",
    TrDate: "",
    SuppInvNo: "",
    SuppInvDt: "",
    PartyID: "",
    Remark: "",
    InvAmt: 0,
    TptCharge: 0,
    LabCharge: 0,
    MiscCharge: 0,
    PackCharge: 0,
    Rounded: 0,
    CGST: 0,
    SGST: 0,
    IGST: 0,
    CostSheetPrepared: false,
    GRNPosted: false,
    Costconfirmed: false,
  });

  // Line items (use only fields defined in routes)
  const [items, setItems] = useState([
    {
      Srno: 1,
      ItemCode: "",
      ItemName: "",
      Unit: "",
      Qty: 0,
      Rate: 0,
      InvAmount: 0,
      OHAmt: 0,
      NetRate: 0,
      Rounded: 0,
      CGSTAmount: 0,
      SGSTAmout: 0, // as per route field spelling
      IGSTAmount: 0,
      GTotal: 0,
      CGSTPer: 0,
      SGSTPer: 0,
      IGSTPer: 0,
      FYearID: "",
    },
  ]);

  // Original snapshots for dirty check (set on edit)
  const [originalHeader, setOriginalHeader] = useState(null);
  const [originalItems, setOriginalItems] = useState(null);

  const trNoRef = useRef(null);

  // Dirty check helpers and state
  const normalizeHeader = (h) => ({
    TrNo: String(h.TrNo || ''),
    TrDate: String(h.TrDate || ''),
    SuppInvNo: String(h.SuppInvNo || ''),
    SuppInvDt: String(h.SuppInvDt || ''),
    PartyID: String(h.PartyID || ''),
    Remark: String(h.Remark || ''),
    InvAmt: n(h.InvAmt),
    TptCharge: n(h.TptCharge),
    LabCharge: n(h.LabCharge),
    MiscCharge: n(h.MiscCharge),
    PackCharge: n(h.PackCharge),
    Rounded: n(h.Rounded),
    CGST: n(h.CGST),
    SGST: n(h.SGST),
    IGST: n(h.IGST),
    CostSheetPrepared: !!h.CostSheetPrepared,
    GRNPosted: !!h.GRNPosted,
    Costconfirmed: !!h.Costconfirmed,
    is_cancelled: !!h.is_cancelled,
  });

  const loadCompanyProfile = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/company`);
      setCompanyProfile(res.data || {});
    } catch (err) {
      console.error(err);
    }
  };
  const normalizeItems = (arr) => (arr || []).map((it) => ({
    ItemCode: String(it.ItemCode || ''),
    Unit: String(it.Unit || ''),
    Qty: n(it.Qty),
    Rate: n(it.Rate),
    InvAmount: n(it.InvAmount),
    OHAmt: n(it.OHAmt),
    NetRate: n(it.NetRate),
    Rounded: n(it.Rounded),
    CGSTAmount: n(it.CGSTAmount),
    SGSTAmout: n(it.SGSTAmout),
    IGSTAmount: n(it.IGSTAmount),
    GTotal: n(it.GTotal),
    CGSTPer: n(it.CGSTPer),
    SGSTPer: n(it.SGSTPer),
    IGSTPer: n(it.IGSTPer),
  }));
  const deepEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const isPosted = grnStatus === 'posted' || !!header.GRNPosted;
  const isCancelled = !!header.is_cancelled;
  const isLocked = isPosted || isCancelled;
  const isDirty = useMemo(() => {
    if (isLocked) return false; // lock when posted or cancelled
    if (!editingPurchase) return true; // in create mode, allow save
    if (!originalHeader || !originalItems) return false; // wait until snapshots set
    return (
      !deepEqual(normalizeHeader(header), normalizeHeader(originalHeader)) ||
      !deepEqual(normalizeItems(items), normalizeItems(originalItems))
    );
  }, [editingPurchase, header, items, originalHeader, originalItems, isPosted]);

  // Fetch suppliers
  const fetchSuppliers = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/party/all`);
      const onlySuppliers = (res.data || []).filter((p) => parseInt(p.partytype ?? 0, 10) === 2);
      const sortedByName = [...onlySuppliers].sort((a, b) => String(a.partyname || '').localeCompare(String(b.partyname || ''), undefined, { sensitivity: 'base' }));
      setSuppliers(sortedByName);
    } catch (e) {
      console.error(e);
    }
  };

  // Generate next TrNo (called only at save time)
  const generateNextTrNo = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/purchase`);
      const purchases = res.data || [];
      const lastTrNo = Math.max(0, ...purchases.map(p => parseInt(p.trno) || 0));
      const nextTrNo = lastTrNo + 1;
      return nextTrNo.toString();
    } catch (e) {
      console.error(e);
      // Fallback to 1 if API fails
      return "1";
    }
  };
  
  // Fetch all items for the modal
  const fetchAllItems = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/items/all`);
      setAllItems(res.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  // Fetch purchases list (server filter by date and financial year)
  const fetchPurchases = async () => {
    try {
      const params = {};
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      
      // Add financial year filtering
      const selectedFYearID = localStorage.getItem("selectedFYearID");
      if (selectedFYearID) {
        params.fyearId = selectedFYearID;
      }
      
      const res = await axios.get(`${API_BASE_URL}/api/purchase`, { params });
      setPurchases(res.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchSuppliers();
    fetchPurchases();
    fetchAllItems();
    loadCompanyProfile();
  }, []);

  // TrNo will be generated only when saving (removed auto-generation to prevent number clashes in multi-user environment)

  // Reset page when search/filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, fromDate, toDate]);

  // Sorting function
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Local search and sorting on result set
  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase();
    let result = purchases.filter((p) => {
      const trno = String(p.trno ?? "");
      const supp = String(p.suppinvno ?? "").toLowerCase();
      const name = String(p.partyname ?? "").toLowerCase();
      return trno.includes(q) || supp.includes(q) || name.includes(q);
    });

    // Apply sorting
    result.sort((a, b) => {
      let aVal, bVal;
      
      switch (sortField) {
        case 'trno':
          // Extract numeric part from transaction number for proper numeric sorting
          aVal = parseInt(String(a.trno || '0').replace(/[^0-9]/g, ''), 10) || 0;
          bVal = parseInt(String(b.trno || '0').replace(/[^0-9]/g, ''), 10) || 0;
          break;
        case 'trdate':
          aVal = new Date(a.trdate || 0);
          bVal = new Date(b.trdate || 0);
          break;
        case 'partyname':
          aVal = String(a.partyname || '').toLowerCase();
          bVal = String(b.partyname || '').toLowerCase();
          break;
        case 'suppinvno':
          aVal = String(a.suppinvno || '').toLowerCase();
          bVal = String(b.suppinvno || '').toLowerCase();
          break;
        case 'suppinvdt':
          aVal = new Date(a.suppinvdt || 0);
          bVal = new Date(b.suppinvdt || 0);
          break;
        case 'invamt':
          aVal = Number(a.invamt || 0);
          bVal = Number(b.invamt || 0);
          break;
        case 'cgst':
          aVal = Number(a.cgst || 0);
          bVal = Number(b.cgst || 0);
          break;
        case 'sgst':
          aVal = Number(a.sgst || 0);
          bVal = Number(b.sgst || 0);
          break;
        case 'igst':
          aVal = Number(a.igst || 0);
          bVal = Number(b.igst || 0);
          break;
        case 'grn_posted':
          aVal = a.grnposted ? 1 : 0;
          bVal = b.grnposted ? 1 : 0;
          break;
        case 'cost_sheet_prepared':
          aVal = a.costsheetprepared ? 1 : 0;
          bVal = b.costsheetprepared ? 1 : 0;
          break;
        case 'is_cancelled':
          aVal = a.is_cancelled ? 1 : 0;
          bVal = b.is_cancelled ? 1 : 0;
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
  }, [purchases, searchTerm, sortField, sortDirection]);

  // Pagination
  const totalRecords = filtered.length;
  const totalPages = Math.ceil(totalRecords / recordsPerPage) || 1;
  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = startIndex + recordsPerPage;
  const currentRecords = filtered.slice(startIndex, endIndex);

  // Selection state for list (by tranid)
  const [selectedIds, setSelectedIds] = useState(new Set());
  const isRowSelected = (id) => selectedIds.has(id);
  const allOnPageSelected = currentRecords.length > 0 && currentRecords.every(r => selectedIds.has(r.tranid));
  const someOnPageSelected = currentRecords.some(r => selectedIds.has(r.tranid)) && !allOnPageSelected;
  const toggleRowSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleSelectAllOnPage = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        currentRecords.forEach(r => next.delete(r.tranid));
      } else {
        currentRecords.forEach(r => next.add(r.tranid));
      }
      return next;
    });
  };
  const headerSelectRef = useRef(null);
  useEffect(() => {
    if (headerSelectRef.current) {
      headerSelectRef.current.indeterminate = someOnPageSelected;
    }
  }, [someOnPageSelected, allOnPageSelected, currentRecords]);

  // Totals for the current page in the summary table
  const pageTotals = useMemo(() => {
    const sum = (selector) => currentRecords.reduce((acc, r) => acc + n(selector(r)), 0);
    const inv = sum((r) => n(r.invamt));
    const cgst = sum((r) => n(r.cgst));
    const sgst = sum((r) => n(r.sgst));
    const igst = sum((r) => n(r.igst));
    const total = inv + cgst + sgst + igst;
    return { inv, cgst, sgst, igst, total };
  }, [currentRecords]);

  // Totals across all filtered records (ignores pagination)
  const grandTotals = useMemo(() => {
    const sum = (selector) => filtered.reduce((acc, r) => acc + n(selector(r)), 0);
    const inv = sum((r) => n(r.invamt));
    const cgst = sum((r) => n(r.cgst));
    const sgst = sum((r) => n(r.sgst));
    const igst = sum((r) => n(r.igst));
    const total = inv + cgst + sgst + igst;
    return { inv, cgst, sgst, igst, total };
  }, [filtered]);

  const goToPreviousPage = () => currentPage > 1 && setCurrentPage(currentPage - 1);
  const goToNextPage = () => currentPage < totalPages && setCurrentPage(currentPage + 1);

  // Record navigation in edit form
  const getCurrentRecordIndex = () => {
    if (!editingPurchase) return -1;
    return filtered.findIndex(purchase => purchase.tranid === editingPurchase.tranid);
  };

  const goToPreviousRecord = () => {
    const currentIndex = getCurrentRecordIndex();
    if (currentIndex > 0) {
      const previousPurchase = filtered[currentIndex - 1];
      editPurchase(previousPurchase);
    }
  };

  const goToNextRecord = () => {
    const currentIndex = getCurrentRecordIndex();
    if (currentIndex < filtered.length - 1) {
      const nextPurchase = filtered[currentIndex + 1];
      editPurchase(nextPurchase);
    }
  };

  // Calculate line and header totals
  const recalcItem = (row) => {
    const qty = n(row.Qty);
    const rate = n(row.Rate);
    const invAmount = qty * rate;
    const cgstAmt = invAmount * n(row.CGSTPer) / 100;
    const sgstAmt = invAmount * n(row.SGSTPer) / 100;
    const igstAmt = invAmount * n(row.IGSTPer) / 100;
    const rounded = n(row.Rounded);
    const ohAmt = n(row.OHAmt);
    const netRate = rate; // keep simple per your routes
    const gtotal = invAmount + cgstAmt + sgstAmt + igstAmt + ohAmt + rounded;

    return {
      ...row,
      InvAmount: Number(invAmount.toFixed(2)),
      CGSTAmount: Number(cgstAmt.toFixed(2)),
      SGSTAmout: Number(sgstAmt.toFixed(2)), // route spelling
      IGSTAmount: Number(igstAmt.toFixed(2)),
      NetRate: Number(netRate.toFixed(2)),
      GTotal: Number(gtotal.toFixed(2)),
    };
  };

  const recalcAll = (rows) => rows.map(recalcItem);

  const applyHeaderTotals = (rows) => {
    const sum = (fn) => rows.reduce((acc, r) => acc + n(fn(r)), 0);
    const InvAmt = sum((r) => r.InvAmount);
    const CGST = sum((r) => r.CGSTAmount);
    const SGST = sum((r) => r.SGSTAmout);
    const IGST = sum((r) => r.IGSTAmount);

    setHeader((h) => ({
      ...h,
      InvAmt: Number(InvAmt.toFixed(2)),
      CGST: Number(CGST.toFixed(2)),
      SGST: Number(SGST.toFixed(2)),
      IGST: Number(IGST.toFixed(2)),
    }));
  };

  // Handlers for line items
  const updateItem = (idx, field, value) => {
    const next = items.map((it, i) =>
      i === idx ? recalcItem({ ...it, [field]: value }) : it
    );
    setItems(next);
    applyHeaderTotals(next);
  };

  // Open item selection modal
  const addRow = async () => {
    // Refresh item data to get updated stock levels
    await fetchAllItems();
    
    // Reuse first blank row if present; otherwise prepare to append
    const emptyIndex = items.findIndex(r => !r.ItemCode && !r.ItemName);
    const targetIndex = emptyIndex >= 0 ? emptyIndex : items.length;
    setSelectedItemIndex(targetIndex);
    setItemSearchTerm("");
    setSelectedItem(null);
    setHighlightIndex(0);
    setModalItemData({
      Qty: 1,
      Rate: 0,
      InvAmount: 0,
      CGSTAmount: 0,
      SGSTAmount: 0,
      IGSTAmount: 0,
      GTotal: 0,
      CGSTPer: 0,
      SGSTPer: 0,
      IGSTPer: 0
    });
    setShowItemModal(true);
  };

  // Select item in modal
  const selectItemInModal = (item) => {
    setSelectedItem(item);
    setModalItemData({
      Qty: 1,
      Unit: item.unit || "",
      Rate: item.cost || 0,
      InvAmount: 0,
      CGSTAmount: 0,
      SGSTAmount: 0,
      IGSTAmount: 0,
      GTotal: 0,
      CGSTPer: item.cgst || 0,
      SGSTPer: item.sgst || 0,
      IGSTPer: item.igst || 0
    });
    calculateModalTotals(item, 1, item.cost || 0, item.cgst || 0, item.sgst || 0, item.igst || 0);
    setTimeout(() => {
      if (qtyInputRef.current) {
        qtyInputRef.current.focus();
        qtyInputRef.current.select();
      }
    }, 0);
  };

  // Calculate totals in modal
  const calculateModalTotals = (item, qty, rate, cgstPer, sgstPer, igstPer) => {
    const quantity = n(qty);
    const itemRate = n(rate);
    const cgstPercent = n(cgstPer);
    const sgstPercent = n(sgstPer);
    const igstPercent = n(igstPer);
    
    const invAmount = quantity * itemRate;
    const cgstAmt = invAmount * cgstPercent / 100;
    const sgstAmt = invAmount * sgstPercent / 100;
    const igstAmt = invAmount * igstPercent / 100;
    const gtotal = invAmount + cgstAmt + sgstAmt + igstAmt;

    setModalItemData(prev => ({
      ...prev,
      Qty: quantity,
      Unit: prev.Unit,
      Rate: itemRate,
      InvAmount: Number(invAmount.toFixed(2)),
      CGSTAmount: Number(cgstAmt.toFixed(2)),
      SGSTAmount: Number(sgstAmt.toFixed(2)),
      IGSTAmount: Number(igstAmt.toFixed(2)),
      GTotal: Number(gtotal.toFixed(2)),
      CGSTPer: cgstPercent,
      SGSTPer: sgstPercent,
      IGSTPer: igstPercent
    }));
  };

  // Add item to form and close modal
  const addItemToForm = () => {
    if (!selectedItem) return;
    
    const payload = {
      ItemCode: selectedItem.itemcode,
      ItemName: selectedItem.itemname || "",
      Unit: selectedItem.unit || "",
      Qty: modalItemData.Qty,
      Rate: modalItemData.Rate,
      InvAmount: modalItemData.InvAmount,
      OHAmt: 0,
      NetRate: modalItemData.Rate,
      Rounded: 0,
      CGSTAmount: modalItemData.CGSTAmount,
      SGSTAmout: modalItemData.SGSTAmount,
      IGSTAmount: modalItemData.IGSTAmount,
      GTotal: modalItemData.GTotal,
      CGSTPer: selectedItem.cgst || 0,
      SGSTPer: selectedItem.sgst || 0,
      IGSTPer: selectedItem.igst || 0,
      FYearID: header.FYearID,
    };

    let next;
    if (selectedItemIndex != null && selectedItemIndex < items.length) {
      // Fill existing blank row
      next = items.map((r, i) => i === selectedItemIndex ? recalcItem({
        ...r,
        ...payload,
        Srno: i + 1,
      }) : r);
    } else {
      // Append new row
      const newItem = recalcItem({
        Srno: items.length + 1,
        ...payload,
      });
      next = [...items, newItem];
    }

    setItems(next);
    applyHeaderTotals(next);
    setShowItemModal(false);
  };

  // Add item and keep modal open for next item
  const addItemAndContinue = () => {
    if (!selectedItem) return;
    
    const newItem = {
      Srno: items.length + 1,
      ItemCode: selectedItem.itemcode,
      ItemName: selectedItem.itemname || "",
      Unit: selectedItem.unit || "",
      Qty: modalItemData.Qty,
      Rate: modalItemData.Rate,
      InvAmount: modalItemData.InvAmount,
      OHAmt: 0,
      NetRate: modalItemData.Rate,
      Rounded: 0,
      CGSTAmount: modalItemData.CGSTAmount,
      SGSTAmout: modalItemData.SGSTAmount,
      IGSTAmount: modalItemData.IGSTAmount,
      GTotal: modalItemData.GTotal,
      CGSTPer: modalItemData.CGSTPer,
      SGSTPer: modalItemData.SGSTPer,
      IGSTPer: modalItemData.IGSTPer,
      FYearID: header.FYearID,
    };
    
    const next = [...items, newItem];
    setItems(next);
    applyHeaderTotals(next);
    
    // Reset for next item
    setSelectedItem(null);
    setModalItemData({
      Qty: 1,
      Rate: 0,
      InvAmount: 0,
      CGSTAmount: 0,
      SGSTAmount: 0,
      IGSTAmount: 0,
      GTotal: 0,
      CGSTPer: 0,
      SGSTPer: 0,
      IGSTPer: 0
    });
    // Move focus back to search box for fast entry
    setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
        searchInputRef.current.select?.();
      }
    }, 0);
  };

  const removeRow = (idx) => {
    const next = items.filter((_, i) => i !== idx).map((r, i) => ({ ...r, Srno: i + 1 }));
    setItems(recalcAll(next));
    applyHeaderTotals(next);
  };

  // Delete purchase
  const handleDeletePurchase = async (purchase) => {
    if (!window.confirm(`Delete purchase TrNo ${purchase.trno}? This cannot be undone.`)) return;
    try {
      await axios.delete(`http://localhost:5000/api/purchase/${purchase.tranid}`);
      setNotice({ open: true, type: 'success', message: 'Purchase deleted' });
      fetchPurchases();
    } catch (err) {
      console.error('Delete failed', err);
      setNotice({ open: true, type: 'error', message: 'Failed to delete purchase' });
    }
  };

  // Edit purchase function
  const editPurchase = async (purchase) => {
    try {
      const res = await axios.get(`http://localhost:5000/api/purchase/${purchase.tranid}`);
      const { header: purchaseHeader, details: purchaseDetails } = res.data;
      
      // Set header data (ensure date inputs get YYYY-MM-DD)
      setHeader({
        FYearID: purchaseHeader.fyearid || "",
        TrNo: purchaseHeader.trno || "",
        TrDate: dateToInput(purchaseHeader.trdate) || "",
        SuppInvNo: purchaseHeader.suppinvno || "",
        SuppInvDt: dateToInput(purchaseHeader.suppinvdt) || "",
        PartyID: purchaseHeader.partyid || "",
        Remark: purchaseHeader.remark || "",
        InvAmt: purchaseHeader.invamt || 0,
        TptCharge: purchaseHeader.tptcharge || 0,
        LabCharge: purchaseHeader.labcharge || 0,
        MiscCharge: purchaseHeader.misccharge || 0,
        PackCharge: purchaseHeader.packcharge || 0,
        Rounded: purchaseHeader.rounded || 0,
        CGST: purchaseHeader.cgst || 0,
        SGST: purchaseHeader.sgst || 0,
        IGST: purchaseHeader.igst || 0,
        CostSheetPrepared: purchaseHeader.costsheetprepared || false,
        GRNPosted: purchaseHeader.grnposted || false,
        Costconfirmed: purchaseHeader.costconfirmed || false,
        is_cancelled: purchaseHeader.is_cancelled || false,
      });

      // Set items data and resolve ItemName from master
      const formattedItems = purchaseDetails.map((detail, index) => {
        const found = (allItems || []).find(it => String(it.itemcode) === String(detail.itemcode));
        return {
          Srno: index + 1,
          ItemCode: detail.itemcode || "",
          ItemName: found?.itemname || "",
          Unit: found?.unit || detail.unit || "",
          Qty: detail.qty || 0,
          Rate: detail.rate || 0,
          InvAmount: detail.invamount || 0,
          OHAmt: (detail.ohamt ?? detail.oamt ?? 0),
          NetRate: detail.netrate || 0,
          Rounded: detail.rounded || 0,
          CGSTAmount: detail.cgst || 0,
          SGSTAmout: detail.sgst || 0,
          IGSTAmount: detail.igst || 0,
          GTotal: detail.gtotal || 0,
          CGSTPer: detail.cgstp || 0,
          SGSTPer: detail.sgstp || 0,
          IGSTPer: detail.igstp || 0,
          FYearID: detail.fyearid || "",
        };
      });

      setItems(formattedItems);
      // Set original snapshots for dirty check
      setOriginalHeader({
        FYearID: purchaseHeader.fyearid || "",
        TrNo: purchaseHeader.trno || "",
        TrDate: dateToInput(purchaseHeader.trdate) || "",
        SuppInvNo: purchaseHeader.suppinvno || "",
        SuppInvDt: dateToInput(purchaseHeader.suppinvdt) || "",
        PartyID: purchaseHeader.partyid || "",
        Remark: purchaseHeader.remark || "",
        InvAmt: purchaseHeader.invamt || 0,
        TptCharge: purchaseHeader.tptcharge || 0,
        LabCharge: purchaseHeader.labcharge || 0,
        MiscCharge: purchaseHeader.misccharge || 0,
        PackCharge: purchaseHeader.packcharge || 0,
        Rounded: purchaseHeader.rounded || 0,
        CGST: purchaseHeader.cgst || 0,
        SGST: purchaseHeader.sgst || 0,
        IGST: purchaseHeader.igst || 0,
        CostSheetPrepared: purchaseHeader.costsheetprepared || false,
        GRNPosted: purchaseHeader.grnposted || false,
        Costconfirmed: purchaseHeader.costconfirmed || false,
      });
      setOriginalItems(formattedItems.map(it => ({ ...it })));

      setEditingPurchase(purchase);
      setGrnStatus(purchaseHeader.grnposted ? "posted" : "draft");
      setCurrentTranId(purchase.tranid);
      setShowForm(true);
    } catch (error) {
      console.error("Error loading purchase for edit:", error);
      alert("Failed to load purchase for editing");
    }
  };

  // Validate and save invoice
  const handleSave = async ({ post = false } = {}) => {
    const selectedFYearID = localStorage.getItem("selectedFYearID");
    if (!selectedFYearID) {
      setNotice({ open: true, type: 'warning', message: 'Please select an accounting period first' });
      return;
    }

    // Client-side validation like Odoo
    const errors = {};
    if (!String(header.TrNo).trim()) errors.TrNo = "Transaction number required";
    if (!String(header.TrDate).trim()) {
      errors.TrDate = "Date required";
    } else {
      // Validate transaction date against accounting period
      try {
        const validation = await validateTransactionDate(header.TrDate);
        if (!validation.isValid) {
          errors.TrDate = validation.message;
        }
      } catch (error) {
        errors.TrDate = "Error validating transaction date";
      }
    }
    if (!String(header.PartyID).trim()) errors.PartyID = "Supplier required";
    if (!String(header.SuppInvDt).trim()) errors.SuppInvDt = "Supplier invoice date required";

    if (Object.keys(errors).length) {
      setHeaderErrors(errors);
      // Show notice with the first error
      const firstKey = Object.keys(errors)[0];
      setNotice({ open: true, type: 'error', message: errors[firstKey] });
      // Focus the first invalid field
      setTimeout(() => {
        if (firstKey === 'TrNo') trNoRef.current?.focus();
        if (firstKey === 'TrDate') document.getElementById('TrDateInput')?.focus();
        if (firstKey === 'PartyID') document.getElementById('PartyIDSelect')?.focus();
        if (firstKey === 'SuppInvDt') document.getElementById('SuppInvDtInput')?.focus();
      }, 0);
      return;
    }

    setHeaderErrors({});
    setNotice({ open: false, type: 'error', message: '' });

    // Block save if there are no valid items
    const rowsToSave = (items || []).filter(r => String(r.ItemCode || '').trim() && n(r.Qty) > 0);
    if (rowsToSave.length === 0) {
      setItemTab('items');
      setNotice({ open: true, type: 'error', message: 'Add at least one item with quantity before saving' });
      return;
    }

    // Final safety check before saving
    try {
      const finalValidation = await validateTransactionDate(header.TrDate);
      if (!finalValidation.isValid) {
        setNotice({ open: true, type: 'error', message: `Cannot save: ${finalValidation.message}` });
        return;
      }
    } catch (error) {
      setNotice({ open: true, type: 'error', message: 'Cannot save: Error validating transaction date' });
      return;
    }

    setSaving(true);
    try {
      // Create header (compute InvAmt/CGST/SGST/IGST from items)
      const payloadHeader = {
        ...header,
        FYearID: selectedFYearID, // Use selected accounting period
        InvAmt: n(header.InvAmt),
        TptCharge: n(header.TptCharge),
        LabCharge: n(header.LabCharge),
        MiscCharge: n(header.MiscCharge),
        PackCharge: n(header.PackCharge),
        Rounded: n(header.Rounded),
        CGST: n(header.CGST),
        SGST: n(header.SGST),
        IGST: n(header.IGST),
        // booleans
        CostSheetPrepared: !!header.CostSheetPrepared,
        GRNPosted: post ? true : !!header.GRNPosted,
        Costconfirmed: !!header.Costconfirmed,
      };

      let tranId;
      if (editingPurchase) {
        // Update existing purchase
        await axios.put(`http://localhost:5000/api/purchase/${editingPurchase.tranid}`, payloadHeader);
        tranId = editingPurchase.tranid;
      } else {
        // Create new purchase - generate TrNo at save time to prevent number clashes
        const nextTrNo = await generateNextTrNo();
        const payloadWithTrNo = { ...payloadHeader, TrNo: nextTrNo };
        
        const headerRes = await axios.post(`${API_BASE_URL}/api/purchase`, payloadWithTrNo);
        tranId = headerRes.data?.TranID;
        if (!tranId) throw new Error("TranID not returned");
        
        // Update the form with the generated TrNo
        setHeader(prev => ({ ...prev, TrNo: nextTrNo }));
      }

      // Add line items (only valid rows)
      for (const row of rowsToSave) {
        const line = recalcItem({ ...row, FYearID: selectedFYearID });
        await axios.post(`http://localhost:5000/api/purchase/${tranId}/items`, {
          FYearID: selectedFYearID,
          Srno: line.Srno,
          ItemCode: line.ItemCode,
          Qty: n(line.Qty),
          Rate: n(line.Rate),
          InvAmount: n(line.InvAmount),
          OHAmt: n(line.OHAmt),
          NetRate: n(line.NetRate),
          Rounded: n(line.Rounded),
          CGSTAmount: n(line.CGSTAmount),
          SGSTAmout: n(line.SGSTAmout), // spelling from route
          IGSTAmount: n(line.IGSTAmount),
          GTotal: n(line.GTotal),
          CGSTPer: n(line.CGSTPer),
          SGSTPer: n(line.SGSTPer),
          IGSTPer: n(line.IGSTPer),
        });
      }

      if (!post) {
        setNotice({ open: true, type: 'success', message: 'Purchase saved successfully' });
      }

      if (post) {
        // After posting: keep form open, set to posted and lock further edits
        setGrnStatus('posted');
        setHeader((h) => ({ ...h, GRNPosted: true }));
        setOriginalHeader({ ...header, GRNPosted: true });
        setOriginalItems(items.map(it => ({ ...it })));
        await fetchPurchases();
      } else if (!editingPurchase) {
        // New record saved (not posted): keep form open and freeze current state as baseline
        setEditingPurchase({ tranid: tranId });
        setOriginalHeader({ ...header });
        setOriginalItems(items.map(it => ({ ...it })));
        await fetchPurchases();
      } else {
        // Existing record saved (not posted): keep form open and freeze current state as baseline
        setOriginalHeader({ ...header });
        setOriginalItems(items.map(it => ({ ...it })));
        await fetchPurchases();
      }
    } catch (e) {
      console.error(e);
      alert(e.response?.data?.error || e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  // Helpers to reset form to a clean state
  const initialHeader = {
    FYearID: "",
    TrNo: "NEW",
    TrDate: "",
    SuppInvNo: "",
    SuppInvDt: "",
    PartyID: "",
    Remark: "",
    InvAmt: 0,
    TptCharge: 0,
    LabCharge: 0,
    MiscCharge: 0,
    PackCharge: 0,
    Rounded: 0,
    CGST: 0,
    SGST: 0,
    IGST: 0,
    CostSheetPrepared: false,
    GRNPosted: false,
    Costconfirmed: false,
    is_cancelled: false,
  };
  const initialItems = [];

  const mm = (value) => (value ? new Date(value).toLocaleDateString() : "");
  const sanitizeText = (value) => (value ? String(value) : "");
  const addRowToPdf = (docInstance, data, yPosition, columnWidths, columnAlign, pad = 4) => {
    const rowHeight = 24;
    const tableY = yPosition + pad;
    const values = [
      data.srno,
      data.item,
      data.qty,
      data.rate,
      data.taxable,
      data.gstRate,
      data.gstAmount,
      data.total,
    ];
    let x = 40;
    values.forEach((val, idx) => {
      const cellWidth = columnWidths[idx];
      const align = columnAlign[idx] || 'left';
      const textValue = String(val ?? "");
      let textX;
      if (align === 'right') {
        textX = x + cellWidth - 4;
      } else if (align === 'center') {
        textX = x + cellWidth / 2;
      } else {
        textX = x + 4;
      }
      docInstance.text(textValue, textX, tableY + 12, { align });
      docInstance.rect(x, yPosition, cellWidth, rowHeight);
      x += cellWidth;
    });
    return yPosition + rowHeight;
  };

  const resetFormState = async () => {
    // Set default transaction date within accounting period
    let defaultDate = "";
    try {
      defaultDate = await getDefaultTransactionDate();
    } catch (error) {
      console.error("Error getting default date:", error);
      defaultDate = new Date().toISOString().split('T')[0];
    }
    
    setHeader({ ...initialHeader, TrDate: defaultDate });
    setItems([...initialItems]);
    setEditingPurchase(null);
    setGrnStatus('draft');
    setSelectedItem(null);
    setShowItemModal(false);
    setItemSearchTerm('');
    setHighlightIndex(0);
    // Ensure the Items tab is active for new purchases so Add Row is visible immediately
    setItemTab('items');
    setModalItemData({
      Qty: 1,
      Rate: 0,
      InvAmount: 0,
      CGSTAmount: 0,
      SGSTAmount: 0,
      IGSTAmount: 0,
      GTotal: 0,
      CGSTPer: 0,
      SGSTPer: 0,
      IGSTPer: 0
    });
    setNoOverhead(false);
  };

  const handleExportPdf = async () => {
    if (!editingPurchase?.tranid) {
      setNotice({ open: true, type: 'warning', message: 'Save the purchase before printing.' });
      return;
    }

    setExportingPdf(true);
    try {
      const doc = new jsPDF('l', 'pt', 'a4');
      const lineHeight = 16;
      const leftMargin = 40;
      const rightMargin = 40;
      const contentWidth = doc.internal.pageSize.getWidth() - leftMargin - rightMargin;
      let cursorY = 60;

      const companyName = sanitizeText(companyProfile?.company_name);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text(companyName || 'Company Name', leftMargin, cursorY);
      cursorY += lineHeight + 10;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('Purchase Invoice', leftMargin + contentWidth / 2, cursorY, { align: 'center' });
      cursorY += lineHeight;
      doc.setFontSize(12);

      const supplier = suppliers.find((sup) => String(sup.partyid) === String(header.PartyID));
      const supplierName = sanitizeText(supplier?.partyname);

      const txnLeft = [
        `Trn #: ${sanitizeText(header.TrNo)}`,
        `Trn Date: ${mm(header.TrDate)}`,
        `Supp. Inv #: ${sanitizeText(header.SuppInvNo)}`,
        `Supp Inv Date: ${mm(header.SuppInvDt)}`,
      ];

      const txnRight = [`Supplier: ${supplierName || '-'}`];

      const columnGap = 40;
      const halfWidth = (contentWidth - columnGap) / 2;
      const leftX = leftMargin;
      const rightX = leftMargin + halfWidth + columnGap;

      const leftHeight = txnLeft.length * lineHeight;
      const rightHeight = txnRight.length * lineHeight;
      const boxHeight = Math.max(leftHeight, rightHeight) + 16;

      doc.rect(leftX, cursorY, halfWidth, boxHeight);
      doc.rect(rightX, cursorY, halfWidth, boxHeight);

      let lineY = cursorY + lineHeight;
      doc.setFont('helvetica', 'normal');
      txnLeft.forEach((text) => {
        doc.text(text, leftX + 8, lineY);
        lineY += lineHeight;
      });

      lineY = cursorY + lineHeight;
      txnRight.forEach((text) => {
        doc.text(text, rightX + 8, lineY);
        lineY += lineHeight;
      });

      cursorY += boxHeight + 20;

      const columnWidths = [40, 312, 60, 60, 80, 50, 80, 80];
      const columnAlign = ['center', 'left', 'right', 'right', 'right', 'center', 'right', 'right'];
      const headers = ['Sr#', 'Item', 'Qty', 'Rate', "Tax'le Amt", 'GST%', 'GST Amt', 'Total'];
      let x = leftMargin;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);

      headers.forEach((text, idx) => {
        const align = columnAlign[idx];
        const width = columnWidths[idx];
        let headerX = x + 4;
        if (align === 'right') {
          headerX = x + width - 4;
        } else if (align === 'center') {
          headerX = x + width / 2;
        }
        doc.text(text, headerX, cursorY + 12, { align });
        doc.rect(x, cursorY, columnWidths[idx], 24);
        x += columnWidths[idx];
      });
      cursorY += 24;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);

      const printableItems = (items || []).filter((r) => String(r.ItemCode || '').trim()).map((row, idx) => ({
        srno: idx + 1,
        item: sanitizeText(row.ItemName || row.ItemCode),
        qty: n(row.Qty).toFixed(2),
        rate: n(row.Rate).toFixed(2),
        taxable: n(row.InvAmount).toFixed(2),
        gstRate: `${n(row.SGSTPer + row.CGSTPer + row.IGSTPer).toFixed(0)}%`,
        gstAmount: (n(row.CGSTAmount) + n(row.SGSTAmout) + n(row.IGSTAmount)).toFixed(2),
        total: n(row.GTotal).toFixed(2),
      }));

      printableItems.forEach((row) => {
        if (cursorY + 60 > doc.internal.pageSize.getHeight()) {
          doc.addPage();
          cursorY = 40;
          let headerX = leftMargin;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(11);
          headers.forEach((text, idx) => {
            const align = columnAlign[idx];
            const width = columnWidths[idx];
            let hdrX = headerX + 4;
            if (align === 'right') {
              hdrX = headerX + width - 4;
            } else if (align === 'center') {
              hdrX = headerX + width / 2;
            }
            doc.text(text, hdrX, cursorY + 12, { align });
            doc.rect(headerX, cursorY, columnWidths[idx], 24);
            headerX += columnWidths[idx];
          });
          cursorY += 24;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
        }
        cursorY = addRowToPdf(doc, row, cursorY, columnWidths, columnAlign);
      });

      doc.setFont('helvetica', 'bold');
      const totalRow = {
        srno: 'Total',
        item: '',
        qty: printableItems.reduce((acc, row) => acc + Number(row.qty), 0).toFixed(2),
        rate: '',
        taxable: n(header.InvAmt).toFixed(2),
        gstRate: '',
        gstAmount: (n(header.CGST) + n(header.SGST) + n(header.IGST)).toFixed(2),
        total: (n(header.InvAmt) + n(header.CGST) + n(header.SGST) + n(header.IGST)).toFixed(2),
      };

      cursorY = addRowToPdf(doc, totalRow, cursorY, columnWidths, columnAlign);

      cursorY += 24;
      const summaryCells = [
        { label: 'Taxable Total', value: n(header.InvAmt).toFixed(2) },
        { label: 'SGST Amount', value: n(header.SGST).toFixed(2) },
        { label: 'CGST Amount', value: n(header.CGST).toFixed(2) },
        { label: 'IGST Amount', value: n(header.IGST).toFixed(2) },
        { label: 'Rounded Off', value: n(header.Rounded).toFixed(2) },
        { label: 'Total Amount', value: (n(header.InvAmt) + n(header.CGST) + n(header.SGST) + n(header.IGST) + n(header.Rounded)).toFixed(2) },
      ];

      const summaryCellHeight = 40;
      const summaryCellWidth = contentWidth / summaryCells.length;
      const summaryY = cursorY;
      doc.rect(leftMargin, summaryY, contentWidth, summaryCellHeight);
      summaryCells.forEach((cell, idx) => {
        const cellX = leftMargin + idx * summaryCellWidth;
        if (idx > 0) {
          doc.line(cellX, summaryY, cellX, summaryY + summaryCellHeight);
        }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(cell.label, cellX + summaryCellWidth / 2, summaryY + 14, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.text(cell.value, cellX + summaryCellWidth / 2, summaryY + 28, { align: 'center' });
      });
      cursorY += summaryCellHeight + 20;

      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.text('This is a computer generated document.', leftMargin, doc.internal.pageSize.getHeight() - 40);

      doc.save(`Purchase-${sanitizeText(header.TrNo) || editingPurchase.tranid}.pdf`);
    } catch (err) {
      console.error(err);
      setNotice({ open: true, type: 'error', message: 'Failed to generate PDF' });
    } finally {
      setExportingPdf(false);
    }
  };

  // UI
  return (
    <div className="min-h-screen bg-gray-50">
      {notice.open && (
        <div className="fixed top-4 inset-x-0 flex justify-center z-50" role="alert">
          {(() => {
            const noticeBg = {
              error: 'bg-red-700',
              warning: 'bg-amber-600',
              info: 'bg-blue-700',
              success: 'bg-green-500',
            }[notice.type || 'error'];
            return (
              <div className={`${noticeBg} text-white px-4 py-3 rounded shadow-lg w-[90%] md:w-[600px] relative`}>
                <div className="font-bold">Newgen Alert</div>
                <div className="mt-1 pr-6">{notice.message}</div>
                <button
                  type="button"
                  aria-label="Close alert"
                  className="absolute right-2 top-2 text-white/90 hover:text-white"
                  onClick={() => setNotice({ open: false, type: 'error', message: '' })}
                >
                  ×
                </button>
              </div>
            );
          })()}
        </div>
      )}
      <div
        className={`${showForm ? "pl-3 pr-6 py-6" : "p-6"}`}
        onClick={() => {
          if (notice.open) setNotice({ open: false, title: "", message: "" });
        }}
      >
        {/* Header actions */}
        <div className="flex flex-col items-start mb-4">
          <div className="flex items-center justify-between w-full mb-3">
            <h1 className="text-2xl font-bold text-gray-900">Purchase Invoices</h1>
            
            {/* Record navigation in edit form mode */}
            {showForm && editingPurchase && filtered.length > 1 && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <button
                  type="button"
                  onClick={goToPreviousRecord}
                  disabled={getCurrentRecordIndex() === 0}
                  className={`p-1 rounded ${
                    getCurrentRecordIndex() === 0
                      ? "text-gray-300 cursor-not-allowed"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
                  </svg>
                </button>
                <span className="font-medium">
                  Record {getCurrentRecordIndex() + 1} / {filtered.length}
                </span>
                <button
                  type="button"
                  onClick={goToNextRecord}
                  disabled={getCurrentRecordIndex() === filtered.length - 1}
                  className={`p-1 rounded ${
                    getCurrentRecordIndex() === filtered.length - 1
                      ? "text-gray-300 cursor-not-allowed"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
                  </svg>
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between w-full mb-2">
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  // Allow new purchase if form is not open OR if current purchase is saved OR confirmed
                  const isSaved = editingPurchase?.tranid;
                  const isConfirmed = header.Costconfirmed;
                  if (showForm && !isSaved && !isConfirmed) return;
                  await resetFormState(); // ensure fresh form
                  setShowForm(true);
                  setTimeout(() => trNoRef.current?.focus(), 0);
                }}
                disabled={showForm && !editingPurchase?.tranid && !header.Costconfirmed}
                className={`px-4 py-2 rounded-lg shadow text-white ${
                  (showForm && !editingPurchase?.tranid && !header.Costconfirmed) ? "bg-purple-400 cursor-not-allowed opacity-60" : "bg-purple-600 hover:bg-purple-700"
                }`}
              >
                New
              </button>

              {!showForm && (
                <>
                  {/* Search */}
                  <input
                    type="text"
                    placeholder="Search TrNo / Supplier Inv / Supplier Name"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="px-3 py-2 border rounded-md text-sm w-80"
                  />

                  {/* Server filters */}
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => {
                      const v = e.target.value;
                      setFromDate(v);
                      if (toDate && v && v > toDate) setDateError("From date must be before To date");
                      else setDateError("");
                    }}
                    className="px-3 py-2 border rounded-md text-sm"
                    title="From Date"
                  />
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => {
                      const v = e.target.value;
                      setToDate(v);
                      if (fromDate && v && v < fromDate) setDateError("To date must be after From date");
                      else setDateError("");
                    }}
                    className="px-3 py-2 border rounded-md text-sm"
                    title="To Date"
                  />
                  {dateError && <span className="text-red-600 text-xs">{dateError}</span>}

                  <button
                    onClick={() => {
                      if (dateError) return;
                      if (fromDate && toDate && fromDate > toDate) {
                        setDateError("From date must be before To date");
                        return;
                      }
                      fetchPurchases();
                    }}
                    className="px-3 py-2 border rounded text-sm"
                  >
                    Apply
                  </button>
                </>
              )}

              {showForm && (
                <>
                  <button
                    type="button"
                    disabled={saving || !isDirty}
                    onClick={() => handleSave({ post: false })}
                    className={`px-4 py-2 text-sm rounded text-white ${
                      !saving && isDirty ? "bg-purple-600 hover:bg-purple-700" : "bg-purple-400 cursor-not-allowed opacity-60"
                    }`}
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>

                  {!isCancelled && !isPosted && (
                    <button
                      type="button"
                      className="px-3 py-2 text-sm border rounded"
                      onClick={() => {
                        if (isCancelled) return;
                        handleSave({ post: true });
                      }}
                    >
                      Post
                    </button>
                  )}

                  {!isCancelled && isPosted && !header.Costconfirmed && (
                    <button
                      type="button"
                      className="px-3 py-2 text-sm border rounded"
                      onClick={async () => {
                        if (!editingPurchase?.tranid) return;
                        setCostingPreview([]);
                        setShowCostingModal(true);
                      }}
                    >
                      Costing
                    </button>
                  )}

                  <button
                    type="button"
                    className="px-3 py-2 text-sm border rounded"
                    onClick={async () => { await resetFormState(); setShowForm(false); }}
                  >
                    Close
                  </button>

                  <button
                    type="button"
                    className="px-3 py-2 text-sm border rounded"
                    onClick={handleExportPdf}
                    disabled={!editingPurchase?.tranid || exportingPdf}
                  >
                    {exportingPdf ? 'Generating…' : 'Print'}
                  </button>

                  {/* Cancel for posted & not confirmed */}
                  {!isCancelled && isPosted && !header.Costconfirmed && (
                    <button
                      type="button"
                      className="px-3 py-2 text-sm border rounded text-red-700 border-red-300 hover:bg-red-50"
                      onClick={async () => {
                        if (!editingPurchase?.tranid) return;
                        try {
                          await axios.post(`http://localhost:5000/api/purchase/${editingPurchase.tranid}/cancel`);
                          setHeader(h => ({ ...h, GRNPosted: false, CostSheetPrepared: false, Costconfirmed: false, is_cancelled: true }));
                          setNoOverhead(false);
                          setNotice({ open: true, type: 'success', message: 'Purchase cancelled' });
                          await fetchPurchases();
                        } catch (e) {
                          const msg = e?.response?.data?.error || 'Failed to cancel purchase';
                          setNotice({ open: true, type: 'error', message: msg });
                        }
                      }}
                    >
                      Cancel
                    </button>
                  )}

                  {/* Set to Draft when cancelled */}
                  {isCancelled && (
                    <button
                      type="button"
                      className="px-3 py-2 text-sm border rounded"
                      onClick={async () => {
                        if (!editingPurchase?.tranid) return;
                        try {
                          await axios.post(`http://localhost:5000/api/purchase/${editingPurchase.tranid}/set-draft`);
                          setHeader(h => ({ ...h, GRNPosted: false, CostSheetPrepared: false, Costconfirmed: false, is_cancelled: false }));
                          setGrnStatus('draft');
                          setNotice({ open: true, type: 'success', message: 'Purchase set to Draft' });
                          await fetchPurchases();
                        } catch (e) {
                          setNotice({ open: true, type: 'error', message: 'Failed to set to Draft' });
                        }
                      }}
                    >
                      Set to Draft
                    </button>
                  )}
                </>
              )}


            </div>

            {/* Status ribbon (Draft -> Posted -> Cost Sheet -> Confirmed) */}
            {showForm && (
              <div className="flex items-stretch gap-0 select-none">
                {(() => {
                  const labels = isCancelled ? ['Cancelled'] : ['Draft', 'Posted', 'Cost Sheet', 'Confirmed'];
                  const stageIndex = isCancelled
                    ? 0
                    : !!header.Costconfirmed
                    ? 3
                    : !!header.CostSheetPrepared
                    ? 2
                    : (!!header.GRNPosted || grnStatus === 'posted')
                    ? 1
                    : 0;
                  return labels.map((label, idx, arr) => {
                    const state = idx < stageIndex ? 'done' : idx === stageIndex ? 'active' : 'todo';
                    const base =
                      state === 'active'
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : state === 'done'
                        ? 'bg-indigo-100 text-indigo-800 border-indigo-200'
                        : 'bg-gray-100 text-gray-600 border-gray-300';
                    const arrowColor =
                      state === 'active' ? '#4f46e5' : state === 'done' ? '#e0e7ff' : '#f3f4f6';
                    return (
                      <div key={label} className="relative">
                        <div
                          className={`px-4 py-1 text-xs font-semibold uppercase border ${base} ${idx === 0 ? 'rounded-l-md' : ''} ${
                            idx === arr.length - 1 ? 'rounded-r-md' : 'pr-6'
                          }`}
                        >
                          {label}
                        </div>
                        {idx !== arr.length - 1 && (
                          <div
                            className="absolute top-1/2 -translate-y-1/2 right-[-8px] w-0 h-0 border-t-8 border-b-8 border-l-8"
                            style={{
                              borderTopColor: 'transparent',
                              borderBottomColor: 'transparent',
                              borderLeftColor: arrowColor,
                            }}
                          />
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            )}

            {/* Pagination summary in table mode */}
            {!showForm && totalRecords > 0 && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <button
                  onClick={goToPreviousPage}
                  disabled={currentPage === 1}
                  className={`p-1 rounded ${
                    currentPage === 1 ? "text-gray-300 cursor-not-allowed" : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
                  </svg>
                </button>
                <span className="font-medium">
                  {startIndex + 1}-{Math.min(endIndex, totalRecords)} / {totalRecords}
                </span>
                <button
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages}
                  className={`p-1 rounded ${
                    currentPage === totalPages ? "text-gray-300 cursor-not-allowed" : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Table or Form */}
        {!showForm ? (
          <div className="border rounded-lg shadow-sm overflow-x-auto">
            <table className="w-full border-collapse min-w-[1100px]">
              <thead className="bg-gray-100 text-left">
                <tr>
                  <th className="p-2 border-b w-8 text-center">
                    <input
                      type="checkbox"
                      ref={headerSelectRef}
                      checked={allOnPageSelected}
                      onChange={(e) => { e.stopPropagation(); toggleSelectAllOnPage(); }}
                      title="Select/Deselect all rows on this page"
                    />
                  </th>
                  <th 
                    className="p-2 border-b cursor-pointer hover:bg-gray-200 select-none"
                    onClick={() => handleSort('trno')}
                    title="Click to sort by Transaction Number"
                  >
                    <div className="flex items-center justify-between">
                      <span>Tr No</span>
                      <span className="ml-1">
                        {sortField === 'trno' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th 
                    className="p-2 border-b cursor-pointer hover:bg-gray-200 select-none"
                    onClick={() => handleSort('trdate')}
                    title="Click to sort by Transaction Date"
                  >
                    <div className="flex items-center justify-between">
                      <span>Tr Date</span>
                      <span className="ml-1">
                        {sortField === 'trdate' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th 
                    className="p-2 border-b w-[60ch] cursor-pointer hover:bg-gray-200 select-none"
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
                    className="p-2 border-b cursor-pointer hover:bg-gray-200 select-none"
                    onClick={() => handleSort('suppinvno')}
                    title="Click to sort by Supplier Invoice Number"
                  >
                    <div className="flex items-center justify-between">
                      <span>SI.No</span>
                      <span className="ml-1">
                        {sortField === 'suppinvno' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th 
                    className="p-2 border-b cursor-pointer hover:bg-gray-200 select-none"
                    onClick={() => handleSort('suppinvdt')}
                    title="Click to sort by Supplier Invoice Date"
                  >
                    <div className="flex items-center justify-between">
                      <span>SI.Date</span>
                      <span className="ml-1">
                        {sortField === 'suppinvdt' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th 
                    className="p-2 border-b cursor-pointer hover:bg-gray-200 select-none"
                    onClick={() => handleSort('invamt')}
                    title="Click to sort by Invoice Amount"
                  >
                    <div className="flex items-center justify-between">
                      <span>Inv Amt</span>
                      <span className="ml-1">
                        {sortField === 'invamt' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th 
                    className="p-2 border-b cursor-pointer hover:bg-gray-200 select-none"
                    onClick={() => handleSort('cgst')}
                    title="Click to sort by CGST"
                  >
                    <div className="flex items-center justify-between">
                      <span>CGST</span>
                      <span className="ml-1">
                        {sortField === 'cgst' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th 
                    className="p-2 border-b cursor-pointer hover:bg-gray-200 select-none"
                    onClick={() => handleSort('sgst')}
                    title="Click to sort by SGST"
                  >
                    <div className="flex items-center justify-between">
                      <span>SGST</span>
                      <span className="ml-1">
                        {sortField === 'sgst' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th 
                    className="p-2 border-b cursor-pointer hover:bg-gray-200 select-none"
                    onClick={() => handleSort('igst')}
                    title="Click to sort by IGST"
                  >
                    <div className="flex items-center justify-between">
                      <span>IGST</span>
                      <span className="ml-1">
                        {sortField === 'igst' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th className="p-2 border-b">Invoice Total</th>
                  <th 
                    className="p-2 border-b cursor-pointer hover:bg-gray-200 select-none"
                    onClick={() => handleSort('grn_posted')}
                    title="Click to sort by Posted Status"
                  >
                    <div className="flex items-center justify-between">
                      <span>Posted</span>
                      <span className="ml-1">
                        {sortField === 'grn_posted' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th 
                    className="p-2 border-b cursor-pointer hover:bg-gray-200 select-none"
                    onClick={() => handleSort('cost_sheet_prepared')}
                    title="Click to sort by Cost Sheet Status"
                  >
                    <div className="flex items-center justify-between">
                      <span>Cost Sheet</span>
                      <span className="ml-1">
                        {sortField === 'cost_sheet_prepared' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th className="p-2 border-b">Confirmed</th>
                  <th 
                    className="p-2 border-b cursor-pointer hover:bg-gray-200 select-none"
                    onClick={() => handleSort('is_cancelled')}
                    title="Click to sort by Cancelled Status"
                  >
                    <div className="flex items-center justify-between">
                      <span>Cancelled</span>
                      <span className="ml-1">
                        {sortField === 'is_cancelled' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {currentRecords.map((r) => (
                  <tr
                    key={r.tranid}
                    className="hover:bg-indigo-50 cursor-pointer"
                    onClick={() => editPurchase(r)}
                    title="Click to edit"
                  >
                    <td className="p-2 border-b w-8 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isRowSelected(r.tranid)}
                        onChange={() => toggleRowSelect(r.tranid)}
                        title={`Select transaction ${r.trno}`}
                      />
                    </td>
                    <td className="p-2 border-b">{r.trno}</td>
                    <td className="p-2 border-b">{r.trdate ? new Date(r.trdate).toLocaleDateString() : "-"}</td>
                    <td className="p-2 border-b w-[60ch]">{r.partyname}</td>
                    <td className="p-2 border-b">{r.suppinvno || "-"}</td>
                    <td className="p-2 border-b">{r.suppinvdt ? new Date(r.suppinvdt).toLocaleDateString() : "-"}</td>
                    <td className="p-2 border-b text-right">{formatNumber(n(r.invamt).toFixed(2))}</td>
                    <td className="p-2 border-b text-right">{formatNumber(n(r.cgst).toFixed(2))}</td>
                    <td className="p-2 border-b text-right">{formatNumber(n(r.sgst).toFixed(2))}</td>
                    <td className="p-2 border-b text-right">{formatNumber(n(r.igst).toFixed(2))}</td>
                    <td className="p-2 border-b text-right">{formatNumber((n(r.invamt) + n(r.cgst) + n(r.sgst) + n(r.igst)).toFixed(2))}</td>
                    <td className="p-2 border-b text-center">
                      <input
                        type="checkbox"
                        checked={!!r.grnposted}
                        readOnly
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td className="p-2 border-b text-center">
                      <input
                        type="checkbox"
                        checked={!!r.costsheetprepared}
                        readOnly
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td className="p-2 border-b text-center">
                      <input
                        type="checkbox"
                        checked={!!r.costconfirmed}
                        readOnly
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td className="p-2 border-b text-center">
                      <input
                        type="checkbox"
                        checked={!!r.is_cancelled}
                        readOnly
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                  </tr>
                ))}
                {totalRecords === 0 && (
                  <tr>
                    <td colSpan="15" className="text-center p-2">No Purchases Found</td>
                  </tr>
                )}
              </tbody>
              {/* Footer totals for current page */}
              <tfoot>
                <tr className="bg-gray-50 font-semibold">
                  <td className="p-2 border-t" colSpan="6">Page Totals</td>
                  <td className="p-2 border-t text-right">{formatNumber(pageTotals.inv.toFixed(2))}</td>
                  <td className="p-2 border-t text-right">{formatNumber(pageTotals.cgst.toFixed(2))}</td>
                  <td className="p-2 border-t text-right">{formatNumber(pageTotals.sgst.toFixed(2))}</td>
                  <td className="p-2 border-t text-right">{formatNumber(pageTotals.igst.toFixed(2))}</td>
                  <td className="p-2 border-t text-right">{formatNumber(pageTotals.total.toFixed(2))}</td>
                  <td className="p-2 border-t"></td>
                  <td className="p-2 border-t"></td>
                  <td className="p-2 border-t"></td>
                  <td className="p-2 border-t"></td>
                </tr>
                <tr className="bg-gray-100 font-semibold">
                  <td className="p-2 border-t" colSpan="6">Grand Totals</td>
                  <td className="p-2 border-t text-right">{formatNumber(grandTotals.inv.toFixed(2))}</td>
                  <td className="p-2 border-t text-right">{formatNumber(grandTotals.cgst.toFixed(2))}</td>
                  <td className="p-2 border-t text-right">{formatNumber(grandTotals.sgst.toFixed(2))}</td>
                  <td className="p-2 border-t text-right">{formatNumber(grandTotals.igst.toFixed(2))}</td>
                  <td className="p-2 border-t text-right">{formatNumber(grandTotals.total.toFixed(2))}</td>
                  <td className="p-2 border-t"></td>
                  <td className="p-2 border-t"></td>
                  <td className="p-2 border-t"></td>
                  <td className="p-2 border-t"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="bg-white p-4 rounded-lg shadow space-y-3">
            {/* Costing Modal */}
            {showCostingModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center">
                <div className="absolute inset-0 bg-black/30" onClick={() => setShowCostingModal(false)} />
                <div className="relative bg-white w-[95%] max-w-5xl rounded-lg shadow-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-semibold">Cost Sheet</h2>
                    <button className="text-gray-600 hover:text-black" onClick={() => setShowCostingModal(false)}>×</button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                    <div className="border rounded p-3">
                      <div className="space-y-3">
                        {costingRows.map((row, idx) => (
                          <div key={idx} className="flex items-center justify-between gap-3">
                            <input
                              className="flex-1 px-2 py-1 border rounded text-sm"
                              value={row.OHType}
                              onChange={(e) => {
                                const v = e.target.value;
                                setCostingRows(prev => prev.map((r, i) => i === idx ? { ...r, OHType: v } : r));
                              }}
                              placeholder="Cost Head"
                            />
                            <input
                              type="number"
                              className="w-40 px-2 py-1 border rounded text-sm text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              value={row.Amount}
                              onChange={(e) => {
                                const v = Number(e.target.value) || 0;
                                setCostingRows(prev => prev.map((r, i) => i === idx ? { ...r, Amount: v } : r));
                              }}
                              placeholder="Amount"
                              // Custom tab/enter flow: Transportation -> Labour -> Misc -> Save
                              ref={
                                idx === costingTypeIndex.tpt ? tptAmtRef :
                                idx === costingTypeIndex.lab ? labAmtRef :
                                idx === costingTypeIndex.misc ? miscAmtRef : undefined
                              }
                              onKeyDown={(e) => {
                                if (idx === costingTypeIndex.tpt) return handleCostingAmountKeyDown(e, 'tpt');
                                if (idx === costingTypeIndex.lab) return handleCostingAmountKeyDown(e, 'lab');
                                if (idx === costingTypeIndex.misc) return handleCostingAmountKeyDown(e, 'misc');
                              }}
                            />
                          </div>
                        ))}
                        <div className="flex items-center justify-between pt-2 border-t">
                          <div className="font-semibold">Total Overhead</div>
                          <div className="w-40 text-right font-semibold">
                            {formatNumber((costingRows.reduce((a, r) => a + (Number(r.Amount) || 0), 0)).toFixed(2))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="border rounded p-3">
                      <div className="text-sm text-gray-600">Instructions</div>
                      <ul className="list-disc ml-5 text-sm mt-2 space-y-1">
                        <li>Enter overhead amounts (Transportation, Labour, Misc).</li>
                        <li>Click "Save Costing" to persist overheads.</li>
                        <li>Click "Preview Allocation" to compute item-wise distribution by value.</li>
                        <li>Click "Confirm Costing" to finalize and lock costing.</li>
                      </ul>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-3">
                    <button
                      className="px-3 py-2 text-sm border rounded"
                      ref={saveCostingBtnRef}
                      onClick={async () => {
                        if (!currentTranId && !editingPurchase?.tranid) return;
                        const id = currentTranId || editingPurchase.tranid;
                        try {
                          const resp = await axios.put(`http://localhost:5000/api/purchase/${id}/costing`, { rows: costingRows });
                          const d = resp?.data || {};
                          setHeader(h => ({
                            ...h,
                            TptCharge: d.TptCharge ?? h.TptCharge,
                            LabCharge: d.LabCharge ?? h.LabCharge,
                            MiscCharge: d.MiscCharge ?? h.MiscCharge,
                            CostSheetPrepared: !!d.CostSheetPrepared || h.CostSheetPrepared
                          }));
                          setNotice({ open: true, type: 'success', message: 'Costing saved' });
                          // Refresh the purchase list so Cost Sheet Prepared reflects immediately in the table
                          await fetchPurchases();

                          // Re-fetch saved rows to reflect DB state
                          try {
                            const r = await axios.get(`http://localhost:5000/api/purchase/${id}/costing`);
                            const rows = Array.isArray(r.data) ? r.data : [];
                            setCostingRows(
                              (rows.length > 0)
                                ? rows.map(rr => ({
                                    OHType: rr.ohtype ?? rr.OHType ?? '',
                                    Amount: Number(rr.amount ?? rr.Amount ?? 0) || 0
                                  }))
                                : [
                                    { OHType: 'Transportation', Amount: 0 },
                                    { OHType: 'Labour', Amount: 0 },
                                    { OHType: 'Misc', Amount: 0 },
                                  ]
                            );
                          } catch {}
                        } catch (e) {
                          console.error(e);
                          setNotice({ open: true, type: 'error', message: 'Failed to save costing' });
                        }
                      }}
                    >
                      Save Costing
                    </button>

                    <button
                      className="px-3 py-2 text-sm border rounded"
                      onClick={() => {
                        // Compute allocation by value based on CURRENT modal inputs (not header totals)
                        const rows = items.map(r => recalcItem(r));
                        const totalInv = rows.reduce((a, r) => a + n(r.InvAmount), 0);
                        const totalOH = costingRows.reduce((a, r) => a + (Number(r.Amount) || 0), 0);
                        const preview = rows.map(r => {
                          const share = totalInv > 0 ? (n(r.InvAmount) / totalInv) : 0;
                          const oh = Number((share * totalOH).toFixed(2));
                          const netRate = Number((n(r.Rate) + (n(r.Qty) > 0 ? oh / n(r.Qty) : 0)).toFixed(2));
                          const gtot = Number((n(r.InvAmount) + oh).toFixed(2));
                          return {
                            Srno: r.Srno,
                            ItemName: r.ItemName,
                            Qty: r.Qty,
                            Rate: r.Rate,
                            InvAmount: r.InvAmount,
                            OHAmt: oh,
                            NetRate: netRate,
                            GTotal: gtot
                          };
                        });
                        setCostingPreview(preview);
                      }}
                    >
                      Preview Allocation
                    </button>

                    <button
                      className="px-3 py-2 text-sm border rounded bg-indigo-600 text-white hover:bg-indigo-700"
                      onClick={async () => {
                        if (!currentTranId && !editingPurchase?.tranid) return;
                        const id = currentTranId || editingPurchase.tranid;
                        // Make sure preview exists; if not, compute once
                        let preview = costingPreview;
                        if (!preview || !preview.length) {
                          const rows = items.map(r => recalcItem(r));
                          const totalInv = rows.reduce((a, r) => a + n(r.InvAmount), 0);
                          const totalOH = n(header.TptCharge) + n(header.LabCharge) + n(header.MiscCharge);
                          preview = rows.map(r => {
                            const share = totalInv > 0 ? (n(r.InvAmount) / totalInv) : 0;
                            const oh = Number((share * totalOH).toFixed(2));
                            const netRate = Number((n(r.Rate) + (n(r.Qty) > 0 ? oh / n(r.Qty) : 0)).toFixed(2));
                            const gtot = Number((n(r.InvAmount) + oh).toFixed(2));
                            return { Srno: r.Srno, OHAmt: oh, NetRate: netRate, GTotal: gtot };
                          });
                        }
                        try {
                          await axios.post(`http://localhost:5000/api/purchase/${id}/costing/confirm`, { items: preview });
                          setHeader(h => ({ ...h, Costconfirmed: true, CostSheetPrepared: true }));
                          setNotice({ open: true, type: 'success', message: 'Costing confirmed' });
                          setShowCostingModal(false);
                          // Refresh list and reload items for confirmed OH
                          fetchPurchases();
                          try {
                            const res = await axios.get(`http://localhost:5000/api/purchase/${id}`);
                            const purchaseHeader = res.data?.header || {};
                            const purchaseDetails = res.data?.details || [];
                            const formattedItems = purchaseDetails.map((detail, index) => {
                              const found = (allItems || []).find(it => String(it.itemcode) === String(detail.itemcode));
                              return {
                                Srno: index + 1,
                                ItemCode: detail.itemcode || "",
                                ItemName: found?.itemname || "",
                                Unit: found?.unit || detail.unit || "",
                                Qty: detail.qty || 0,
                                Rate: detail.rate || 0,
                                InvAmount: detail.invamount || 0,
                                OHAmt: detail.ohamt || detail.oamt || 0,
                                NetRate: detail.netrate || 0,
                                Rounded: detail.rounded || 0,
                                CGSTAmount: detail.cgst || 0,
                                SGSTAmout: detail.sgst || 0,
                                IGSTAmount: detail.igst || 0,
                                GTotal: detail.gtotal || 0,
                                CGSTPer: detail.cgstp || 0,
                                SGSTPer: detail.sgstp || 0,
                                IGSTPer: detail.igstp || 0,
                                FYearID: detail.fyearid || "",
                              };
                            });
                            setItems(formattedItems);
                            setItemTab('costing');
                          } catch {}
                        } catch (e) {
                          console.error(e);
                          setNotice({ open: true, type: 'error', message: 'Failed to confirm costing' });
                        }
                      }}
                    >
                      Confirm Costing
                    </button>
                  </div>

                  {/* Preview Table */}
                  {costingPreview && costingPreview.length > 0 && (
                    <div className="border rounded">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="p-2 text-left">Item</th>
                            <th className="p-2 text-right">Qty</th>
                            <th className="p-2 text-right">Rate</th>
                            <th className="p-2 text-right">Inv Amt</th>
                            <th className="p-2 text-right">OH Amt</th>
                            <th className="p-2 text-right">Net Rate</th>
                            <th className="p-2 text-right">Line Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {costingPreview.map((r, i) => (
                            <tr key={i} className="odd:bg-white even:bg-gray-50">
                              <td className="p-2">{r.ItemName}</td>
                              <td className="p-2 text-right">{formatNumber(n(r.Qty).toFixed(2))}</td>
                              <td className="p-2 text-right">{formatNumber(n(r.Rate).toFixed(2))}</td>
                              <td className="p-2 text-right">{formatNumber(n(r.InvAmount).toFixed(2))}</td>
                              <td className="p-2 text-right">{formatNumber(n(r.OHAmt).toFixed(2))}</td>
                              <td className="p-2 text-right">{formatNumber(n(r.NetRate).toFixed(2))}</td>
                              <td className="p-2 text-right">{formatNumber(n(r.GTotal).toFixed(2))}</td>
                            </tr>
                          ))}
                          <tr className="font-semibold bg-gray-50">
                            <td className="p-2 text-right">Totals</td>
                            <td className="p-2"></td>
                            <td className="p-2"></td>
                            <td className="p-2 text-right">{
                              formatNumber(costingPreview.reduce((a, r) => a + n(r.InvAmount), 0).toFixed(2))
                            }</td>
                            <td className="p-2 text-right">{
                              formatNumber(costingPreview.reduce((a, r) => a + n(r.OHAmt), 0).toFixed(2))
                            }</td>
                            <td className="p-2"></td>
                            <td className="p-2 text-right">{
                              formatNumber(costingPreview.reduce((a, r) => a + n(r.GTotal), 0).toFixed(2))
                            }</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* Header fields aligned to GRN layout */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm text-gray-600">Trn#</label>
                <input
                  ref={trNoRef}
                  type="text"
                  value={header.TrNo}
                  readOnly
                  className="mt-1 w-full px-3 py-2 border rounded bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600">Date</label>
                <input
                  id="TrDateInput"
                  type="date"
                  value={header.TrDate}
                  onChange={async (e) => {
                    if (isLocked) return;
                    const newDate = e.target.value;
                    setHeader({ ...header, TrDate: newDate });
                    
                    // Real-time validation of transaction date
                    if (newDate) {
                      try {
                        const validation = await validateTransactionDate(newDate);
                        if (!validation.isValid) {
                          setHeaderErrors((prev) => ({ ...prev, TrDate: validation.message }));
                        } else {
                          setHeaderErrors((prev) => ({ ...prev, TrDate: '' }));
                        }
                      } catch (error) {
                        setHeaderErrors((prev) => ({ ...prev, TrDate: 'Error validating date' }));
                      }
                    } else {
                      setHeaderErrors((prev) => ({ ...prev, TrDate: '' }));
                    }
                  }}
                  disabled={isLocked}
                  className={`mt-1 w-full px-3 py-2 border rounded ${headerErrors.TrDate ? 'border-red-500 ring-1 ring-red-300' : ''} ${isLocked ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600">Supplier</label>
                <select
                  id="PartyIDSelect"
                  value={header.PartyID}
                  onChange={(e) => {
                    if (isLocked) return;
                    setHeader({ ...header, PartyID: e.target.value });
                    setHeaderErrors((prev) => ({ ...prev, PartyID: '' }));
                  }}
                  disabled={isLocked}
                  className={`mt-1 w-full px-3 py-1 border rounded w-[60ch] ${headerErrors.PartyID ? 'border-red-500 ring-1 ring-red-300' : ''} ${isLocked ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                >
                  <option value="">Select Supplier</option>
                  {suppliers.map((s) => (
                    <option key={s.partyid} value={s.partyid}>{s.partyname}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-600">Sup Inv#</label>
                <input
                  type="text"
                  value={header.SuppInvNo}
                  onChange={(e) => { if (!isLocked) setHeader({ ...header, SuppInvNo: e.target.value }) }}
                  onBlur={async () => {
                    try {
                      const partyId = header.PartyID;
                      const suppInvNo = String(header.SuppInvNo || '').trim();
                      if (!partyId || !suppInvNo) return;
                      // Exclude current TranID when editing existing record
                      const exclude = editingPurchase?.tranid ? `&excludeTranId=${editingPurchase.tranid}` : '';
                      const url = `http://localhost:5000/api/purchase/check-suppinv?partyId=${encodeURIComponent(partyId)}&suppInvNo=${encodeURIComponent(suppInvNo)}${exclude}`;
                      const resp = await axios.get(url);
                      if (resp?.data?.exists) {
                        setNotice({ open: true, type: 'warning', message: 'Duplicate supplier invoice found for this supplier' });
                      }
                    } catch (e) {
                      console.error(e);
                    }
                  }}
                  disabled={isLocked}
                  className={`mt-1 w-full px-3 py-2 border rounded ${isLocked ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600">Supp Inv Date</label>
                <input
                  id="SuppInvDtInput"
                  type="date"
                  value={header.SuppInvDt}
                  onChange={(e) => {
                    if (isLocked) return;
                    setHeader({ ...header, SuppInvDt: e.target.value });
                    setHeaderErrors((prev) => ({ ...prev, SuppInvDt: '' }));
                  }}
                  disabled={isLocked}
                  className={`mt-1 w-full px-3 py-2 border rounded ${headerErrors.SuppInvDt ? 'border-red-500 ring-1 ring-red-300' : ''} ${isLocked ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                />
              </div>
              <div className="md:col-span-2">
                <div className="flex items-end justify-between gap-4">
                  <div className="flex-1">
                    <label className="block text-sm text-gray-600">Remark</label>
                    <input
                      type="text"
                      value={header.Remark}
                      onChange={(e) => { if (!isLocked) setHeader({ ...header, Remark: e.target.value }) }}
                      disabled={isLocked}
                      className={`mt-1 w-full px-3 py-2 border rounded ${isLocked ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                    />
                  </div>
                  <div className="flex items-center gap-2 mt-6">
                    <input
                      id="NoOverheadCheckbox"
                      type="checkbox"
                      checked={noOverhead}
                      disabled={!isPosted || header.Costconfirmed || isCancelled}
                      onChange={(e) => {
                        if (!isPosted || header.Costconfirmed || isCancelled) return;
                        setNoOverhead(e.target.checked);
                      }}
                      title={isLocked ? "Purchase is locked" : (isPosted ? "Confirm costing without any overhead" : "Post GRN to enable costing options") }
                    />
                    <label htmlFor="NoOverheadCheckbox" className="text-sm text-gray-700">
                      No Overhead
                    </label>
                    {noOverhead && isPosted && !header.Costconfirmed && !isCancelled && (
                      <button
                        type="button"
                        className="ml-2 px-3 py-2 text-sm border rounded bg-green-600 text-white hover:bg-green-700"
                        onClick={async () => {
                          if (!editingPurchase?.tranid) return;
                          try {
                            // Ensure header charges are zero and mark not prepared
                            await axios.put(`http://localhost:5000/api/purchase/${editingPurchase.tranid}/costing`, { rows: [] });
                            // Confirm with no items overhead
                            await axios.post(`http://localhost:5000/api/purchase/${editingPurchase.tranid}/costing/confirm`, { items: [] });
                            setHeader(h => ({ ...h, TptCharge: 0, LabCharge: 0, MiscCharge: 0, CostSheetPrepared: false, Costconfirmed: true }));
                            setNotice({ open: true, type: 'success', message: 'Costing confirmed with no overhead' });
                            await fetchPurchases();
                            fetchPurchases();
                          } catch (e) {
                            console.error(e);
                            setNotice({ open: true, type: 'error', message: 'Failed to confirm no-overhead costing' });
                          }
                        }}
                      >
                        Confirm No Overhead
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            

            {/* Items grid aligned to screenshot with tabs */}
            <div className="border rounded-lg">
              <div className="flex items-center justify-between p-2 bg-gray-100 rounded-t-lg">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className={`px-3 py-1 rounded text-sm ${itemTab === 'items' ? 'bg-white border' : 'text-gray-600'}`}
                    onClick={() => setItemTab('items')}
                  >
                    Items
                  </button>
                  {header.Costconfirmed && (
                    <button
                      type="button"
                      className={`px-3 py-1 rounded text-sm ${itemTab === 'costing' ? 'bg-white border' : 'text-gray-600'}`}
                      onClick={() => setItemTab('costing')}
                    >
                      Costing
                    </button>
                  )}
                </div>
                {itemTab === 'items' && (
                  <div className="flex gap-2">
                    <button type="button" onClick={async () => await addRow()} disabled={isLocked} className={`px-3 py-1 border rounded text-sm ${isLocked ? 'opacity-60 cursor-not-allowed' : ''}`}>Add Row</button>
                  </div>
                )}
              </div>
              <div className="overflow-x-auto">
                {itemTab === 'items' && (
                  <table className="w-full border-collapse min-w-[1100px]">
                    <thead className="bg-gray-50 text-left">
                      <tr>
                        <th className="p-2 border-b">Sr#</th>
                        <th className="p-2 border-b">Item Name / Code</th>
                        <th className="p-2 border-b">Unit</th>
                        <th className="p-2 border-b">Cost</th>
                        <th className="p-2 border-b">Qty</th>
                        <th className="p-2 border-b">Rate</th>
                        <th className="p-2 border-b">Tax'ble Val</th>
                        <th className="p-2 border-b text-center">CGST</th>
                        <th className="p-2 border-b text-center">SGST</th>
                        <th className="p-2 border-b text-center">IGST</th>
                        <th className="p-2 border-b text-center">GST %</th>
                        <th className="p-2 border-b text-center">Invoice Tot</th>
                        <th className="p-2 border-b text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((row, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="p-2 border-b w-12 text-center">{row.Srno}</td>
                          <td className="p-2 border-b w-56">
                            <div className="text-sm">
                              <div className="font-medium">{row.ItemName || row.ItemCode}</div>
                              <div className="text-gray-500 text-xs">{row.ItemCode}</div>
                            </div>
                          </td>
                          <td className="p-2 border-b w-20">
                            <input type="text" value={row.Unit || ''} onChange={(e)=> !isLocked && updateItem(idx, 'Unit', e.target.value)} disabled={isLocked} className={`w-full px-2 py-1 border rounded ${isLocked ? 'bg-gray-50 cursor-not-allowed' : ''}`} />
                          </td>
                          <td className="p-2 border-b w-24">
                            <input type="text" value={formatNumber(row.Rate)} onChange={(e)=> { if (!isLocked) updateItem(idx, 'Rate', parseNumber(e.target.value)) }} disabled={isLocked} className={`w-full px-2 py-1 border rounded text-right ${isLocked ? 'bg-gray-50 cursor-not-allowed' : ''}`} />
                          </td>
                          <td className="p-2 border-b w-20">
                            <input 
                              type="number"
                              step="0.01"
                              inputMode="decimal"
                              value={row.Qty}
                              onChange={(e)=> {
                                if (isPosted) return;
                                const val = e.target.value;
                                const num = val === '' ? 0 : parseFloat(val);
                                updateItem(idx, 'Qty', isNaN(num) ? 0 : num)
                              }} 
                              disabled={isLocked}
                              className={`w-full px-2 py-1 border rounded text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${isLocked ? 'bg-gray-50 cursor-not-allowed' : ''}`} 
                            />
                          </td>
                          <td className="p-2 border-b w-24">
                            <input type="text" value={formatNumber(row.NetRate)} onChange={(e)=> { if (!isLocked) updateItem(idx, 'NetRate', parseNumber(e.target.value)) }} disabled={isLocked} className={`w-full px-2 py-1 border rounded text-right ${isLocked ? 'bg-gray-50 cursor-not-allowed' : ''}`} />
                          </td>
                          <td className="p-2 border-b w-28 text-right">{formatNumber(n(row.InvAmount).toFixed(2))}</td>
                          <td className="p-2 border-b w-28 text-right">{formatNumber(n(row.CGSTAmount).toFixed(2))}</td>
                          <td className="p-2 border-b w-28 text-right">{formatNumber(n(row.SGSTAmout).toFixed(2))}</td>
                          <td className="p-2 border-b w-28 text-right">{formatNumber(n(row.IGSTAmount).toFixed(2))}</td>
                          <td className="p-2 border-b w-24 text-center">
                            <span className="text-sm text-gray-700">
                              {(() => {
                                const totalGst = n(row.CGSTPer) + n(row.SGSTPer) + n(row.IGSTPer);
                                return totalGst ? `${totalGst.toFixed(2)}%` : '-';
                              })()}
                            </span>
                          </td>
                          <td className="p-2 border-b w-28 text-right">{formatNumber(n(row.GTotal).toFixed(2))}</td>
                          <td className="p-2 border-b text-right">
                            <button type="button" onClick={() => { if (!isLocked) removeRow(idx) }} disabled={isLocked} className={`text-red-600 hover:underline ${isLocked ? 'opacity-60 cursor-not-allowed' : ''}`}>Remove</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 font-semibold">
                        <td className="p-2 border-t" colSpan="4">Totals</td>
                        <td className="p-2 border-t text-right">{formatNumber(items.reduce((a, r) => a + n(r.Qty), 0).toFixed(2))}</td>
                        <td className="p-2 border-t"></td>
                        <td className="p-2 border-t"></td>
                        <td className="p-2 border-t text-right">{formatNumber(items.reduce((a, r) => a + n(r.CGSTAmount), 0).toFixed(2))}</td>
                        <td className="p-2 border-t text-right">{formatNumber(items.reduce((a, r) => a + n(r.SGSTAmout), 0).toFixed(2))}</td>
                        <td className="p-2 border-t text-right">{formatNumber(items.reduce((a, r) => a + n(r.IGSTAmount), 0).toFixed(2))}</td>
                        <td className="p-2 border-t text-center">
                          <span className="text-sm text-gray-700">
                            {items.length ? `${(
                              items.reduce((acc, row) => acc + n(row.CGSTPer) + n(row.SGSTPer) + n(row.IGSTPer), 0) /
                              items.length
                            ).toFixed(2)}%` : '-'}
                          </span>
                        </td>
                        <td className="p-2 border-t text-right">{formatNumber(items.reduce((a, r) => a + n(r.GTotal), 0).toFixed(2))}</td>
                        <td className="p-2 border-t"></td>
                      </tr>
                    </tfoot>
                  </table>
                )}

                {itemTab === 'costing' && (
                  <table className="w-full border-collapse min-w-[900px]">
                    <thead className="bg-gray-50 text-left">
                      <tr>
                        <th className="p-2 border-b">Item</th>
                        <th className="p-2 border-b text-right">Qty</th>
                        <th className="p-2 border-b text-right">Rate</th>
                        <th className="p-2 border-b text-right">Inv Amt</th>
                        <th className="p-2 border-b text-right">OH Amt</th>
                        <th className="p-2 border-b text-right">Net Rate</th>
                        <th className="p-2 border-b text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((r, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="p-2 border-b">{r.ItemName || r.ItemCode}</td>
                          <td className="p-2 border-b text-right">{formatNumber(n(r.Qty).toFixed(2))}</td>
                          <td className="p-2 border-b text-right">{formatNumber(n(r.Rate).toFixed(2))}</td>
                          <td className="p-2 border-b text-right">{formatNumber(n(r.InvAmount).toFixed(2))}</td>
                          <td className="p-2 border-b text-right">{formatNumber(n(r.OHAmt).toFixed(2))}</td>
                          <td className="p-2 border-b text-right">{formatNumber(n(r.NetRate).toFixed(2))}</td>
                          <td className="p-2 border-b text-right">{formatNumber(n(r.GTotal).toFixed(2))}</td>
                        </tr>
                      ))}
                      {items.length === 0 && (
                        <tr>
                          <td className="p-2" colSpan="7">No items</td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 font-semibold">
                        <td className="p-2 text-right">Totals</td>
                        <td className="p-2"></td>
                        <td className="p-2"></td>
                        <td className="p-2 text-right">{formatNumber(items.reduce((a, r) => a + n(r.InvAmount), 0).toFixed(2))}</td>
                        <td className="p-2 text-right">{formatNumber(items.reduce((a, r) => a + n(r.OHAmt), 0).toFixed(2))}</td>
                        <td className="p-2"></td>
                        <td className="p-2 text-right">{formatNumber(items.reduce((a, r) => a + n(r.GTotal), 0).toFixed(2))}</td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            </div>

            {/* Totals panel like screenshot */
            }
            <div className="flex justify-end">
              <div className="w-full md:w-96 border rounded p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm">Taxable Total</div>
                  <div className="font-semibold">{formatNumber(n(header.InvAmt).toFixed(2))}</div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm">Total GST</div>
                  <div className="font-semibold">{formatNumber((n(header.CGST)+n(header.SGST)+n(header.IGST)).toFixed(2))}</div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm">Total Amount (after IGST)</div>
                  <div className="font-semibold">{formatNumber((n(header.InvAmt)+n(header.CGST)+n(header.SGST)+n(header.IGST)).toFixed(2))}</div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm">Rounded Off</div>
                  <input 
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    value={header.Rounded}
                    onChange={(e) => {
                      if (isPosted) return;
                      const val = e.target.value;
                      const num = val === '' ? 0 : parseFloat(val);
                      setHeader({...header, Rounded: isNaN(num) ? 0 : num});
                    }}
                    disabled={isLocked}
                    className={`w-28 px-2 py-1 border rounded text-right font-semibold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${isLocked ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                  />
                </div>
                <div className="flex items-center justify-between border-t pt-2">
                  <div className="font-semibold">Grand Total</div>
                  <div className="font-bold">{formatNumber((n(header.InvAmt)+n(header.CGST)+n(header.SGST)+n(header.IGST)+n(header.Rounded)).toFixed(2))}</div>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
      
      {/* Enhanced Item Selection Modal */}
      {showItemModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-lg shadow-lg w-full max-w-7xl max-h-[95vh] flex flex-col"
          >
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">Add Item to Purchase</h2>
              <button 
                onClick={() => setShowItemModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="flex flex-1 overflow-hidden">
              {/* Left Panel - Item Selection */}
              <div className="w-1/2 border-r flex flex-col">
                <div className="p-4 border-b">
                  <input
                    type="text"
                    placeholder="Search by Item Name (contains)"
                    value={itemSearchTerm}
                    onChange={(e) => { setItemSearchTerm(e.target.value); setHighlightIndex(0); }}
                    onKeyDown={handleListKeyDown}
                    className="w-full px-4 py-2 border rounded-lg"
                    autoFocus
                    ref={searchInputRef}
                  />
                </div>
                
                <div className="overflow-y-auto flex-grow" ref={listRef} tabIndex={0} onKeyDown={handleListKeyDown}>
                  <table className="w-full border-collapse">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="p-2 text-left border-b">Code</th>
                        <th className="p-2 text-left border-b">Name</th>
                        <th className="p-2 text-right border-b">Stock</th>
                        <th className="p-2 text-right border-b">Avg. Cost</th>
                        <th className="p-2 text-right border-b">S. Price</th>
                        <th className="p-2 text-right border-b">MRP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredItems.length > 0 ? (
                        filteredItems.map((item, idx) => (
                          <tr
                            id={`item-row-${idx}`}
                            key={item.itemcode}
                            className={`hover:bg-indigo-50 ${idx === highlightIndex ? 'bg-indigo-100' : ''}`}
                            onDoubleClick={() => selectItemInModal(item)}
                            onClick={() => setHighlightIndex(idx)}
                          >
                            <td className="p-2 border-b">{item.itemcode}</td>
                            <td className="p-2 border-b">{item.itemname}</td>
                            <td className="p-2 border-b text-right">{formatNumber(item.curstock || 0)}</td>
                            <td className="p-2 border-b text-right">{formatNumber(item.cost)}</td>
                            <td className="p-2 border-b text-right">{formatNumber(item.sprice || 0)}</td>
                            <td className="p-2 border-b text-right">{formatNumber(item.mrp || 0)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="4" className="p-8 text-center text-gray-500">No items found</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right Panel - Item Details & Entry */}
              <div className="w-1/2 flex flex-col">
                {selectedItem ? (
                  <>
                    <div className="p-4 border-b space-y-4">
                      {/* Line 1: Item Name expanded and 2-line aligned to input grid */}
                      <div className="flex items-start gap-2">
                        <label className="text-sm font-medium inline-block w-20 pt-2">Item</label>
                        <textarea
                          value={selectedItem.itemname || ''}
                          readOnly
                          rows={2}
                          className="px-3 py-2 border rounded resize-none leading-snug -ml-[2ch] w-[calc(47ch+13rem)]"
                        />
                      </div>

                      {/* Line 2: Code, Unit, Stock */}
                      <div className="grid grid-cols-3 gap-4 text-sm items-center hidden">
                        <div className="flex items-center gap-2">
                          <label className="font-medium w-20">Code</label>
                          <input type="text" value={selectedItem.itemcode || ''} readOnly className="px-2 py-1 border rounded w-[15ch]" />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="font-medium w-20">Unit</label>
                          <input type="text" value={selectedItem.unit || '-'} readOnly className="px-2 py-1 border rounded w-[15ch]" />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="font-medium w-20">Stock</label>
                          <input type="text" value={formatNumber(selectedItem.curstock ?? 0)} readOnly className="px-2 py-1 border rounded font-semibold w-[15ch] text-right" />
                        </div>
                      </div>

                      {/* Line 3: Cost, Selling Price, MRP */}
                      <div className="grid grid-cols-3 gap-4 text-sm items-center">
                        <div className="flex items-center gap-2">
                          <label className="font-medium w-20">Cost</label>
                          <input type="text" value={formatNumber(selectedItem.cost ?? 0)} readOnly className="px-2 py-1 border rounded w-[15ch] text-right" />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="font-medium w-20">S.Price</label>
                          <input type="text" value={formatNumber(selectedItem.sprice ?? '')} readOnly className="px-2 py-1 border rounded w-[15ch] text-right" />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="font-medium w-20">MRP</label>
                          <input type="text" value={formatNumber(selectedItem.mrp ?? '')} readOnly className="px-2 py-1 border rounded w-[15ch] text-right" />
                        </div>
                      </div>

                      {/* Line 4: SGST, CGST, IGST (editable) */}
                      <div className="grid grid-cols-3 gap-4 text-sm items-center">
                        <div className="flex items-center gap-2">
                          <label className="font-medium w-20">SGST %</label>
                          <input
                            type="text"
                            value={formatNumber(modalItemData.SGSTPer)}
                            onChange={(e) => calculateModalTotals(selectedItem, modalItemData.Qty, modalItemData.Rate, modalItemData.CGSTPer, parseNumber(e.target.value), modalItemData.IGSTPer)}
                            className="px-2 py-1 border rounded w-[15ch] text-right"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="font-medium w-20">CGST %</label>
                          <input
                            type="text"
                            value={formatNumber(modalItemData.CGSTPer)}
                            onChange={(e) => calculateModalTotals(selectedItem, modalItemData.Qty, modalItemData.Rate, parseNumber(e.target.value), modalItemData.SGSTPer, modalItemData.IGSTPer)}
                            className="px-2 py-1 border rounded w-[15ch] text-right"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="font-medium w-20">IGST %</label>
                          <input
                            type="text"
                            value={formatNumber(modalItemData.IGSTPer)}
                            onChange={(e) => calculateModalTotals(selectedItem, modalItemData.Qty, modalItemData.Rate, modalItemData.CGSTPer, modalItemData.SGSTPer, parseNumber(e.target.value))}
                            className="px-2 py-1 border rounded w-[15ch] text-right"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="p-4 flex-grow">
                      <h3 className="font-semibold text-lg mb-4">Enter Quantity & Rate</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center gap-2">
                          <label className="text-sm font-medium w-24">Quantity</label>
                          <input
                            ref={qtyInputRef}
                            type="number"
                            step="0.01"
                            inputMode="decimal"
                            value={modalItemData.Qty}
                            onChange={(e) => {
                              const val = e.target.value;
                              const num = val === '' ? 0 : parseFloat(val);
                              calculateModalTotals(
                                selectedItem,
                                isNaN(num) ? 0 : num,
                                modalItemData.Rate,
                                modalItemData.CGSTPer,
                                modalItemData.SGSTPer,
                                modalItemData.IGSTPer
                              );
                            }}
                            onFocus={(e) => e.target.select()}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === 'Tab') {
                                e.preventDefault();
                                if (rateInputRef.current) {
                                  rateInputRef.current.focus();
                                  rateInputRef.current.select();
                                }
                              }
                            }}
                            className="flex-1 px-3 py-2 border rounded text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-sm font-medium w-24">Rate</label>
                          <input
                            ref={rateInputRef}
                            type="number"
                            step="0.01"
                            inputMode="decimal"
                            value={modalItemData.Rate}
                            onChange={(e) => {
                              const val = e.target.value;
                              const num = val === '' ? 0 : parseFloat(val);
                              calculateModalTotals(
                                selectedItem,
                                modalItemData.Qty,
                                isNaN(num) ? 0 : num,
                                modalItemData.CGSTPer,
                                modalItemData.SGSTPer,
                                modalItemData.IGSTPer
                              );
                            }}
                            onFocus={(e) => e.target.select()}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === 'Tab') {
                                e.preventDefault();
                                if (saveAddNewRef.current) {
                                  saveAddNewRef.current.focus();
                                }
                              }
                            }}
                            className="flex-1 px-3 py-2 border rounded text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </div>
                      </div>

                      <div className="mt-6 p-4 bg-gray-50 rounded">
                        <h4 className="font-semibold mb-3">Calculated Values</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Taxable Value:</span>
                            <span className="font-medium">{modalItemData.InvAmount.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>CGST Amount ({modalItemData.CGSTPer}%):</span>
                            <span className="font-medium">{modalItemData.CGSTAmount.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>SGST Amount ({modalItemData.SGSTPer}%):</span>
                            <span className="font-medium">{modalItemData.SGSTAmount.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>IGST Amount ({modalItemData.IGSTPer}%):</span>
                            <span className="font-medium">{modalItemData.IGSTAmount.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between border-t pt-2 font-semibold text-base">
                            <span>Total Value:</span>
                            <span>{modalItemData.GTotal.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-grow flex items-center justify-center text-gray-500">
                    <div className="text-center">
                      <p className="text-lg">Select an item from the list</p>
                      <p className="text-sm">to enter quantity and rate</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-4 border-t flex justify-end gap-2">
              <button
                onClick={() => setShowItemModal(false)}
                className="px-4 py-2 border rounded-lg"
              >
                Cancel
              </button>
              {selectedItem && (
                <>
                  <button
                    ref={saveAddNewRef}
                    onClick={addItemAndContinue}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Save & Add New
                  </button>
                  <button
                    onClick={addItemToForm}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    Save & Close
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}