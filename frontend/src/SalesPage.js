import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import { validateTransactionDate, getDefaultTransactionDate } from "./utils/accountingPeriodUtils";
import API_BASE_URL from "./config/api";

// Helpers
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
const parseNumber = (val) => {
  if (val === null || val === undefined || val === '') return 0;
  const num = Number(String(val).replace(/,/g, ''));
  return isNaN(num) ? 0 : num;
};
const dateToInput = (val) => {
  if (!val) return "";
  const d = new Date(val);
  if (isNaN(d)) return "";
  const tzOff = d.getTimezoneOffset();
  const local = new Date(d.getTime() - tzOff * 60000);
  return local.toISOString().slice(0, 10);
};

export default function SalesPage() {
  // List state
  const [sales, setSales] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage] = useState(50);
  const [selectedIds, setSelectedIds] = useState(new Set());
  
  // Sorting state
  const [sortField, setSortField] = useState('invdate');
  const [sortDirection, setSortDirection] = useState('desc');


  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null); // { tranid }
  const [saving, setSaving] = useState(false);
  // Validation and notice (match purchase pattern)
  const [headerErrors, setHeaderErrors] = useState({});
  const [notice, setNotice] = useState({ open: false, type: 'error', message: '' });
  useEffect(() => {
    if (!notice.open) return;
    const timer = setTimeout(() => {
      setNotice({ open: false, type: 'error', message: '' });
    }, 3000);
    return () => clearTimeout(timer);
  }, [notice.open]);

  // Master data
  const [customers, setCustomers] = useState([]); // PartyType = 1 (assuming 1=Customer)
  const [allItems, setAllItems] = useState([]);

  // Header
  const [header, setHeader] = useState({
    FYearID: "",
    InvNo: "",
    InvDate: "",
    RefNo: "",
    PartyID: "",
    Customer_Name: "",
    AccountID: "",
    TaxableTot: 0,
    DisPerc: 0,
    DisAmt: 0,
    MiscPerAdd: 0,
    MiscAmtAdd: 0,
    TotAvgCost: 0,
    TotAmount: 0,
    CGST_Amount: 0,
    SGST_Amount: 0,
    IGST_Amount: 0,
    Remark: "",
    Is_Posted: false,
    Rounded: 0,       // UI-only rounded off
    GrandTotal: 0,    // UI-only computed total
  });

  // Details (simplified)
  const [items, setItems] = useState([]);

  // Item modal - upgraded to match Purchase
  const [showItemModal, setShowItemModal] = useState(false);
  const [itemSearch, setItemSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [modalItemData, setModalItemData] = useState({
    Qty: 1,
    Rate: 0,        // Gross rate (inclusive of GST)
    BaseRate: 0,    // Computed pre-tax rate
    CGSTPer: 0,
    SGSTPer: 0,
    IGSTPer: 0,
    Taxable: 0,
    CGST: 0,
    SGST: 0,
    IGST: 0,
    Total: 0,
  });
  const qtyRef = useRef(null);
  const rateRef = useRef(null);
  const saveAddNewRef = useRef(null);
  const listRef = useRef(null);
  const searchInputRef = useRef(null);

  const filteredItems = useMemo(() => {
    const q = (itemSearch || '').trim().toLowerCase();
    const tokens = q.split(/\s+/).filter(Boolean);
    const list = (allItems || []).filter(it => {
      if (tokens.length === 0) return true;
      const name = String(it.itemname || '').toLowerCase();
      return tokens.every(t => name.includes(t));
    });
    return list.slice(0, 100);
  }, [allItems, itemSearch]);

  const ensureRowVisible = (idx) => {
    const el = document.getElementById(`sale-item-row-${idx}`);
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
      if (chosen) onPickItem(chosen);
    }
  };

  useEffect(() => {
    if (showItemModal && selectedItem) {
      setTimeout(() => {
        qtyRef.current?.focus();
        qtyRef.current?.select();
      }, 0);
    }
  }, [showItemModal, selectedItem]);

  // Load list + masters
  const fetchSales = async () => {
    try {
      const params = {};
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      
      // Add financial year filter - critical for data isolation
      const selectedFYearID = localStorage.getItem("selectedFYearID");
      if (selectedFYearID) {
        params.fyearId = selectedFYearID;
      }
      
      const r = await axios.get(`${API_BASE_URL}/api/sales`, { params });
      const raw = r.data || [];
      // Map API snake_case to UI-friendly fields
      const mapped = raw.map(x => ({
        tranid: x.inv_master_id,
        invno: x.inv_no,
        invdate: x.inv_date,
        customername: x.customer_name ?? '',
        taxabletot: x.taxable_tot ?? 0,
        cgst: x.cgst_amount ?? 0,
        sgst: x.sgst_amount ?? 0,
        igst: x.igst_amount ?? 0,
        totamount: x.tot_amount ?? 0,
        is_posted: !!x.is_posted,
      }));
      setSales(mapped);
    } catch (e) {
      console.error(e);
    }
  };
  const fetchCustomers = async () => {
    try {
      const r = await axios.get(`${API_BASE_URL}/api/party/all`);
      const onlyCustomers = (r.data || []).filter(p => parseInt(p.partytype ?? 0, 10) === 1);
      setCustomers(onlyCustomers.sort((a,b)=>String(a.partyname||'').localeCompare(String(b.partyname||''), undefined, {sensitivity: 'base'})));
    } catch(e){ console.error(e); }
  };
  const fetchItems = async () => {
    try {
      const r = await axios.get(`${API_BASE_URL}/api/items/all`);
      setAllItems(r.data || []);
    } catch(e){ console.error(e);} 
  };

  useEffect(()=>{ fetchSales(); fetchCustomers(); fetchItems(); },[]);
  useEffect(()=>{ setCurrentPage(1); }, [searchTerm, fromDate, toDate]);

  const handleNewInvoice = async () => {
    const selectedFYearID = localStorage.getItem("selectedFYearID");
    if (!selectedFYearID) {
      alert('Select accounting period first');
      return;
    }
    await resetForm();
    // Show placeholder 'NEW' immediately; actual number assigned on save
    setHeader(h => ({ ...h, FYearID: selectedFYearID, InvNo: 'NEW' }));
    setShowForm(true);
  };

  // Auto-generate next InvNo using backend endpoint (atomic)
  const generateNextInvNo = async () => {
    try {
      const selectedFYearID = localStorage.getItem("selectedFYearID");
      const params = selectedFYearID ? { params: { fyearId: selectedFYearID } } : {};
      const r = await axios.get(`${API_BASE_URL}/api/sales/next-invno`, params);
      const next = r.data?.next_inv_no || "1";
      setHeader(h => ({ ...h, FYearID: selectedFYearID || h.FYearID, InvNo: String(next) }));
    } catch (e) {
      console.error(e);
      // Fallback to list-based computation if endpoint fails
      try {
        const r2 = await axios.get(`${API_BASE_URL}/api/sales`);
        const list = r2.data || [];
        const nums = list.map(s => parseInt(String(s.inv_no ?? s.invno ?? s.invNo ?? "").replace(/[^0-9]/g, ""), 10)).filter(n=>!isNaN(n));
        const last = nums.length ? Math.max(...nums) : 0;
        setHeader(h => ({ ...h, InvNo: String(last + 1) }));
      } catch (e2) {
        setHeader(h => ({ ...h, InvNo: "1" }));
      }
    }
  };

  // When opening form in add mode, keep 'NEW' as placeholder (avoid pre-allocating numbers)
  useEffect(() => {
    if (showForm && !editing?.tranid) {
      // Do not prefetch number here to avoid gaps in multi-user scenarios.
      setHeader(h => ({ ...h, InvNo: h.InvNo || 'NEW' }));
    }
  }, [showForm, editing]);

  // Helpers to map header UI <-> API payload (snake_case)
  const mapHeaderToApi = (h, { post } = {}) => ({
    fyear_id: h.FYearID,
    inv_no: h.InvNo,
    inv_date: h.InvDate,
    ref_no: h.RefNo,
    party_id: h.PartyID,
    customer_name: h.Customer_Name,
    account_id: h.AccountID,
    taxable_tot: n(h.TaxableTot),
    dis_perc: n(h.DisPerc),
    dis_amount: n(h.DisAmt),
    misc_per_add: n(h.MiscPerAdd),
    misc_amount_add: n(h.MiscAmtAdd),
    tot_avg_cost: n(h.TotAvgCost),
    tot_amount: n(h.TotAmount),
    rounded_off: n(h.Rounded),
    cgst_amount: n(h.CGST_Amount),
    sgst_amount: n(h.SGST_Amount),
    igst_amount: n(h.IGST_Amount),
    description: h.Remark || '',
    is_posted: !!post || !!h.Is_Posted,
    is_deleted: false,
  });

  const mapItemToApi = (r, fyearId) => ({
    fyear_id: fyearId,
    srno: r.Srno,
    itemcode: r.ItemCode,
    unit: r.Unit,
    qty: n(r.Qty),
    avg_cost: n(r.AvgCost),
    taxable_rate: n(r.TaxableRate),
    cgst_per: n(r.CGST_Per),
    sgst_per: n(r.SGST_Per),
    igst_per: n(r.IGST_Per),
    cgst_amount: n(r.CGST_Amount),
    sgst_amount: n(r.SGST_Amount),
    igst_amount: n(r.IGST_Amount),
    rate: n(r.Rate),
    dis_per: n(r.DisPer),
    dis_amount: n(r.DisAmt),
    tot_amount: n(r.TotAmt),
    description: r.Remark || '',
    is_deleted: false,
  });

  // Sorting function
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // List filtering + sorting + paging
  const filtered = useMemo(()=>{
    const q = (searchTerm||'').toLowerCase();
    let result = (sales||[]).filter(s => String(s.invno||'').includes(q) || String(s.customername||'').toLowerCase().includes(q));
    
    // Apply sorting
    result.sort((a, b) => {
      let aVal, bVal;
      
      switch (sortField) {
        case 'invno':
          // Extract numeric part from invoice number for proper numeric sorting
          aVal = parseInt(String(a.invno || '0').replace(/[^0-9]/g, ''), 10) || 0;
          bVal = parseInt(String(b.invno || '0').replace(/[^0-9]/g, ''), 10) || 0;
          break;
        case 'invdate':
          aVal = new Date(a.invdate || 0);
          bVal = new Date(b.invdate || 0);
          break;
        case 'customername':
          aVal = String(a.customername || '').toLowerCase();
          bVal = String(b.customername || '').toLowerCase();
          break;
        case 'taxabletot':
          aVal = Number(a.taxabletot || 0);
          bVal = Number(b.taxabletot || 0);
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
        case 'totamount':
          aVal = Number(a.totamount || 0);
          bVal = Number(b.totamount || 0);
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
  }, [sales, searchTerm, sortField, sortDirection]);
  const totalRecords = filtered.length;
  const totalPages = Math.ceil(totalRecords / recordsPerPage) || 1;
  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = startIndex + recordsPerPage;
  const currentRecords = filtered.slice(startIndex, endIndex);

  // Selection helpers
  const allCurrentIds = useMemo(() => new Set(currentRecords.map(r => r.tranid)), [currentRecords]);
  const allSelectedOnPage = useMemo(() => currentRecords.length > 0 && currentRecords.every(r => selectedIds.has(r.tranid)), [currentRecords, selectedIds]);
  const anySelectedOnPage = useMemo(() => currentRecords.some(r => selectedIds.has(r.tranid)), [currentRecords, selectedIds]);
  const toggleSelectAllOnPage = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allSelectedOnPage) {
        // Unselect all rows on the current page
        currentRecords.forEach(r => next.delete(r.tranid));
      } else {
        // Select all rows on the current page
        currentRecords.forEach(r => next.add(r.tranid));
      }
      return next;
    });
  };
  const toggleRow = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Detail helpers
  const recalcItem = (row) => {
    const qty = n(row.Qty);
    const rate = n(row.Rate);
    const taxable = qty * rate;
    const cgst = taxable * n(row.CGST_Per) / 100;
    const sgst = taxable * n(row.SGST_Per) / 100;
    const igst = taxable * n(row.IGST_Per) / 100;
    const tot = taxable + cgst + sgst + igst - n(row.DisAmt);

    // Ensure AvgCost represents TOTAL avg cost for the line (qty * unitAvgCost)
    const unitAvgCost = row.UnitAvgCost != null ? n(row.UnitAvgCost) : (qty > 0 ? n(row.AvgCost) / qty : 0);
    const lineAvgCost = qty * unitAvgCost;

    return {
      ...row, // keep Srno and other fields intact
      UnitAvgCost: Number(unitAvgCost.toFixed(6)),
      AvgCost: Number(lineAvgCost.toFixed(2)), // store total avg cost for this line
      TaxableRate: Number(taxable.toFixed(2)),
      CGST_Amount: Number(cgst.toFixed(2)),
      SGST_Amount: Number(sgst.toFixed(2)),
      IGST_Amount: Number(igst.toFixed(2)),
      TotAmt: Number(tot.toFixed(2)),
    };
  };

  // Calculate modal preview totals
  const calculateModalTotals = (item, qty, rateGross, cgstPer, sgstPer, igstPer) => {
    const quantity = n(qty);
    const rateInc = n(rateGross); // user-entered gross (inclusive) rate
    const cgstPercent = n(cgstPer);
    const sgstPercent = n(sgstPer);
    const igstPercent = n(igstPer);
    const totalGSTPercent = cgstPercent + sgstPercent + igstPercent;
    const divisor = 1 + (totalGSTPercent / 100);
    const baseRate = divisor > 0 ? rateInc / divisor : rateInc; // pre-tax rate

    const taxable = quantity * baseRate;
    const cgst = taxable * cgstPercent / 100;
    const sgst = taxable * sgstPercent / 100;
    const igst = taxable * igstPercent / 100;
    const total = taxable + cgst + sgst + igst; // should be close to quantity * rateInc

    setModalItemData(prev => ({
      ...prev,
      Qty: quantity,
      Rate: rateInc,      // keep gross in the input
      BaseRate: Number(baseRate.toFixed(6)),
      CGSTPer: cgstPercent,
      SGSTPer: sgstPercent,
      IGSTPer: igstPercent,
      Taxable: Number(taxable.toFixed(2)),
      CGST: Number(cgst.toFixed(2)),
      SGST: Number(sgst.toFixed(2)),
      IGST: Number(igst.toFixed(2)),
      Total: Number(total.toFixed(2)),
    }));
  };

  const selectItemInModal = (it) => {
    setSelectedItem(it);
    const gross = n(it.sprice || it.mrp || 0);
    const cg = n(it.cgst || 0), sg = n(it.sgst || 0), ig = n(it.igst || 0);
    setModalItemData({
      Qty: 1,
      Rate: gross,
      BaseRate: 0,
      CGSTPer: cg,
      SGSTPer: sg,
      IGSTPer: ig,
      Taxable: 0,
      CGST: 0,
      SGST: 0,
      IGST: 0,
      Total: 0,
    });
    calculateModalTotals(it, 1, gross, cg, sg, ig);
  };

  const addItemAndContinue = () => {
    if (!selectedItem) return;
    // Use BaseRate (pre-tax) for calculations; Rate is gross in modal
    const rowPre = {
      Srno: items.length + 1,
      ItemCode: selectedItem.itemcode,
      Unit: selectedItem.unit || '',
      Qty: n(modalItemData.Qty),
      Rate: n(modalItemData.BaseRate), // store base rate (pre-tax)
      UnitAvgCost: n(selectedItem.avgcost || 0), // per-unit avg cost from item master
      AvgCost: n(selectedItem.avgcost || 0),     // will be converted to line total in recalc
      CGST_Per: n(modalItemData.CGSTPer),
      SGST_Per: n(modalItemData.SGSTPer),
      IGST_Per: n(modalItemData.IGSTPer),
      DisPer: 0,
      DisAmt: 0,
      Remark: '',
      Deleted: false,
    };
    const row = recalcItem(rowPre);
    const next = [...items, row];
    setItems(next);
    applyHeaderTotals(next);
    // Reset selection but keep modal open for next add
    setSelectedItem(null);
    setModalItemData({ Qty: 1, Rate: 0, BaseRate: 0, CGSTPer: 0, SGSTPer: 0, IGSTPer: 0, Taxable: 0, CGST: 0, SGST: 0, IGST: 0, Total: 0 });
    setHighlightIndex(0);
    setTimeout(()=> searchInputRef.current?.focus(), 0);
  };

  const addItemToForm = () => {
    if (!selectedItem) return;
    // Use BaseRate (pre-tax) for calculations; Rate is gross in modal
    const rowPre = {
      Srno: items.length + 1,
      ItemCode: selectedItem.itemcode,
      Unit: selectedItem.unit || '',
      Qty: n(modalItemData.Qty),
      Rate: n(modalItemData.BaseRate), // store base rate (pre-tax)
      UnitAvgCost: n(selectedItem.avgcost || 0), // per-unit avg cost from item master
      AvgCost: n(selectedItem.avgcost || 0),     // will be converted to line total in recalc
      CGST_Per: n(modalItemData.CGSTPer),
      SGST_Per: n(modalItemData.SGSTPer),
      IGST_Per: n(modalItemData.IGSTPer),
      DisPer: 0,
      DisAmt: 0,
      Remark: '',
      Deleted: false,
    };
    const row = recalcItem(rowPre);
    const next = [...items, row];
    setItems(next);
    applyHeaderTotals(next);
    setShowItemModal(false);
  };
  const applyHeaderTotals = (rows) => {
    const sum = (fn) => rows.reduce((a,r)=>a + n(fn(r)), 0);
    const TaxableTot = Number(sum(r=>r.TaxableRate).toFixed(2));
    const CGST_Amount = Number(sum(r=>r.CGST_Amount).toFixed(2));
    const SGST_Amount = Number(sum(r=>r.SGST_Amount).toFixed(2));
    const IGST_Amount = Number(sum(r=>r.IGST_Amount).toFixed(2));
    // Compute total from components to avoid per-line rounding drift
    const TotAmount = Number((TaxableTot + CGST_Amount + SGST_Amount + IGST_Amount).toFixed(2));
    const TotAvgCost = Number(sum(r=>r.AvgCost).toFixed(2));
    // Rounded off and Grand Total like Purchase
    const Rounded = n(header.Rounded || 0);
    const GrandTotal = Number((TotAmount + Rounded).toFixed(2));
    setHeader(h => ({ ...h, TaxableTot, CGST_Amount, SGST_Amount, IGST_Amount, TotAmount, TotAvgCost, Rounded, GrandTotal }));
  };

  const addRow = () => {
    setSelectedItem(null);
    setItemSearch("");
    setHighlightIndex(0);
    setModalItemData({ Qty: 1, Rate: 0, CGSTPer: 0, SGSTPer: 0, IGSTPer: 0, Taxable: 0, CGST: 0, SGST: 0, IGST: 0, Total: 0 });
    setShowItemModal(true);
    setTimeout(()=> searchInputRef.current?.focus(), 0);
  };
  const onPickItem = (it) => {
    selectItemInModal(it);
  };
  const addPickedItem = (qty = 1, rateFromItem = null) => {
    if (!selectedItem) return;
    const gross = rateFromItem != null ? n(rateFromItem) : n(selectedItem.sprice || selectedItem.mrp || 0);
    const cg = n(selectedItem.cgst || 0), sg = n(selectedItem.sgst || 0), ig = n(selectedItem.igst || 0);
    const divisor = 1 + ((cg + sg + ig) / 100);
    const baseRate = divisor > 0 ? gross / divisor : gross;
    const rowPre = {
      Srno: items.length + 1,
      ItemCode: selectedItem.itemcode,
      Unit: selectedItem.unit || '',
      Qty: n(qty),
      Rate: n(baseRate),
      AvgCost: n(selectedItem.avgcost || 0),
      CGST_Per: cg,
      SGST_Per: sg,
      IGST_Per: ig,
      DisPer: 0,
      DisAmt: 0,
      Remark: '',
      Deleted: false,
    };
    const row = recalcItem(rowPre);
    const next = [...items, row];
    setItems(next);
    applyHeaderTotals(next);
    setShowItemModal(false);
  };
  const removeRow = (idx) => {
    const next = items.filter((_,i)=>i!==idx).map((r, i2) => ({ ...r, Srno: i2 + 1 }));
    setItems(next);
    applyHeaderTotals(next);
  };
  const updateItem = (idx, field, val) => {
    const next = items.map((r,i)=> i===idx ? recalcItem({ ...r, [field]: val }) : r)
                      .map((r, i2) => ({ ...r, Srno: i2 + 1 }));
    setItems(next);
    applyHeaderTotals(next);
  };

  // Save
  const handleSave = async ({ post = false } = {}) => {
    const selectedFYearID = localStorage.getItem("selectedFYearID");
    if (!selectedFYearID) { setNotice({ open:true, type:'error', message:'Select accounting period first' }); return; }
    const errs = {};
    // Allow 'NEW' placeholder; backend will assign actual number
    if (!String(header.InvNo).trim()) errs.InvNo = 'Invoice No will be auto-generated';
    if (!String(header.InvDate).trim()) {
      errs.InvDate = 'Invoice Date required';
    } else {
      // Validate transaction date against accounting period
      try {
        const validation = await validateTransactionDate(header.InvDate);
        console.log('Date validation result:', validation);
        if (!validation.isValid) {
          errs.InvDate = validation.message;
          console.log('Date validation failed - blocking save:', validation.message);
        } else {
          console.log('Date validation passed');
        }
      } catch (error) {
        errs.InvDate = 'Error validating transaction date';
        console.error('Date validation error:', error);
      }
    }
    if (!String(header.PartyID).trim()) errs.PartyID = 'Customer required';
    
    // Remove auto-generated field from blocking save
    if (errs.InvNo) delete errs.InvNo;
    
    setHeaderErrors(errs);
    console.log('Validation errors:', errs);
    
    if (Object.keys(errs).length > 0) {
      const firstError = Object.values(errs)[0];
      setNotice({ open:true, type:'error', message: firstError });
      return;
    }
    const rowsToSave = (items||[]).filter(r => r.ItemCode && n(r.Qty) > 0);
    if (rowsToSave.length === 0) { setNotice({ open:true, type:'error', message:'Add at least one item' }); return; }

    // Final safety check before saving
    try {
      const finalValidation = await validateTransactionDate(header.InvDate);
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
      const payloadHeader = mapHeaderToApi({ ...header, FYearID: selectedFYearID }, { post });

      let tranId;
      if (editing?.tranid) {
        await axios.put(`${API_BASE_URL}/api/sales/${editing.tranid}`, payloadHeader);
        tranId = editing.tranid;
      } else {
        const r = await axios.post(`${API_BASE_URL}/api/sales`, payloadHeader);
        tranId = r.data?.inv_master_id;
        const assignedInvNo = r.data?.inv_no;
        if (assignedInvNo) {
          setHeader(h => ({ ...h, InvNo: String(assignedInvNo) }));
        }
        if (!tranId) throw new Error('inv_master_id not returned');
      }

      // Replace all details at once
      const payloadItems = rowsToSave.map(r => mapItemToApi(r, selectedFYearID));
      await axios.post(`${API_BASE_URL}/api/sales/${tranId}/items/replace`, { items: payloadItems });

      if (!post) {
        setNotice({ open: true, type: 'success', message: 'Sales saved successfully.' });
      }
      await fetchSales();

      if (!editing?.tranid) {
        setEditing({ tranid: tranId });
      }
    } catch (e) {
      console.error(e);
      setNotice({ open: true, type: 'error', message: e.response?.data?.error || e.message || 'Failed to save' });
    } finally {
      setSaving(false);
    }
  };

  const openPrintById = async (tranId) => {
    try {
      const [invRes, compRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/sales/${tranId}`),
        axios.get(`${API_BASE_URL}/api/company`)
      ]);
      const h = invRes.data?.header || {};
      const d = invRes.data?.details || [];
      const c = compRes.data || {};

      // Build printable HTML matching the provided sample layout
      const win = window.open('', '_blank');
      if (!win) { alert('Popup blocked. Please allow popups to print.'); return; }

      const safe = (v) => (v == null ? '' : String(v));
      const fmt = (v) => Number(v || 0).toFixed(2);
      // Build quick lookup for HSN and a helper accessor that tolerates different field names
      const itemMap = new Map((allItems || []).map(it => [String(it.itemcode), it]));
      const getHSN = (row) => {
        const code = row?.itemcode != null ? String(row.itemcode) : '';
        return (
          row?.hsncode ??
          row?.hsn_code ??
          itemMap.get(code)?.hsncode ??
          itemMap.get(code)?.hsn_code ??
          ''
        );
      };

      // Helpers: convert amount to words (Indian numbering)
      const numberToWords = (amount) => {
        const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
        const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
        const two = (n) => n < 20 ? ones[n] : tens[Math.floor(n/10)] + (n%10 ? " " + ones[n%10] : "");
        const three = (n) => {
          let s = "";
          const h = Math.floor(n/100), r = n%100;
          if (h) s += ones[h] + " Hundred" + (r ? " and " : "");
          if (r) s += two(r);
          return s || "Zero";
        };
        const intToWords = (num) => {
          if (num === 0) return "Zero";
          let n = Math.floor(Math.abs(num));
          let out = "";
          const crore = Math.floor(n/10000000); n %= 10000000;
          const lakh = Math.floor(n/100000); n %= 100000;
          const thousand = Math.floor(n/1000); n %= 1000;
          const hundred = n;
          if (crore) out += three(crore) + " Crore ";
          if (lakh) out += three(lakh) + " Lakh ";
          if (thousand) out += three(thousand) + " Thousand ";
          if (hundred) out += three(hundred);
          return out.trim();
        };
        const rupees = Math.floor(amount || 0);
        const paise = Math.round(((amount || 0) - rupees) * 100);
        let words = "Rupees " + intToWords(rupees);
        if (paise) words += " and " + two(paise) + " Paise";
        return words + " only";
      };
      const grandTotal = Number((h.tot_amount||0) + (h.rounded_off||0));
      const amountInWords = numberToWords(grandTotal);

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <title>Sales Invoice - ${safe(h.inv_no)}</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { font-family: Arial, sans-serif; font-size: 12px; line-height: 1.4; color: #000; }
              .container { max-width: 210mm; margin: 0 auto; padding: 10mm; }
              .header { text-align: left; margin-bottom: 20px; }
              .company-info { margin-bottom: 15px; }
              .title { text-align: center; font-size: 18px; font-weight: bold; margin: 20px 0; }
              .invoice-details { display: flex; justify-content: space-between; margin-bottom: 20px; }
              .left-details, .right-details { width: 48%; }
              .right-details { text-align: right; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
              th, td { border: 1px solid #000; padding: 4px; text-align: left; font-size: 11px; }
              th { background-color: #f5f5f5; font-weight: bold; text-align: center; }
              .text-right { text-align: right; }
              .text-center { text-align: center; }
              .items-table th { font-size: 10px; }
              .items-table td { font-size: 10px; }
              .hsn-table { margin-top: 15px; }
              .summary-section { display: flex; justify-content: space-between; margin-top: 20px; gap: 20px; }
              .hsn-summary { width: 55%; }
              .totals-summary { width: 40%; }
              .totals-summary table { border: none; width: 100%; border-collapse: collapse; }
              .totals-summary td { border: none; padding: 2px 2px; }
              .totals-summary .label { text-align: left; width: 65%; padding-right: 5px; }
              .totals-summary .amount { text-align: right; font-weight: bold; width: 35%; padding-left: 0px; }
              .grand-total { border-top: 2px solid #000; font-weight: bold; }
              .signature { margin-top: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
              .signature .right-sign { text-align: right; }
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
                  <div style="font-weight: bold; font-size: 14px;">${safe(c.company_name)}</div>
                  <div>${safe(c.address_line1)}</div>
                  <div>${safe(c.state)}</div>
                  <div>GST Number: ${safe(c.gst_number)}</div>
                </div>
              </div>

              <!-- Title -->
              <div class="title">Sales Invoice</div>

              <!-- Invoice Details -->
              <div class="invoice-details">
                <div class="left-details">
                  <div><strong>Invoice No:</strong> ${safe(h.inv_no)}</div>
                  <div><strong>Invoice Date:</strong> ${h.inv_date ? new Date(h.inv_date).toLocaleDateString() : ''}</div>
                </div>
                <div class="right-details">
                  <div><strong>Customer:</strong> ${safe(h.partyname || h.customer_name || '')}</div>
                  <div>${safe(h.address1 || '')}</div>
                  <div>GST: ${safe(h.gstnum || '')}</div>
                  <div>Contact: ${safe(h.contactno || '')}</div>
                </div>
              </div>

              <!-- Items Table -->
              <table class="items-table">
                <thead>
                  <tr>
                    <th style="width: 25px;">Sr#</th>
                    <th style="width: 200px;">Item</th>
                    <th style="width: 60px;">HSN/SAC</th>
                    <th style="width: 50px;">Qty</th>
                    <th style="width: 60px;">Rate</th>
                    <th style="width: 80px;">Taxable Amt</th>
                    <th style="width: 45px;">GST%</th>
                    <th style="width: 70px;">GST Amt</th>
                    <th style="width: 80px;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${d.map((x,i) => {
                    const totalTaxRate = (parseFloat(x.cgst_per||0) + parseFloat(x.sgst_per||0) + parseFloat(x.igst_per||0));
                    const gstAmount = (parseFloat(x.cgst_amount||0) + parseFloat(x.sgst_amount||0) + parseFloat(x.igst_amount||0));
                    const total = parseFloat(x.taxable_rate||0) + gstAmount;
                    return `
                    <tr>
                      <td class="text-center">${i+1}</td>
                      <td>${safe(x.itemname || x.description || '')}</td>
                      <td class="text-center">${safe(getHSN(x))}</td>
                      <td class="text-right">${fmt(x.qty)}</td>
                      <td class="text-right">${fmt(x.rate)}</td>
                      <td class="text-right">${fmt(x.taxable_rate)}</td>
                      <td class="text-center">${totalTaxRate.toFixed(0)}%</td>
                      <td class="text-right">${fmt(gstAmount)}</td>
                      <td class="text-right">${fmt(total)}</td>
                    </tr>
                    `;
                  }).join('')}
                  <tr style="background-color: #f0f0f0; font-weight: bold;">
                    <td class="text-center" colspan="3">Total</td>
                    <td class="text-right">${fmt(d.reduce((s, r)=>s+(parseFloat(r.qty||0)||0),0))}</td>
                    <td></td>
                    <td class="text-right">${fmt(h.taxable_tot)}</td>
                    <td></td>
                    <td class="text-right">${fmt((parseFloat(h.cgst_amount||0) + parseFloat(h.sgst_amount||0) + parseFloat(h.igst_amount||0)))}</td>
                    <td class="text-right">${fmt(h.tot_amount)}</td>
                  </tr>
                </tbody>
              </table>

              <table class="mt-12">
                <tr>
                  <td style="width:60%; vertical-align:top">
                    <div style="border:1px solid #000; padding:8px; min-height:48px; font-size:14px;">
                      <strong>Amount in Words:</strong>
                      <div style="margin-top:4px;">${safe(amountInWords)}</div>
                    </div>
                  </td>
                  <td style="width:40%;">
                    <table class="totals" style="width:100%">
                      <tr>
                        <td class="right">SGST Amount</td>
                        <td class="right" style="width:110px">${fmt(h.sgst_amount)}</td>
                      </tr>
                      <tr>
                        <td class="right">CGST Amount</td>
                        <td class="right">${fmt(h.cgst_amount)}</td>
                      </tr>
                      <tr>
                        <td class="right">IGST Amount</td>
                        <td class="right">${fmt(h.igst_amount)}</td>
                      </tr>
                      <tr>
                        <td class="right">Round Off</td>
                        <td class="right">${fmt(h.rounded_off)}</td>
                      </tr>
                      <tr>
                        <td class="right"><strong>Invoice Total</strong></td>
                        <td class="right"><strong>${fmt((h.tot_amount||0) + (h.rounded_off||0))}</strong></td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table class="mt-12">
                <thead>
                  <tr>
                    <th class="center">HSN/SAC</th>
                    <th class="right">Taxable</th>
                    <th class="center">sgst%</th>
                    <th class="right">sgst Amt</th>
                    <th class="center">cgst%</th>
                    <th class="right">cgst Amt</th>
                    <th class="right">Total Tax</th>
                  </tr>
                </thead>
                <tbody>
                  ${(() => {
                    // Group by HSN
                    const map = new Map();
                    for (const r of d) {
                      const hsn = getHSN(r) || 'NA';
                      const ent = map.get(hsn) || { taxable:0, sgst_per:r.sgst_per||0, cgst_per:r.cgst_per||0, sgst_amt:0, cgst_amt:0 };
                      ent.taxable += parseFloat(r.taxable_rate||0) || 0;
                      ent.sgst_amt += parseFloat(r.sgst_amount||0) || 0;
                      ent.cgst_amt += parseFloat(r.cgst_amount||0) || 0;
                      map.set(hsn, ent);
                    }
                    return Array.from(map.entries()).map(([hsn, v]) => `
                      <tr>
                        <td class="center">${hsn}</td>
                        <td class="right">${fmt(v.taxable)}</td>
                        <td class="center">${fmt(v.sgst_per)}</td>
                        <td class="right">${fmt(v.sgst_amt)}</td>
                        <td class="center">${fmt(v.cgst_per)}</td>
                        <td class="right">${fmt(v.cgst_amt)}</td>
                        <td class="right">${fmt((v.sgst_amt||0)+(v.cgst_amt||0))}</td>
                      </tr>
                    `).join('');
                  })()}
                  <tr>
                    <td class="right"><strong>Total</strong></td>
                    <td class="right">${fmt(h.taxable_tot)}</td>
                    <td></td>
                    <td class="right">${fmt(h.sgst_amount)}</td>
                    <td></td>
                    <td class="right">${fmt(h.cgst_amount)}</td>
                    <td class="right">${fmt((h.sgst_amount||0)+(h.cgst_amount||0))}</td>
                  </tr>
                </tbody>
              </table>

              <div class="signature">
                <div></div>
                <div class="right-sign">
                  for ${safe(c.company_name)}
                  <div style="margin-top:40px; border-top:1px solid #000; display:inline-block; padding-top:4px;">Authorised signatory</div>
                </div>
              </div>
            </div>

            <script>window.onload = () => { window.print(); };</script>
          </body>
        </html>
      `;
      win.document.open();
      win.document.write(html);
      win.document.close();
    } catch (e) {
      console.error(e);
      alert('Failed to open print view');
    }
  };

  const openPrintByInvNo = async (invNo) => {
    try {
      // Load list and find by inv_no in already fetched sales if possible
      let row = sales.find(s => String(s.invno) === String(invNo));
      if (!row) {
        // Fallback: refresh list and try again
        await fetchSales();
        row = (sales || []).find(s => String(s.invno) === String(invNo));
      }
      if (!row) { alert('Invoice not found in current filter'); return; }
      await openPrintById(row.tranid);
    } catch (e) {
      console.error(e);
    }
  };

  const printMultipleInvoices = async (tranIds) => {
    try {
      // Get company data once
      const compRes = await axios.get(`${API_BASE_URL}/api/company`);
      const c = compRes.data || {};

      const win = window.open('', '_blank');
      if (!win) { 
        alert('Popup blocked. Please allow popups to print.'); 
        return; 
      }

      let combinedBody = '';

      // Process each invoice
      for (let i = 0; i < tranIds.length; i++) {
        const tranId = tranIds[i];
        try {
          const invRes = await axios.get(`${API_BASE_URL}/api/sales/${tranId}`);
          const h = invRes.data?.header || {};
          const d = invRes.data?.details || [];

          const safe = (v) => (v == null ? '' : String(v));
          const fmt = (v) => Number(v || 0).toFixed(2);
          
          // Build quick lookup for HSN
          const itemMap = new Map((allItems || []).map(it => [String(it.itemcode), it]));
          const getHSN = (row) => {
            const code = row?.itemcode != null ? String(row.itemcode) : '';
            return (
              row?.hsncode ??
              row?.hsn_code ??
              itemMap.get(code)?.hsncode ??
              itemMap.get(code)?.hsn_code ??
              ''
            );
          };

          // Amount to words function
          const numberToWords = (amount) => {
            const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
            const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
            const two = (n) => n < 20 ? ones[n] : tens[Math.floor(n/10)] + (n%10 ? " " + ones[n%10] : "");
            const three = (n) => {
              let s = "";
              const h = Math.floor(n/100), r = n%100;
              if (h) s += ones[h] + " Hundred" + (r ? " and " : "");
              if (r) s += two(r);
              return s || "Zero";
            };
            const intToWords = (num) => {
              if (num === 0) return "Zero";
              let n = Math.floor(Math.abs(num));
              let out = "";
              const crore = Math.floor(n/10000000); n %= 10000000;
              const lakh = Math.floor(n/100000); n %= 100000;
              const thousand = Math.floor(n/1000); n %= 1000;
              const hundred = n;
              if (crore) out += three(crore) + " Crore ";
              if (lakh) out += three(lakh) + " Lakh ";
              if (thousand) out += three(thousand) + " Thousand ";
              if (hundred) out += three(hundred);
              return out.trim();
            };
            const rupees = Math.floor(amount || 0);
            const paise = Math.round(((amount || 0) - rupees) * 100);
            let words = "Rupees " + intToWords(rupees);
            if (paise) words += " and " + two(paise) + " Paise";
            return words + " only";
          };

          const grandTotal = Number((h.tot_amount||0) + (h.rounded_off||0));
          const amountInWords = numberToWords(grandTotal);

          // Add page break class for all invoices except the first one
          const pageBreakClass = i > 0 ? 'page-break' : '';

          combinedBody += `
            <div class="container ${pageBreakClass}">
              <!-- Company Header -->
              <div class="header">
                <div class="company-info">
                  <div style="font-weight: bold; font-size: 14px;">${safe(c.company_name)}</div>
                  <div>${safe(c.address_line1)}</div>
                  <div>${safe(c.state)}</div>
                  <div>GST Number: ${safe(c.gst_number)}</div>
                </div>
              </div>

              <!-- Title -->
              <div class="title">Sales Invoice</div>

              <!-- Invoice Details -->
              <div class="invoice-details">
                <div class="left-details">
                  <div><strong>Invoice No:</strong> ${safe(h.inv_no)}</div>
                  <div><strong>Invoice Date:</strong> ${h.inv_date ? new Date(h.inv_date).toLocaleDateString() : ''}</div>
                </div>
                <div class="right-details">
                  <div><strong>Customer:</strong> ${safe(h.partyname || h.customer_name || '')}</div>
                  <div>${safe(h.address1 || '')}</div>
                  <div>GST: ${safe(h.gstnum || '')}</div>
                  <div>Contact: ${safe(h.contactno || '')}</div>
                </div>
              </div>

              <!-- Items Table -->
              <table class="items-table">
                <thead>
                  <tr>
                    <th style="width: 25px;">Sr#</th>
                    <th style="width: 200px;">Item</th>
                    <th style="width: 60px;">HSN/SAC</th>
                    <th style="width: 50px;">Qty</th>
                    <th style="width: 60px;">Rate</th>
                    <th style="width: 80px;">Taxable Amt</th>
                    <th style="width: 45px;">GST%</th>
                    <th style="width: 70px;">GST Amt</th>
                    <th style="width: 80px;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${d.map((x,idx) => {
                    const totalTaxRate = (parseFloat(x.cgst_per||0) + parseFloat(x.sgst_per||0) + parseFloat(x.igst_per||0));
                    const gstAmount = (parseFloat(x.cgst_amount||0) + parseFloat(x.sgst_amount||0) + parseFloat(x.igst_amount||0));
                    const total = parseFloat(x.taxable_rate||0) + gstAmount;
                    return `
                    <tr>
                      <td class="text-center">${idx+1}</td>
                      <td>${safe(x.itemname || x.description || '')}</td>
                      <td class="text-center">${safe(getHSN(x))}</td>
                      <td class="text-right">${fmt(x.qty)}</td>
                      <td class="text-right">${fmt(x.rate)}</td>
                      <td class="text-right">${fmt(x.taxable_rate)}</td>
                      <td class="text-center">${totalTaxRate.toFixed(0)}%</td>
                      <td class="text-right">${fmt(gstAmount)}</td>
                      <td class="text-right">${fmt(total)}</td>
                    </tr>
                    `;
                  }).join('')}
                  <tr style="background-color: #f0f0f0; font-weight: bold;">
                    <td class="text-center" colspan="3">Total</td>
                    <td class="text-right">${fmt(d.reduce((s, r)=>s+(parseFloat(r.qty||0)||0),0))}</td>
                    <td></td>
                    <td class="text-right">${fmt(h.taxable_tot)}</td>
                    <td></td>
                    <td class="text-right">${fmt((parseFloat(h.cgst_amount||0) + parseFloat(h.sgst_amount||0) + parseFloat(h.igst_amount||0)))}</td>
                    <td class="text-right">${fmt(h.tot_amount)}</td>
                  </tr>
                </tbody>
              </table>

              <table class="mt-12">
                <tr>
                  <td style="width:60%; vertical-align:top">
                    <div style="border:1px solid #000; padding:8px; min-height:48px; font-size:14px;">
                      <strong>Amount in Words:</strong>
                      <div style="margin-top:4px;">${safe(amountInWords)}</div>
                    </div>
                  </td>
                  <td style="width:40%;">
                    <table class="totals" style="width:100%">
                      <tr>
                        <td class="right">SGST Amount</td>
                        <td class="right" style="width:110px">${fmt(h.sgst_amount)}</td>
                      </tr>
                      <tr>
                        <td class="right">CGST Amount</td>
                        <td class="right">${fmt(h.cgst_amount)}</td>
                      </tr>
                      <tr>
                        <td class="right">IGST Amount</td>
                        <td class="right">${fmt(h.igst_amount)}</td>
                      </tr>
                      <tr>
                        <td class="right">Round Off</td>
                        <td class="right">${fmt(h.rounded_off)}</td>
                      </tr>
                      <tr>
                        <td class="right"><strong>Invoice Total</strong></td>
                        <td class="right"><strong>${fmt((h.tot_amount||0) + (h.rounded_off||0))}</strong></td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table class="mt-12">
                <thead>
                  <tr>
                    <th class="center">HSN/SAC</th>
                    <th class="right">Taxable</th>
                    <th class="center">sgst%</th>
                    <th class="right">sgst Amt</th>
                    <th class="center">cgst%</th>
                    <th class="right">cgst Amt</th>
                    <th class="right">Total Tax</th>
                  </tr>
                </thead>
                <tbody>
                  ${(() => {
                    // Group by HSN
                    const map = new Map();
                    for (const r of d) {
                      const hsn = getHSN(r) || 'NA';
                      const ent = map.get(hsn) || { taxable:0, sgst_per:r.sgst_per||0, cgst_per:r.cgst_per||0, sgst_amt:0, cgst_amt:0 };
                      ent.taxable += parseFloat(r.taxable_rate||0) || 0;
                      ent.sgst_amt += parseFloat(r.sgst_amount||0) || 0;
                      ent.cgst_amt += parseFloat(r.cgst_amount||0) || 0;
                      map.set(hsn, ent);
                    }
                    return Array.from(map.entries()).map(([hsn, v]) => `
                      <tr>
                        <td class="center">${hsn}</td>
                        <td class="right">${fmt(v.taxable)}</td>
                        <td class="center">${fmt(v.sgst_per)}</td>
                        <td class="right">${fmt(v.sgst_amt)}</td>
                        <td class="center">${fmt(v.cgst_per)}</td>
                        <td class="right">${fmt(v.cgst_amt)}</td>
                        <td class="right">${fmt((v.sgst_amt||0)+(v.cgst_amt||0))}</td>
                      </tr>
                    `).join('');
                  })()}
                  <tr>
                    <td class="right"><strong>Total</strong></td>
                    <td class="right">${fmt(h.taxable_tot)}</td>
                    <td></td>
                    <td class="right">${fmt(h.sgst_amount)}</td>
                    <td></td>
                    <td class="right">${fmt(h.cgst_amount)}</td>
                    <td class="right">${fmt((h.sgst_amount||0)+(h.cgst_amount||0))}</td>
                  </tr>
                </tbody>
              </table>

              <div class="signature">
                <div></div>
                <div class="right-sign">
                  for ${safe(c.company_name)}
                  <div style="margin-top:40px; border-top:1px solid #000; display:inline-block; padding-top:4px;">Authorised signatory</div>
                </div>
              </div>
            </div>
          `;
        } catch (e) {
          console.error(`Error processing invoice ${tranId}:`, e);
        }
      }

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <title>Sales Invoices</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { font-family: Arial, sans-serif; font-size: 12px; line-height: 1.4; color: #000; }
              .container { max-width: 210mm; margin: 0 auto; padding: 10mm; }
              .header { text-align: left; margin-bottom: 20px; }
              .company-info { margin-bottom: 15px; }
              .title { text-align: center; font-size: 18px; font-weight: bold; margin: 20px 0; }
              .invoice-details { display: flex; justify-content: space-between; margin-bottom: 20px; }
              .left-details, .right-details { width: 48%; }
              .right-details { text-align: right; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
              th, td { border: 1px solid #000; padding: 4px; text-align: left; font-size: 11px; }
              th { background-color: #f5f5f5; font-weight: bold; text-align: center; }
              .text-right { text-align: right; }
              .text-center { text-align: center; }
              .items-table th { font-size: 10px; }
              .items-table td { font-size: 10px; }
              .page-break { page-break-before: always; }
              .totals td:first-child { border-right:none; }
              .totals td:last-child { width:110px; }
              .signature { margin-top: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
              .signature .right-sign { text-align: right; }
              @media print {
                body { margin: 0; }
                .container { padding: 5mm; }
              }
            </style>
          </head>
          <body>
            ${combinedBody}
            <script>window.onload = () => { window.print(); };</script>
          </body>
        </html>
      `;

      win.document.open();
      win.document.write(html);
      win.document.close();
    } catch (e) {
      console.error('Error printing multiple invoices:', e);
      alert('Failed to print invoices');
    }
  };

  const handleEdit = async (row) => {
    try {
      const r = await axios.get(`${API_BASE_URL}/api/sales/${row.tranid}`);
      const h = r.data?.header || {};
      const d = r.data?.details || [];
      setHeader({
        FYearID: h.fyear_id || '',
        InvNo: h.inv_no || '',
        InvDate: dateToInput(h.inv_date) || '',
        RefNo: h.ref_no || '',
        PartyID: h.party_id || '',
        Customer_Name: h.customer_name || '',
        AccountID: h.account_id || '',
        TaxableTot: Number(h.taxable_tot || 0),
        DisPerc: Number(h.dis_perc || 0),
        DisAmt: Number(h.dis_amount || 0),
        MiscPerAdd: Number(h.misc_per_add || 0),
        MiscAmtAdd: Number(h.misc_amount_add || 0),
        TotAvgCost: Number(h.tot_avg_cost || 0),
        TotAmount: Number(h.tot_amount || 0),
        Rounded: Number(h.rounded_off || 0),
        CGST_Amount: Number(h.cgst_amount || 0),
        SGST_Amount: Number(h.sgst_amount || 0),
        IGST_Amount: Number(h.igst_amount || 0),
        Remark: h.description || '',
        Is_Posted: !!h.is_posted,
        GrandTotal: Number(h.tot_amount || 0) + Number(h.rounded_off || 0),
      });
      const formatted = (d||[]).map((r, i)=>({
        Srno: Number(r.srno || (i + 1)),
        ItemCode: r.itemcode || '',
        Unit: r.unit || '',
        Qty: Number(r.qty || 0),
        AvgCost: Number(r.avg_cost || 0),
        TaxableRate: Number(r.taxable_rate || 0),
        CGST_Per: Number(r.cgst_per || 0),
        SGST_Per: Number(r.sgst_per || 0),
        IGST_Per: Number(r.igst_per || 0),
        CGST_Amount: Number(r.cgst_amount || 0),
        SGST_Amount: Number(r.sgst_amount || 0),
        IGST_Amount: Number(r.igst_amount || 0),
        Rate: Number(r.rate || 0),
        DisPer: Number(r.dis_per || 0),
        DisAmt: Number(r.dis_amount || 0),
        TotAmt: Number(r.tot_amount || 0),
        Remark: r.description || '',
        Deleted: !!r.is_deleted,
      }));
      setItems(formatted);
      // Recompute header totals from loaded details to avoid drift from stored header
      applyHeaderTotals(formatted);
      setEditing({ tranid: row.tranid });
      setShowForm(true);
    } catch (e) {
      console.error(e);
      alert('Failed to load sales invoice');
    }
  };

  const resetForm = async () => {
    // Set default transaction date within accounting period
    let defaultDate = "";
    try {
      defaultDate = await getDefaultTransactionDate();
    } catch (error) {
      console.error("Error getting default date:", error);
      defaultDate = new Date().toISOString().split('T')[0];
    }
    
    setHeader({
      FYearID: "",
      InvNo: "",
      InvDate: defaultDate,
      RefNo: "",
      PartyID: "",
      Customer_Name: "",
      AccountID: "",
      TaxableTot: 0,
      DisPerc: 0,
      DisAmt: 0,
      MiscPerAdd: 0,
      MiscAmtAdd: 0,
      TotAvgCost: 0,
      TotAmount: 0,
      CGST_Amount: 0,
      SGST_Amount: 0,
      IGST_Amount: 0,
      Remark: "",
      Is_Posted: false,
      Rounded: 0,
      GrandTotal: 0,
    });
    setItems([]);
    setEditing(null);
  };

  return (
    <div className="p-6">
      {/* Notice banner (match Purchase style) */}
      {notice.open && (
        <div className={`mb-3 px-4 py-2 rounded-lg shadow text-sm border ${notice.type==='error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
          {notice.message}
        </div>
      )}
      {/* List */}
      {!showForm && (
        <div className="space-y-4">
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Sales Invoices</h1>
          <div className="flex items-center gap-2">
            <input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)} className="border p-2 rounded"/>
            <input type="date" value={toDate} onChange={e=>setToDate(e.target.value)} className="border p-2 rounded"/>
            <input placeholder="Search Inv no / Customer" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="border p-2 rounded flex-1" />
            <button
              onClick={async()=>{
                if (selectedIds.size === 0) {
                  setNotice({ open:true, type:'error', message:'Select invoice(s) first' });
                  return;
                }
                // Print all selected invoices in a single window with page breaks
                await printMultipleInvoices(Array.from(selectedIds));
              }}
              className="px-3 py-2 border rounded"
              title="Print selected invoices"
            >
              Print Selected
            </button>
            <button onClick={fetchSales} className="px-3 py-2 border rounded">Refresh</button>
            <button onClick={async () => await handleNewInvoice()} className="px-3 py-2 bg-blue-600 text-white rounded">New Invoice</button>
          </div>

          <div className="border rounded">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
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
                    onClick={() => handleSort('invno')}
                    title="Click to sort by Invoice Number"
                  >
                    <div className="flex items-center justify-between">
                      <span>Inv No</span>
                      <span className="ml-1">
                        {sortField === 'invno' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th 
                    className="p-2 text-left cursor-pointer hover:bg-gray-200 select-none"
                    onClick={() => handleSort('invdate')}
                    title="Click to sort by Date"
                  >
                    <div className="flex items-center justify-between">
                      <span>Date</span>
                      <span className="ml-1">
                        {sortField === 'invdate' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th 
                    className="p-2 text-left cursor-pointer hover:bg-gray-200 select-none"
                    onClick={() => handleSort('customername')}
                    title="Click to sort by Customer"
                  >
                    <div className="flex items-center justify-between">
                      <span>Customer</span>
                      <span className="ml-1">
                        {sortField === 'customername' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th 
                    className="p-2 text-right cursor-pointer hover:bg-gray-200 select-none"
                    onClick={() => handleSort('taxabletot')}
                    title="Click to sort by Taxable Amount"
                  >
                    <div className="flex items-center justify-between">
                      <span>Taxable</span>
                      <span className="ml-1">
                        {sortField === 'taxabletot' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th 
                    className="p-2 text-right cursor-pointer hover:bg-gray-200 select-none"
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
                    className="p-2 text-right cursor-pointer hover:bg-gray-200 select-none"
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
                    className="p-2 text-right cursor-pointer hover:bg-gray-200 select-none"
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
                  <th 
                    className="p-2 text-right cursor-pointer hover:bg-gray-200 select-none"
                    onClick={() => handleSort('totamount')}
                    title="Click to sort by Total Amount"
                  >
                    <div className="flex items-center justify-between">
                      <span>Total</span>
                      <span className="ml-1">
                        {sortField === 'totamount' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
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
                {currentRecords.map((r) => (
                  <tr
                    key={r.tranid}
                    className="border-t hover:bg-blue-50 cursor-pointer"
                    onClick={() => handleEdit(r)}
                    title="Click to edit"
                  >
                    <td className="p-2 text-center" onClick={(e)=>e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(r.tranid)}
                        onChange={() => toggleRow(r.tranid)}
                        title={`Select invoice ${r.invno}`}
                      />
                    </td>
                    <td className="p-2">{r.invno}</td>
                    <td className="p-2">{dateToInput(r.invdate)}</td>
                    <td className="p-2">{r.customername}</td>
                    <td className="p-2 text-right">{n(r.taxabletot).toFixed(2)}</td>
                    <td className="p-2 text-right">{n(r.cgst).toFixed(2)}</td>
                    <td className="p-2 text-right">{n(r.sgst).toFixed(2)}</td>
                    <td className="p-2 text-right">{n(r.igst).toFixed(2)}</td>
                    <td className="p-2 text-right">{n(r.totamount).toFixed(2)}</td>
                    <td className="p-2 text-center">
                      <input type="checkbox" checked={!!r.is_posted} readOnly onClick={(e)=>e.stopPropagation()} />
                    </td>
                  </tr>
                ))}
                <tr className="border-t bg-gray-50 font-semibold">
                  <td className="p-2 text-right" colSpan={4}>Totals</td>
                  <td className="p-2 text-right">{currentRecords.reduce((a,x)=>a+n(x.taxabletot||0),0).toFixed(2)}</td>
                  <td className="p-2 text-right">{currentRecords.reduce((a,x)=>a+n(x.cgst||0),0).toFixed(2)}</td>
                  <td className="p-2 text-right">{currentRecords.reduce((a,x)=>a+n(x.sgst||0),0).toFixed(2)}</td>
                  <td className="p-2 text-right">{currentRecords.reduce((a,x)=>a+n(x.igst||0),0).toFixed(2)}</td>
                  <td className="p-2 text-right">{currentRecords.reduce((a,x)=>a+n(x.totamount||0),0).toFixed(2)}</td>
                  <td className="p-2"></td>
                </tr>
                {currentRecords.length===0 && (
                  <tr><td colSpan={10} className="p-4 text-center text-gray-500">No records</td></tr>
                )}
              </tbody>
            </table>
            <div className="flex items-center justify-between p-2">
              <button disabled={currentPage<=1} onClick={()=>setCurrentPage(p=>Math.max(1,p-1))} className="px-3 py-1 border rounded">Prev</button>
              <div>Page {currentPage} / {totalPages}</div>
              <button disabled={currentPage>=totalPages} onClick={()=>setCurrentPage(p=>Math.min(totalPages,p+1))} className="px-3 py-1 border rounded">Next</button>
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="space-y-4 max-w-[104rem] mx-auto">

          {/* Form header controls + status */}
          <div className="flex items-center justify-between">
            {/* Left: section heading and command buttons */}
            <div className="flex flex-col gap-3">
              <h2 className="text-2xl font-semibold text-gray-900">Sales Invoice</h2>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={async () => {
                    const isAddMode = !editing?.tranid;
                    const noHeaderEntry = !String(header.InvDate||'').trim()
                      && !String(header.PartyID||'').trim()
                      && !String(header.RefNo||'').trim()
                      && !String(header.Remark||'').trim()
                      && items.length===0;
                    if (isAddMode && noHeaderEntry) return; // already pristine add form → no action
                    setEditing(null);
                    await handleNewInvoice();
                  }}
                  className="px-4 py-2 rounded-lg border bg-white text-gray-800 hover:bg-gray-50"
                >
                  New
                </button>
                <button
                  disabled={saving || header.Is_Posted}
                  onClick={()=>handleSave({ post:false })}
                  className="px-4 py-2 rounded-lg text-white shadow bg-gradient-to-r from-purple-400 to-purple-600 hover:from-purple-500 hover:to-purple-700 disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  disabled={!editing?.tranid}
                  onClick={()=> editing?.tranid && openPrintById(editing.tranid)}
                  className="px-4 py-2 rounded-lg border bg-white text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                  title="Print current invoice"
                >
                  Print
                </button>
                <button
                  disabled={saving || header.Is_Posted}
                  onClick={async()=>{
                    // Ensure saved first, then post
                    await handleSave({ post:false });
                    try {
                      const id = editing?.tranid;
                      if (!id) {
                        setNotice({ open:true, type:'error', message:'Save invoice first' });
                        return;
                      }
                      await axios.post(`${API_BASE_URL}/api/sales/${id}/post`);
                      setHeader(h=>({ ...h, Is_Posted: true }));
                      await fetchSales();
                      setNotice({ open:true, type:'success', message:'Sales posted successfully.' });
                    } catch(e){
                      console.error(e);
                      setNotice({ open:true, type:'error', message:'Failed to post' });
                    }
                  }}
                  className="px-4 py-2 rounded-lg border bg-white text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                >
                  Post
                </button>
                <button
                  onClick={()=>setShowForm(false)}
                  className="px-4 py-2 rounded-lg border bg-white text-gray-800 hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Right: Odoo-style nav + status */}
            <div className="flex items-center gap-4">
              {/* Nav: x / N and arrows */}
              <div className="flex items-center gap-2 text-sm">
                <span>{editing?.tranid ? `${(sales.findIndex(s=>String(s.tranid)===String(editing.tranid))+1) || 0} / ${sales.length}` : `0 / ${sales.length}`}</span>
                <button
                  title="Previous"
                  onClick={() => {
                    if (!editing?.tranid) return;
                    const idx = sales.findIndex(s=>String(s.tranid)===String(editing.tranid));
                    if (idx > 0) handleEdit(sales[idx-1]);
                  }}
                  className="px-2 py-1 border rounded disabled:opacity-50"
                  disabled={!editing?.tranid || sales.findIndex(s=>String(s.tranid)===String(editing.tranid)) <= 0}
                >
                  ‹
                </button>
                <button
                  title="Next"
                  onClick={() => {
                    if (!editing?.tranid) return;
                    const idx = sales.findIndex(s=>String(s.tranid)===String(editing.tranid));
                    if (idx >= 0 && idx < sales.length - 1) handleEdit(sales[idx+1]);
                  }}
                  className="px-2 py-1 border rounded disabled:opacity-50"
                  disabled={!editing?.tranid || sales.findIndex(s=>String(s.tranid)===String(editing.tranid)) >= sales.length - 1}
                >
                  ›
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold shadow ${header.Is_Posted ? 'bg-gray-200 text-gray-600 line-through' : 'bg-purple-600 text-white'}`}>
                  DRAFT
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold shadow ${header.Is_Posted ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                  POSTED
                </span>
              </div>
            </div>
          </div>

          {/* Header fields aligned to Purchase layout */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm text-gray-600">Inv No</label>
              <input
                value={header.InvNo}
                onChange={()=>{ /* disabled input - no manual edits */ }}
                className={`mt-1 w-full px-3 py-2 rounded border ${headerErrors.InvNo ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'}`}
                disabled={true}
                title="Auto-generated during Save"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600">Date</label>
              <input
                type="date"
                value={header.InvDate}
                onChange={async (e) => {
                  const newDate = e.target.value;
                  setHeader(h => ({ ...h, InvDate: newDate }));
                  
                  // Real-time validation of transaction date
                  if (newDate) {
                    try {
                      const validation = await validateTransactionDate(newDate);
                      if (!validation.isValid) {
                        setHeaderErrors(prev => ({ ...prev, InvDate: validation.message }));
                      } else {
                        setHeaderErrors(prev => ({ ...prev, InvDate: '' }));
                      }
                    } catch (error) {
                      setHeaderErrors(prev => ({ ...prev, InvDate: 'Error validating date' }));
                    }
                  } else {
                    setHeaderErrors(prev => ({ ...prev, InvDate: '' }));
                  }
                }}
                className={`mt-1 w-full px-3 py-2 rounded border ${headerErrors.InvDate ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'}`}
                disabled={header.Is_Posted}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600">Customer</label>
              <select
                value={header.PartyID}
                onChange={e=>setHeader(h=>({...h, PartyID: e.target.value}))}
                className={`mt-1 w-full px-3 py-2 rounded border ${headerErrors.PartyID ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'}`}
                disabled={header.Is_Posted}
              >
                <option value="">-- Select --</option>
                {customers.map(c => (
                  <option key={c.partyid} value={c.partyid}>{c.partyname}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600">Ref No</label>
              <input
                value={header.RefNo}
                onChange={e=>setHeader(h=>({...h, RefNo: e.target.value}))}
                className="mt-1 w-full px-3 py-2 border rounded"
                disabled={header.Is_Posted}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-600">Remark</label>
              <input
                value={header.Remark}
                onChange={e=>setHeader(h=>({...h, Remark: e.target.value}))}
                className="mt-1 w-full px-3 py-2 border rounded"
                disabled={header.Is_Posted}
              />
            </div>
          </div>

          {/* Items */}
          <div className="border rounded">
            <div className="flex items-center justify-between p-2">
              <div className="font-medium">Items</div>
              <button onClick={addRow} className="px-3 py-1 bg-blue-600 text-white rounded" disabled={header.Is_Posted}>Add Row</button>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 text-left w-14">Sr</th>
                  <th className="p-2 text-left">Item Name / Code</th>
                  <th className="p-2 text-left">Unit</th>
                  <th className="p-2 text-right">Qty</th>
                  <th className="p-2 text-right">Rate</th>
                  <th className="p-2 text-right">Tax'ble Val</th>
                  <th className="p-2 text-right">CGST</th>
                  <th className="p-2 text-right">SGST</th>
                  <th className="p-2 text-right">IGST</th>
                  <th className="p-2 text-right">Total</th>
                  <th className="p-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => {
                  const master = allItems.find(a => String(a.itemcode) === String(it.ItemCode));
                  return (
                    <tr key={idx} className="border-t">
                      <td className="p-2 text-right w-14">{it.Srno || (idx + 1)}</td>
                      <td className="p-2 w-96">
                        <div className="text-sm">
                          <div className="font-medium">{master?.itemname || it.ItemCode}</div>
                          <div className="text-gray-500 text-xs">{it.ItemCode}</div>
                        </div>
                      </td>
                      <td className="p-2">{it.Unit}</td>
                      <td className="p-2 text-right">
                        <input type="number" value={it.Qty} onChange={e=>updateItem(idx,'Qty', e.target.value)} className="border p-1 rounded w-32 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" disabled={header.Is_Posted} />
                      </td>
                      <td className="p-2 text-right">
                        <input type="number" value={it.Rate} onChange={e=>updateItem(idx,'Rate', e.target.value)} className="border p-1 rounded w-32 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" disabled={header.Is_Posted} />
                      </td>
                      <td className="p-2 text-right">{formatNumber(n(it.TaxableRate).toFixed(2))}</td>
                      <td className="p-2 text-right">{formatNumber(n(it.CGST_Amount).toFixed(2))}</td>
                      <td className="p-2 text-right">{formatNumber(n(it.SGST_Amount).toFixed(2))}</td>
                      <td className="p-2 text-right">{formatNumber(n(it.IGST_Amount).toFixed(2))}</td>
                      <td className="p-2 text-right">{formatNumber(n(it.TotAmt).toFixed(2))}</td>
                      <td className="p-2 text-right">
                        <button onClick={()=>removeRow(idx)} className="px-2 py-1 border rounded" disabled={header.Is_Posted}>Delete</button>
                      </td>
                    </tr>
                  );
                })}
                {/* Totals row */}
                <tr className="border-t bg-gray-50 font-semibold">
                  <td className="p-2 text-right" colSpan={3}>Totals</td>
                  <td className="p-2 text-right">{formatNumber(items.reduce((a,r)=>a+n(r.Qty),0).toFixed(2))}</td>
                  <td className="p-2"></td>
                  <td className="p-2 text-right">{formatNumber(n(header.TaxableTot).toFixed(2))}</td>
                  <td className="p-2 text-right">{formatNumber(n(header.CGST_Amount).toFixed(2))}</td>
                  <td className="p-2 text-right">{formatNumber(n(header.SGST_Amount).toFixed(2))}</td>
                  <td className="p-2 text-right">{formatNumber(n(header.IGST_Amount).toFixed(2))}</td>
                  <td className="p-2 text-right">{formatNumber(n(header.TotAmount).toFixed(2))}</td>
                  <td className="p-2"></td>
                </tr>
                {items.length===0 && (
                  <tr><td colSpan={12} className="p-4 text-center text-gray-500">No items</td></tr>
                )}
              </tbody>
            </table>
            {/* Bottom summary aligned to right with single GST line */}
            <div className="p-4 border-t bg-gray-50">
              <div className="flex justify-end">
                <div className="w-full md:w-auto md:min-w-[320px] space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Taxable Total:</span>
                    <span className="font-semibold">{formatNumber(n(header.TaxableTot).toFixed(2))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>GST Amount:</span>
                    <span className="font-semibold">{formatNumber((n(header.CGST_Amount)+n(header.SGST_Amount)+n(header.IGST_Amount)).toFixed(2))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Amount:</span>
                    <span className="font-semibold">{formatNumber(n(header.TotAmount).toFixed(2))}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm">Rounded Off:</label>
                    <input type="number" step="0.001" value={header.Rounded} onChange={e=>{
                      const val = Number(e.target.value||0);
                      setHeader(h=>({ ...h, Rounded: isNaN(val)?0:val, GrandTotal: n(h.TotAmount) + (isNaN(val)?0:val) }));
                    }} className="border p-1 rounded w-28 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" disabled={header.Is_Posted} />
                  </div>
                  <div className="flex justify-between border-t pt-2 text-base font-semibold">
                    <span>Grand Total:</span>
                    <span>{formatNumber((n(header.TotAmount)+n(header.Rounded)).toFixed(2))}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Item Picker Modal - aligned to Purchase */}
          {showItemModal && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded shadow-lg w-full max-w-7xl max-h-[95vh] flex flex-col">
                <div className="p-3 border-b flex items-center justify-between">
                  <div className="font-semibold">Select Item</div>
                  <button onClick={()=>setShowItemModal(false)} className="px-2 py-1 border rounded">Close</button>
                </div>
                <div className="flex flex-1 overflow-hidden">
                  {/* Left: searchable list with keyboard navigation */}
                  <div className="w-1/2 border-r flex flex-col">
                    <div className="p-3 border-b">
                      <input
                        ref={searchInputRef}
                        placeholder="Search item..."
                        value={itemSearch}
                        onChange={e=>{ setItemSearch(e.target.value); setHighlightIndex(0); }}
                        onKeyDown={handleListKeyDown}
                        className="border p-2 rounded w-full"
                        autoFocus
                      />
                    </div>
                    <div className="overflow-y-auto flex-1" tabIndex={0} onKeyDown={handleListKeyDown}>
                      <table className="w-full text-sm">
                        <thead className="bg-gray-100 sticky top-0">
                          <tr>
                            <th className="p-2 text-left">Code</th>
                            <th className="p-2 text-left">Name</th>
                            <th className="p-2 text-right">Stock</th>
                            <th className="p-2 text-right">Avg. Cost</th>
                            <th className="p-2 text-right">S. Price</th>
                            <th className="p-2 text-right">MRP</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredItems.map((it, idx) => (
                            <tr
                              id={`sale-item-row-${idx}`}
                              key={it.itemcode}
                              className={`border-t cursor-pointer ${idx===highlightIndex? 'bg-blue-50' : ''}`}
                              onClick={()=>{ setHighlightIndex(idx); onPickItem(it); }}
                              onDoubleClick={()=> onPickItem(it)}
                            >
                              <td className="p-2">{it.itemcode}</td>
                              <td className="p-2">{it.itemname}</td>
                              <td className="p-2 text-right">{n(it.curstock || 0).toFixed(2)}</td>
                              <td className="p-2 text-right">{n(it.avgcost || it.cost || 0).toFixed(2)}</td>
                              <td className="p-2 text-right">{n(it.sprice || 0).toFixed(2)}</td>
                              <td className="p-2 text-right">{n(it.mrp || 0).toFixed(2)}</td>
                            </tr>
                          ))}
                          {filteredItems.length===0 && (
                            <tr><td colSpan={6} className="p-6 text-center text-gray-500">No items</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Right: details pane + quantity/rate + calculated totals */}
                  <div className="w-1/2 flex flex-col">
                    {selectedItem ? (
                      <div className="p-3 space-y-3">
                        <div>
                          <label className="block text-xs text-gray-600">Item</label>
                          <textarea readOnly value={selectedItem.itemname || ''} rows={2} className="w-full border rounded p-2 resize-none" />
                        </div>
                        {/* Hide code/unit/stock and cost/price/MRP per requirement */}
                        <div className="hidden" />

                        {/* GST % inputs (only show percentages; item name already shown above) */}
                        <div className="grid grid-cols-3 gap-3 text-sm">
                          <div>
                            <label className="block text-xs text-gray-600">CGST %</label>
                            <input
                              type="number"
                              value={modalItemData.CGSTPer}
                              onChange={e=>calculateModalTotals(selectedItem, modalItemData.Qty, modalItemData.Rate, n(e.target.value), modalItemData.SGSTPer, modalItemData.IGSTPer)}
                              className="w-full border rounded p-2 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600">SGST %</label>
                            <input
                              type="number"
                              value={modalItemData.SGSTPer}
                              onChange={e=>calculateModalTotals(selectedItem, modalItemData.Qty, modalItemData.Rate, modalItemData.CGSTPer, n(e.target.value), modalItemData.IGSTPer)}
                              className="w-full border rounded p-2 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600">IGST %</label>
                            <input
                              type="number"
                              value={modalItemData.IGSTPer}
                              onChange={e=>calculateModalTotals(selectedItem, modalItemData.Qty, modalItemData.Rate, modalItemData.CGSTPer, modalItemData.SGSTPer, n(e.target.value))}
                              className="w-full border rounded p-2 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          </div>
                        </div>

                        {/* Qty / Rate */}
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <label className="block text-xs text-gray-600">Qty</label>
                            <input
                              ref={qtyRef}
                              type="number"
                              value={modalItemData.Qty}
                              onChange={e=>calculateModalTotals(selectedItem, n(e.target.value), modalItemData.Rate, modalItemData.CGSTPer, modalItemData.SGSTPer, modalItemData.IGSTPer)}
                              className="w-full border rounded p-3 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600">Rate</label>
                            <input
                              ref={rateRef}
                              type="number"
                              value={modalItemData.Rate}
                              onChange={e=>calculateModalTotals(selectedItem, modalItemData.Qty, n(e.target.value), modalItemData.CGSTPer, modalItemData.SGSTPer, modalItemData.IGSTPer)}
                              className="w-full border rounded p-3 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          </div>
                        </div>

                        {/* Calculated preview - vertical like Purchase */}
                        <div className="mt-4 p-3 bg-gray-50 rounded border text-sm space-y-2">
                          <div className="flex justify-between">
                            <span>Taxable Value:</span>
                            <span className="font-semibold">{modalItemData.Taxable.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>CGST Amount ({modalItemData.CGSTPer}%):</span>
                            <span className="font-semibold">{modalItemData.CGST.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>SGST Amount ({modalItemData.SGSTPer}%):</span>
                            <span className="font-semibold">{modalItemData.SGST.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>IGST Amount ({modalItemData.IGSTPer}%):</span>
                            <span className="font-semibold">{modalItemData.IGST.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between border-t pt-2 text-base font-semibold">
                            <span>Total Value:</span>
                            <span>{modalItemData.Total.toFixed(2)}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2">
                          <button
                            ref={saveAddNewRef}
                            onClick={addItemAndContinue}
                            className="px-3 py-2 border rounded"
                          >
                            Add & Continue
                          </button>
                          <button
                            onClick={addItemToForm}
                            className="px-3 py-2 bg-blue-600 text-white rounded"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-6 text-gray-500">Select an item to edit details</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}