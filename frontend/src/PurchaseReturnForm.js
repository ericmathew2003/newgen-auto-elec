import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { validateTransactionDate, getDefaultTransactionDate } from "./utils/accountingPeriodUtils";

const n = (value) => (isNaN(Number(value)) ? 0 : Number(value));
const formatNumber = (val) => {
  if (val === null || val === undefined || val === "") return "";
  const str = String(val).replace(/,/g, "");
  const [intPart, decPart] = str.split(".");
  const sign = intPart?.startsWith("-") ? "-" : "";
  const nint = (intPart || "").replace("-", "");
  const withCommas = nint.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return sign + withCommas + (decPart !== undefined ? "." + decPart : "");
};

const parseNumber = (val) => {
  if (val === null || val === undefined || val === "") return 0;
  const num = Number(String(val).replace(/,/g, ""));
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

const inputToDate = (val) => {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d) ? null : d.toISOString();
};

const initialHeaderState = {
  FYearID: "",
  PurchRetNo: "",
  PurchRetDate: "",
  PartyID: "",
  PartyName: "",
  TaxableTotal: 0,
  CGSTAmount: 0,
  SGSTAmount: 0,
  IGSTAmount: 0,
  RoundedOff: 0,
  TotalAmount: 0,
  Remark: "",
  IsPosted: false,
};

const makeEmptyItem = (index = 1) => ({
  Srno: index,
  ItemCode: "",
  ItemName: "",
  Unit: "",
  Qty: 0,
  Rate: 0,
  TaxableAmount: 0,
  CGSTPer: 0,
  SGSTPer: 0,
  IGSTPer: 0,
  CGSTAmount: 0,
  SGSTAmount: 0,
  IGSTAmount: 0,
  Total: 0,
  Remark: "",
  SupplierInvNo: "",
  SupplierInvDate: "",
});

function NoticeBanner({ notice, onClose }) {
  if (!notice?.open) return null;
  const backgrounds = {
    success: "bg-green-600",
    error: "bg-red-600",
    warning: "bg-amber-600",
    info: "bg-blue-600",
  };
  const bg = backgrounds[notice.type || "info"];
  return (
    <div className="fixed top-4 inset-x-0 flex justify-center z-50" role="alert">
      <div className={`${bg} text-white px-4 py-3 rounded shadow-lg w-[90%] md:w-[600px] relative`}>
        <div className="font-semibold">Purchase Return</div>
        <div className="mt-1 pr-6 text-sm">{notice.message}</div>
        <button
          type="button"
          aria-label="Close alert"
          className="absolute right-2 top-2 text-white/90 hover:text-white"
          onClick={onClose}
        >
          ×
        </button>
      </div>
    </div>
  );
}

function ModalFrame({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-[96%] md:w-[900px] max-h-[90vh] overflow-hidden">
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 focus:outline-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {children}
        </div>
      </div>
    </div>
  );
}

function SearchableItemTable({ items, highlightIndex, onSelect, onHover, tableId }) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm mt-4">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Code</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Item Name</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Supplier Inv. No</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Supplier Inv. Date</th>
            <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Qty</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Unit</th>
            <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Cost</th>
            <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">CGST%</th>
            <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">SGST%</th>
            <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">IGST%</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={10} className="px-4 py-6 text-center text-gray-500">
                No matching items
              </td>
            </tr>
          ) : (
            items.map((item, idx) => (
              <tr
                id={`${tableId}-${idx}`}
                key={item.itemcode || idx}
                className={`${highlightIndex === idx ? "bg-emerald-50" : ""} hover:bg-emerald-100 cursor-pointer transition-colors`}
                onMouseEnter={() => onHover(idx)}
                onClick={() => onSelect(item)}
              >
                <td className="px-4 py-2 font-medium text-gray-900">{item.itemcode}</td>
                <td className="px-4 py-2 text-gray-700">{item.itemname}</td>
                <td className="px-4 py-2 text-gray-700">{item.suppinvno || "-"}</td>
                <td className="px-4 py-2 text-gray-700">{item.suppinvdt ? dateToInput(item.suppinvdt) : "-"}</td>
                <td className="px-4 py-2 text-right text-gray-700">{formatNumber(item.qty)}</td>
                <td className="px-4 py-2 text-gray-700">{item.unit || "-"}</td>
                <td className="px-4 py-2 text-right text-gray-700">{formatNumber(item.cost)}</td>
                <td className="px-4 py-2 text-right text-gray-700">{formatNumber(item.cgst)}</td>
                <td className="px-4 py-2 text-right text-gray-700">{formatNumber(item.sgst)}</td>
                <td className="px-4 py-2 text-right text-gray-700">{formatNumber(item.igst)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function PurchaseReturnForm({ onClose, onSaved, onDataChanged, initialData, allReturns = [], onNavigate }) {
  const [header, setHeader] = useState({ ...initialHeaderState });
  const [items, setItems] = useState([makeEmptyItem(1)]);
  const [suppliers, setSuppliers] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [notice, setNotice] = useState({ open: false, type: "info", message: "" });
  const [activeTab, setActiveTab] = useState("items");
  const [saving, setSaving] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [justSaved, setJustSaved] = useState(false);
  const [lastSavedState, setLastSavedState] = useState(null);

  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [itemModalIndex, setItemModalIndex] = useState(null);
  const [itemSearch, setItemSearch] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);
  const searchInputRef = useRef(null);
  const qtyInputRef = useRef(null);
  const rateInputRef = useRef(null);

  const [modalItem, setModalItem] = useState(null);
  const [modalValues, setModalValues] = useState({
    Qty: 1,
    Rate: 0,
    TaxableAmount: 0,
    CGSTPer: 0,
    SGSTPer: 0,
    IGSTPer: 0,
    CGSTAmount: 0,
    SGSTAmount: 0,
    IGSTAmount: 0,
    Total: 0,
    SupplierInvNo: "",
    SupplierInvDate: "",
  });

  const initialHeaderRef = useRef(initialHeaderState);
  const initialItemsRef = useRef([makeEmptyItem(1)]);

  const filteredItems = useMemo(() => {
    const q = (itemSearch || "").trim().toLowerCase();
    if (!q) return allItems.slice(0, 50);
    const tokens = q.split(/\s+/).filter(Boolean);
    return allItems
      .filter((it) => {
        const name = String(it.itemname || "").toLowerCase();
        const code = String(it.itemcode || "").toLowerCase();
        return tokens.every((t) => name.includes(t) || code.includes(t));
      })
      .slice(0, 100);
  }, [allItems, itemSearch]);

  useEffect(() => {
    const loadSuppliers = async () => {
      try {
        const res = await axios.get("http://localhost:5000/api/party/all");
        const supplierList = (res.data || []).filter(
          (p) => parseInt(p.partytype ?? 0, 10) === 2
        );
        const sorted = supplierList.sort((a, b) =>
          String(a.partyname || "").localeCompare(String(b.partyname || ""), undefined, {
            sensitivity: "base",
          })
        );
        setSuppliers(sorted);
      } catch (error) {
        console.error(error);
      }
    };
    loadSuppliers();
  }, []);

  // Load items from selected supplier
  useEffect(() => {
    const loadSupplierItems = async () => {
      if (!header.PartyID) {
        setAllItems([]);
        return;
      }
      try {
        const res = await axios.get(`http://localhost:5000/api/purchase/supplier/${header.PartyID}/items`);
        setAllItems(res.data || []);
      } catch (error) {
        console.error(error);
        setAllItems([]);
      }
    };
    loadSupplierItems();
  }, [header.PartyID]);

  useEffect(() => {
    setIsInitializing(true);
    
    if (!initialData) {
      const selectedFYearID = localStorage.getItem("selectedFYearID") || "";
      setHeader((prev) => ({ ...prev, FYearID: selectedFYearID, PurchRetNo: "NEW" }));
      setItems([makeEmptyItem(1)]);
      initialHeaderRef.current = {
        ...initialHeaderState,
        FYearID: selectedFYearID,
        PurchRetNo: "NEW",
      };
      initialItemsRef.current = [makeEmptyItem(1)];
      setIsInitializing(false);
      return;
    }

    const mappedHeader = {
      FYearID: initialData.fyear_id || "",
      PurchRetNo: initialData.purch_ret_no || "",
      PurchRetDate: dateToInput(initialData.tran_date),
      PartyID: initialData.party_id || "",
      PartyName: initialData.partyname || "",
      TaxableTotal: n(initialData.taxable_total),
      CGSTAmount: n(initialData.cgst_amount),
      SGSTAmount: n(initialData.sgst_amount),
      IGSTAmount: n(initialData.igst_amount),
      RoundedOff: n(initialData.rounded_off),
      TotalAmount: n(initialData.total_amount),
      Remark: initialData.description || initialData.remark || "",
      IsPosted: !!initialData.is_posted,
    };

    const mappedItems = Array.isArray(initialData.items)
      ? initialData.items.map((row, idx) => ({
          Srno: idx + 1,
          ItemCode: row.item_code || row.itemcode,
          ItemName: row.itemname || "",
          Unit: row.unit || "",
          Qty: n(row.qty),
          Rate: n(row.taxable_rate || row.rate),
          TaxableAmount: n(row.taxable_amount),
          CGSTPer: n(row.cgst_per),
          SGSTPer: n(row.sgst_per),
          IGSTPer: n(row.igst_per),
          CGSTAmount: n(row.cgst_amount),
          SGSTAmount: n(row.sgst_amount),
          IGSTAmount: n(row.igst_amount),
          Total: n(row.total_amount),
          Remark: row.description || row.remark || "",
          SupplierInvNo: row.supp_inv_no || "",
          SupplierInvDate: row.supp_inv_date ? dateToInput(row.supp_inv_date) : "",
        }))
      : [makeEmptyItem(1)];

    setHeader(mappedHeader);
    setItems(mappedItems.length ? mappedItems : [makeEmptyItem(1)]);
    initialHeaderRef.current = mappedHeader;
    initialItemsRef.current = mappedItems.length ? mappedItems : [makeEmptyItem(1)];
    
    // Set initializing to false after refs are set
    setTimeout(() => setIsInitializing(false), 0);
  }, [initialData]);

  useEffect(() => {
    if (!itemModalOpen) return;
    const timer = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 0);
    return () => clearTimeout(timer);
  }, [itemModalOpen]);

  useEffect(() => {
    if (!itemModalOpen || !modalItem) return;
    const timer = setTimeout(() => {
      qtyInputRef.current?.focus();
      qtyInputRef.current?.select();
    }, 100);
    return () => clearTimeout(timer);
  }, [itemModalOpen, modalItem]);

  const setNoticeMessage = (type, message) => {
    // Ensure message is always a string
    const messageStr = typeof message === 'string' ? message : String(message);
    setNotice({ open: true, type, message: messageStr });
    setTimeout(() => setNotice({ open: false, type: "info", message: "" }), 4000);
  };

  const resetForm = async () => {
    setIsInitializing(true);
    const selectedFYearID = localStorage.getItem("selectedFYearID") || "";
    
    // Set default transaction date within accounting period
    let defaultDate = "";
    try {
      defaultDate = await getDefaultTransactionDate();
    } catch (error) {
      console.error("Error getting default date:", error);
      defaultDate = new Date().toISOString().split('T')[0];
    }
    
    const headerState = { ...initialHeaderState, FYearID: selectedFYearID, PurchRetNo: "NEW", PurchRetDate: defaultDate };
    const itemState = [makeEmptyItem(1)];
    setHeader(headerState);
    setItems(itemState);
    initialHeaderRef.current = headerState;
    initialItemsRef.current = itemState;
    setActiveTab("items");
    setTimeout(() => setIsInitializing(false), 0);
  };

  const isDirty = useMemo(() => {
    // Don't consider form dirty while initializing
    if (isInitializing) return false;
    
    // Use lastSavedState if available (after save), otherwise use initial refs
    const compareHeader = lastSavedState ? lastSavedState.header : initialHeaderRef.current;
    const compareItems = lastSavedState ? lastSavedState.items : initialItemsRef.current;
    
    const headerDirty = JSON.stringify(header) !== JSON.stringify(compareHeader);
    const itemsDirty = JSON.stringify(items) !== JSON.stringify(compareItems);
    
    // Debug logging
    if (headerDirty || itemsDirty) {
      console.log("Form is dirty:");
      if (headerDirty) {
        console.log("Header changed:");
        console.log("Current:", header);
        console.log("Compare to:", compareHeader);
      }
      if (itemsDirty) {
        console.log("Items changed:");
        console.log("Current items count:", items.length);
        console.log("Compare items count:", compareItems?.length);
      }
    }
    
    return headerDirty || itemsDirty;
  }, [header, items, isInitializing, lastSavedState]);

  // Update refs after successful save to reset dirty state
  useEffect(() => {
    if (justSaved) {
      console.log("Updating refs after save:");
      console.log("New header ref:", header);
      console.log("New items ref count:", items.length);
      initialHeaderRef.current = { ...header };
      initialItemsRef.current = [...items];
      setJustSaved(false);
    }
  }, [header, items, justSaved]);

  const applyHeaderTotals = (rows) => {
    const sum = (selector) => rows.reduce((acc, r) => acc + n(selector(r)), 0);
    const TaxableTotal = Number(sum((r) => r.TaxableAmount).toFixed(2));
    const CGSTAmount = Number(sum((r) => r.CGSTAmount).toFixed(2));
    const SGSTAmount = Number(sum((r) => r.SGSTAmount).toFixed(2));
    const IGSTAmount = Number(sum((r) => r.IGSTAmount).toFixed(2));
    const RoundedOff = n(header.RoundedOff || 0);
    const TotalAmount = Number(
      (TaxableTotal + CGSTAmount + SGSTAmount + IGSTAmount + RoundedOff).toFixed(2)
    );

    setHeader((prev) => ({
      ...prev,
      TaxableTotal,
      CGSTAmount,
      SGSTAmount,
      IGSTAmount,
      TotalAmount,
      RoundedOff,
    }));
  };

  const recalcRow = (row) => {
    const Qty = n(row.Qty);
    const Rate = n(row.Rate);
    const TaxableAmount = Qty * Rate;
    const CGSTAmount = TaxableAmount * n(row.CGSTPer) / 100;
    const SGSTAmount = TaxableAmount * n(row.SGSTPer) / 100;
    const IGSTAmount = TaxableAmount * n(row.IGSTPer) / 100;
    const Total = TaxableAmount + CGSTAmount + SGSTAmount + IGSTAmount;

    return {
      ...row,
      Qty: Number(Qty.toFixed(3)),
      Rate: Number(Rate.toFixed(2)),
      TaxableAmount: Number(TaxableAmount.toFixed(2)),
      CGSTAmount: Number(CGSTAmount.toFixed(2)),
      SGSTAmount: Number(SGSTAmount.toFixed(2)),
      IGSTAmount: Number(IGSTAmount.toFixed(2)),
      Total: Number(Total.toFixed(2)),
    };
  };

  const updateItem = (index, field, value) => {
    setItems((prev) => {
      const next = prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row));
      const recalculated = next.map((row) => recalcRow(row));
      applyHeaderTotals(recalculated);
      return recalculated;
    });
  };

  const removeRow = (index) => {
    setItems((prev) => {
      const filtered = prev.filter((_, idx) => idx !== index);
      const normalized = (filtered.length ? filtered : [makeEmptyItem(1)]).map((row, idx) => ({
        ...row,
        Srno: idx + 1,
      }));
      applyHeaderTotals(normalized);
      return normalized;
    });
  };

  const openItemModal = (index) => {
    setItemModalIndex(index);
    setItemSearch("");
    setHighlightIndex(0);
    setModalItem(null);
    setModalValues({
      Qty: 1,
      Rate: 0,
      TaxableAmount: 0,
      CGSTPer: 0,
      SGSTPer: 0,
      IGSTPer: 0,
      CGSTAmount: 0,
      SGSTAmount: 0,
      IGSTAmount: 0,
      Total: 0,
      SupplierInvNo: "",
      SupplierInvDate: "",
    });
    setItemModalOpen(true);
  };

  const closeItemModal = () => {
    // If modal is closed without selecting an item, remove empty rows
    if (!modalItem && itemModalIndex !== null) {
      setItems((prev) => {
        const filtered = prev.filter((row, idx) => {
          // Keep the row if it has an ItemCode or if it's not the row we were editing
          return row.ItemCode || idx !== itemModalIndex;
        });
        // Ensure at least one empty row exists
        const normalized = (filtered.length ? filtered : [makeEmptyItem(1)]).map((row, idx) => ({
          ...row,
          Srno: idx + 1,
        }));
        return normalized;
      });
    }
    
    setItemModalOpen(false);
    setModalItem(null);
    setItemModalIndex(null);
  };

  const selectItemFromModal = (item) => {
    setModalItem(item);
    
    const Qty = 1;
    const Rate = n(item.cost || 0);
    const CGSTPer = n(item.cgst || 0);
    const SGSTPer = n(item.sgst || 0);
    const IGSTPer = n(item.igst || 0);
    const TaxableAmount = Qty * Rate;
    const CGSTAmount = TaxableAmount * CGSTPer / 100;
    const SGSTAmount = TaxableAmount * SGSTPer / 100;
    const IGSTAmount = TaxableAmount * IGSTPer / 100;
    const Total = TaxableAmount + CGSTAmount + SGSTAmount + IGSTAmount;

    setModalValues({
      Qty,
      Rate,
      TaxableAmount: Number(TaxableAmount.toFixed(2)),
      CGSTPer,
      SGSTPer,
      IGSTPer,
      CGSTAmount: Number(CGSTAmount.toFixed(2)),
      SGSTAmount: Number(SGSTAmount.toFixed(2)),
      IGSTAmount: Number(IGSTAmount.toFixed(2)),
      Total: Number(Total.toFixed(2)),
      SupplierInvNo: item.suppinvno || "",
      SupplierInvDate: item.suppinvdt ? dateToInput(item.suppinvdt) : "",
    });
  };

  const ensureRowVisible = (idx) => {
    const el = document.getElementById(`purchase-return-item-${idx}`);
    if (el) {
      el.scrollIntoView({ block: "nearest" });
    }
  };

  const handleModalKeyDown = (event) => {
    if (!filteredItems.length) return;
    const maxIndex = filteredItems.length - 1;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightIndex((prev) => {
        const next = Math.min(prev + 1, maxIndex);
        ensureRowVisible(next);
        return next;
      });
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightIndex((prev) => {
        const next = Math.max(prev - 1, 0);
        ensureRowVisible(next);
        return next;
      });
    } else if (event.key === "Enter") {
      event.preventDefault();
      const chosen = filteredItems[highlightIndex] || filteredItems[0];
      if (chosen) selectItemFromModal(chosen);
    }
  };

  const setModalField = (field, value) => {
    const next = { ...modalValues, [field]: value };
    const Qty = n(next.Qty);
    const Rate = n(next.Rate);
    const CGSTPer = n(next.CGSTPer);
    const SGSTPer = n(next.SGSTPer);
    const IGSTPer = n(next.IGSTPer);

    const TaxableAmount = Qty * Rate;
    const CGSTAmount = TaxableAmount * CGSTPer / 100;
    const SGSTAmount = TaxableAmount * SGSTPer / 100;
    const IGSTAmount = TaxableAmount * IGSTPer / 100;
    const Total = TaxableAmount + CGSTAmount + SGSTAmount + IGSTAmount;

    setModalValues({
      Qty,
      Rate,
      TaxableAmount: Number(TaxableAmount.toFixed(2)),
      CGSTPer,
      SGSTPer,
      IGSTPer,
      CGSTAmount: Number(CGSTAmount.toFixed(2)),
      SGSTAmount: Number(SGSTAmount.toFixed(2)),
      IGSTAmount: Number(IGSTAmount.toFixed(2)),
      Total: Number(Total.toFixed(2)),
      SupplierInvNo: next.SupplierInvNo || "",
      SupplierInvDate: next.SupplierInvDate || "",
    });
  };

  const commitModalItem = (closeAfter = true) => {
    if (!modalItem || itemModalIndex == null) return;
    const rowData = {
      Srno: itemModalIndex + 1,
      ItemCode: modalItem.itemcode,
      ItemName: modalItem.itemname || "",
      Unit: modalItem.unit || "",
      Qty: n(modalValues.Qty),
      Rate: n(modalValues.Rate),
      TaxableAmount: modalValues.TaxableAmount,
      CGSTPer: n(modalValues.CGSTPer),
      SGSTPer: n(modalValues.SGSTPer),
      IGSTPer: n(modalValues.IGSTPer),
      CGSTAmount: modalValues.CGSTAmount,
      SGSTAmount: modalValues.SGSTAmount,
      IGSTAmount: modalValues.IGSTAmount,
      Total: modalValues.Total,
      Remark: "",
      SupplierInvNo: modalValues.SupplierInvNo || "",
      SupplierInvDate: modalValues.SupplierInvDate || "",
    };

    setItems((prev) => {
      const next = [...prev];
      next[itemModalIndex] = rowData;
      const normalized = next.map((row, idx) => ({ ...row, Srno: idx + 1 }));
      applyHeaderTotals(normalized);
      return normalized;
    });

    if (closeAfter) {
      closeItemModal();
    } else {
      setModalItem(null);
      setItemModalIndex((prev) => prev + 1);
      setItems((prev) => {
        const exists = prev[itemModalIndex + 1];
        if (!exists) {
          return [...prev, makeEmptyItem(prev.length + 1)];
        }
        return prev;
      });
      setModalValues({
        Qty: 1,
        Rate: 0,
        TaxableAmount: 0,
        CGSTPer: 0,
        SGSTPer: 0,
        IGSTPer: 0,
        CGSTAmount: 0,
        SGSTAmount: 0,
        IGSTAmount: 0,
        Total: 0,
      });
      setHighlightIndex(0);
      setItemSearch("");
      setTimeout(() => searchInputRef.current?.focus(), 0);
    }
  };

  const addNewRow = () => {
    setItems((prev) => {
      if (prev.some((row) => !row.ItemCode)) {
        const existingIndex = prev.findIndex((row) => !row.ItemCode);
        openItemModal(existingIndex);
        return prev;
      }
      const next = [...prev, makeEmptyItem(prev.length + 1)];
      openItemModal(next.length - 1);
      return next;
    });
  };

  const mapHeaderToApi = (post = false) => ({
    fyear_id: header.FYearID,
    purch_ret_no: header.PurchRetNo,
    tran_date: header.PurchRetDate,
    party_id: header.PartyID,
    taxable_total: header.TaxableTotal,
    cgst_amount: header.CGSTAmount,
    sgst_amount: header.SGSTAmount,
    igst_amount: header.IGSTAmount,
    rounded_off: header.RoundedOff,
    total_amount: header.TotalAmount,
    description: header.Remark,
    is_posted: post || header.IsPosted,
  });

  const mapItemsToApi = () =>
    items
      .filter((row) => row.ItemCode)
      .map((row) => ({
        srno: row.Srno,
        itemcode: row.ItemCode,
        unit: row.Unit,
        qty: row.Qty,
        rate: row.Rate,
        taxable_amount: row.TaxableAmount,
        cgst_per: row.CGSTPer,
        sgst_per: row.SGSTPer,
        igst_per: row.IGSTPer,
        cgst_amount: row.CGSTAmount,
        sgst_amount: row.SGSTAmount,
        igst_amount: row.IGSTAmount,
        total_amount: row.Total,
        description: row.Remark,
        supp_inv_no: row.SupplierInvNo,
        supp_inv_date: row.SupplierInvDate,
      }));

  const generateNextReturnNo = async () => {
    try {
      const params = header.FYearID ? { fyear_id: header.FYearID } : {};
      console.log("Frontend: Generating next return number with params:", params);
      const res = await axios.get("http://localhost:5000/api/purchase-return/next-number", { params });
      console.log("Frontend: API response:", res.data);
      const next = res.data?.next_no || "1";
      console.log("Frontend: Generated return number:", next);
      
      // Return the generated number - don't update state here
      return String(next);
    } catch (error) {
      console.error("Frontend: Error generating return number:", error);
      return "1";
    }
  };

  const handleSave = async (post = false) => {
    if (!header.PartyID) {
      setNoticeMessage("warning", "Select a supplier before saving");
      return;
    }

    if (!header.PurchRetDate) {
      setNoticeMessage("warning", "Please select a return date before saving");
      return;
    }

    // Validate transaction date against accounting period
    try {
      const validation = await validateTransactionDate(header.PurchRetDate);
      if (!validation.isValid) {
        setNoticeMessage("error", validation.message);
        setSaving(false);
        return;
      }
    } catch (error) {
      setNoticeMessage("error", "Error validating transaction date");
      setSaving(false);
      return;
    }

    if (!items.some((row) => row.ItemCode)) {
      setNoticeMessage("warning", "Add at least one item before saving");
      return;
    }

    // Final safety check before saving
    try {
      const finalValidation = await validateTransactionDate(header.PurchRetDate);
      if (!finalValidation.isValid) {
        setNoticeMessage("error", `Cannot save: ${finalValidation.message}`);
        return;
      }
    } catch (error) {
      setNoticeMessage("error", "Cannot save: Error validating transaction date");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        header: mapHeaderToApi(post),
        items: mapItemsToApi(),
      };

      if (initialData?.pret_id) {
        await axios.put(
          `http://localhost:5000/api/purchase-return/${initialData.pret_id}`,
          payload.header
        );
        await axios.post(
          `http://localhost:5000/api/purchase-return/${initialData.pret_id}/items/replace`,
          { items: payload.items, fyear_id: header.FYearID }
        );
        setNoticeMessage("success", "Purchase return updated successfully");
      } else {
        let finalReturnNumber = header.PurchRetNo;
        
        if (!header.PurchRetNo || header.PurchRetNo === "NEW") {
          console.log("Frontend: Current PurchRetNo is NEW, generating number...");
          const generatedNumber = await generateNextReturnNo();
          console.log("Frontend: Generated number:", generatedNumber);
          payload.header.purch_ret_no = generatedNumber;
          finalReturnNumber = generatedNumber;
          console.log("Frontend: Set finalReturnNumber to:", finalReturnNumber);
        }
        
        console.log("Frontend: Saving with payload:", payload.header);
        const saveResponse = await axios.post("http://localhost:5000/api/purchase-return", payload);
        console.log("Frontend: Save response:", saveResponse.data);
        
        // Use the return number from the server response (most reliable)
        const actualSavedNumber = saveResponse.data?.purch_ret_no;
        console.log("Frontend: Actual saved number from server:", actualSavedNumber);
        
        if (actualSavedNumber) {
          finalReturnNumber = String(actualSavedNumber);
          console.log("Frontend: Using server response number:", finalReturnNumber);
        }
        
        setNoticeMessage("success", "Purchase return created successfully");
        
        // Update the header state with the actual saved number
        if (finalReturnNumber !== header.PurchRetNo) {
          console.log("Frontend: Updating header PurchRetNo from", header.PurchRetNo, "to", finalReturnNumber);
          setHeader((prev) => ({ ...prev, PurchRetNo: finalReturnNumber }));
        }
      }

      // Update header state if needed
      if (header.PurchRetNo === "NEW" && payload.header?.purch_ret_no) {
        setHeader((prev) => ({ ...prev, PurchRetNo: payload.header.purch_ret_no }));
      }

      if (post) {
        setHeader((prev) => ({ ...prev, IsPosted: true }));
      }

      // Update refs after all React state updates and calculations are processed
      console.log("Save completed, scheduling state capture");
      setTimeout(() => {
        console.log("Capturing saved state after calculations");
        // Use a callback to get the most current state after all updates
        setHeader(currentHeader => {
          setItems(currentItems => {
            // Capture the actual current state after all calculations
            setLastSavedState({
              header: { ...currentHeader },
              items: [...currentItems]
            });
            setJustSaved(true);
            return currentItems;
          });
          return currentHeader;
        });
      }, 100); // Longer delay to ensure all calculations are complete

      // Form should remain open after save/post - removed onSaved callback
      // onSaved?.();
      
      // Refresh parent list data without closing form
      onDataChanged?.();
    } catch (error) {
      console.error(error);
      let message = "Failed to save";
      
      if (error?.response?.data) {
        const data = error.response.data;
        // If data is an object with an 'error' property, use that
        if (typeof data === 'object' && data.error) {
          message = typeof data.error === 'string' ? data.error : String(data.error);
        } 
        // If data has a 'message' property, use that
        else if (typeof data === 'object' && data.message) {
          message = typeof data.message === 'string' ? data.message : String(data.message);
        }
        // If data is a string, use it directly
        else if (typeof data === 'string') {
          message = data;
        }
      } else if (error?.message) {
        message = error.message;
      }
      
      setNoticeMessage("error", message);
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = async () => {
    if (!initialData?.pret_id) {
      setNoticeMessage("warning", "Save the purchase return before printing");
      return;
    }

    try {
      // Get company data and all items (for HSN codes)
      const [compRes, itemsRes] = await Promise.all([
        axios.get("http://localhost:5000/api/company"),
        axios.get("http://localhost:5000/api/items/all")
      ]);
      const company = compRes.data || {};
      const allItems = itemsRes.data || [];

      // Format data for printing
      const safe = (v) => (v == null ? '' : String(v));
      const fmt = (v) => formatNumber(v);
      
      // Helper function to get HSN code from item master
      const itemMap = new Map(allItems.map(it => [String(it.itemcode), it]));
      const getHSN = (itemCode) => {
        const code = itemCode ? String(itemCode) : '';
        const item = itemMap.get(code);
        return (
          item?.hsncode ??
          item?.HSNCode ??
          item?.hsn_code ??
          '00000000'
        );
      };
      
      // Get supplier info
      const supplier = suppliers.find(s => String(s.partyid) === String(header.PartyID)) || {};
      
      // Filter items that have ItemCode
      const printItems = items.filter(item => item.ItemCode);
      
      // Group items by HSN and tax rate for HSN summary
      const hsnGroups = {};
      printItems.forEach(item => {
        const hsnCode = getHSN(item.ItemCode);
        const totalTaxRate = n(item.CGSTPer) + n(item.SGSTPer) + n(item.IGSTPer);
        // Create a key based on HSN and tax rates to group items properly
        const hsnKey = `${hsnCode}_${totalTaxRate}`;
        
        if (!hsnGroups[hsnKey]) {
          hsnGroups[hsnKey] = {
            hsn: hsnCode,
            taxable: 0,
            cgstRate: item.CGSTPer,
            sgstRate: item.SGSTPer,
            igstRate: item.IGSTPer,
            cgstAmt: 0,
            sgstAmt: 0,
            igstAmt: 0,
            totalTax: 0
          };
        }
        hsnGroups[hsnKey].taxable += n(item.TaxableAmount);
        hsnGroups[hsnKey].cgstAmt += n(item.CGSTAmount);
        hsnGroups[hsnKey].sgstAmt += n(item.SGSTAmount);
        hsnGroups[hsnKey].igstAmt += n(item.IGSTAmount);
        hsnGroups[hsnKey].totalTax += n(item.CGSTAmount) + n(item.SGSTAmount) + n(item.IGSTAmount);
      });

      const hsnSummary = Object.values(hsnGroups);

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <title>Purchase Return Invoice - ${header.PurchRetNo}</title>
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
              <div class="title">Purchase Return Invoice</div>

              <!-- Invoice Details -->
              <div class="invoice-details">
                <div class="left-details">
                  <div><strong>Trn #:</strong> ${safe(header.PurchRetNo)}</div>
                  <div><strong>Trn Date:</strong> ${header.PurchRetDate ? new Date(header.PurchRetDate + 'T00:00:00').toLocaleDateString() : ''}</div>
                </div>
                <div class="right-details">
                  <div><strong>Supplier:</strong> ${safe(supplier?.partyname || header.PartyName)}</div>
                  <div>${safe(supplier?.address1 || '')}</div>
                  <div>GST: ${safe(supplier?.gstnum || '')}</div>
                  <div>Contact: ${safe(supplier?.contactno || '')}</div>
                </div>
              </div>

              <!-- Items Table -->
              <table class="items-table">
                <thead>
                  <tr>
                    <th style="width: 25px;">Sr#</th>
                    <th style="width: 160px;">Item</th>
                    <th style="width: 60px;">HSN/SAC</th>
                    <th style="width: 70px;">Supp. Inv#</th>
                    <th style="width: 70px;">Supp. Inv Dt</th>
                    <th style="width: 45px;">Qty</th>
                    <th style="width: 55px;">Rate</th>
                    <th style="width: 70px;">Taxable Amt</th>
                    <th style="width: 45px;">GST%</th>
                    <th style="width: 65px;">GST Amt</th>
                    <th style="width: 70px;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${printItems.map((item, index) => {
                    const totalTaxRate = n(item.CGSTPer) + n(item.SGSTPer) + n(item.IGSTPer);
                    const hsnCode = getHSN(item.ItemCode);
                    return `
                    <tr>
                      <td class="text-center">${index + 1}</td>
                      <td>${safe(item.ItemName)}</td>
                      <td class="text-center">${hsnCode}</td>
                      <td class="text-center">${safe(item.SupplierInvNo)}</td>
                      <td class="text-center">${item.SupplierInvDate ? new Date(item.SupplierInvDate + 'T00:00:00').toLocaleDateString() : ''}</td>
                      <td class="text-right">${fmt(n(item.Qty).toFixed(2))}</td>
                      <td class="text-right">${fmt(n(item.Rate).toFixed(2))}</td>
                      <td class="text-right">${fmt(n(item.TaxableAmount).toFixed(2))}</td>
                      <td class="text-center">${totalTaxRate.toFixed(0)}%</td>
                      <td class="text-right">${fmt((n(item.CGSTAmount) + n(item.SGSTAmount) + n(item.IGSTAmount)).toFixed(2))}</td>
                      <td class="text-right">${fmt(n(item.Total).toFixed(2))}</td>
                    </tr>
                    `;
                  }).join('')}
                  <tr style="background-color: #f0f0f0; font-weight: bold;">
                    <td class="text-center" colspan="5">Total</td>
                    <td class="text-right">${fmt(printItems.reduce((sum, item) => sum + n(item.Qty), 0).toFixed(2))}</td>
                    <td></td>
                    <td class="text-right">${fmt(header.TaxableTotal.toFixed(2))}</td>
                    <td></td>
                    <td class="text-right">${fmt((header.CGSTAmount + header.SGSTAmount + header.IGSTAmount).toFixed(2))}</td>
                    <td class="text-right">${fmt(header.TotalAmount.toFixed(2))}</td>
                  </tr>
                </tbody>
              </table>

              <!-- Summary Section -->
              <div class="summary-section">
                <!-- HSN Summary -->
                <div class="hsn-summary">
                  <table class="hsn-table">
                    <thead>
                      <tr>
                        <th>HSN/SAC</th>
                        <th>Taxable</th>
                        <th>CGST%</th>
                        <th>CGST AMT</th>
                        <th>SGST%</th>
                        <th>SGST AMT</th>
                        <th>Total Tax</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${hsnSummary.map(hsn => `
                        <tr>
                          <td class="text-center">${hsn.hsn}</td>
                          <td class="text-right">${fmt(hsn.taxable.toFixed(2))}</td>
                          <td class="text-center">${hsn.cgstRate.toFixed(0)}%</td>
                          <td class="text-right">${fmt(hsn.cgstAmt.toFixed(2))}</td>
                          <td class="text-center">${hsn.sgstRate.toFixed(0)}%</td>
                          <td class="text-right">${fmt(hsn.sgstAmt.toFixed(2))}</td>
                          <td class="text-right">${fmt(hsn.totalTax.toFixed(2))}</td>
                        </tr>
                      `).join('')}
                      <tr style="background-color: #f0f0f0; font-weight: bold;">
                        <td class="text-center">Total</td>
                        <td class="text-right">${fmt(header.TaxableTotal.toFixed(2))}</td>
                        <td></td>
                        <td class="text-right">${fmt(header.CGSTAmount.toFixed(2))}</td>
                        <td></td>
                        <td class="text-right">${fmt(header.SGSTAmount.toFixed(2))}</td>
                        <td class="text-right">${fmt((header.CGSTAmount + header.SGSTAmount + header.IGSTAmount).toFixed(2))}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <!-- Totals Summary -->
                <div class="totals-summary">
                  <table>
                    <tr>
                      <td class="label">Taxable Total</td>
                      <td class="amount">${fmt(header.TaxableTotal.toFixed(2))}</td>
                    </tr>
                    <tr>
                      <td class="label">SGST Amount</td>
                      <td class="amount">${fmt(header.SGSTAmount.toFixed(2))}</td>
                    </tr>
                    <tr>
                      <td class="label">CGST Amount</td>
                      <td class="amount">${fmt(header.CGSTAmount.toFixed(2))}</td>
                    </tr>
                    <tr>
                      <td class="label">IGST Amount</td>
                      <td class="amount">${fmt(header.IGSTAmount.toFixed(2))}</td>
                    </tr>
                    <tr>
                      <td class="label">Rounded Off</td>
                      <td class="amount">${fmt(header.RoundedOff.toFixed(2))}</td>
                    </tr>
                    <tr class="grand-total">
                      <td class="label">Total Amount</td>
                      <td class="amount">${fmt(header.TotalAmount.toFixed(2))}</td>
                    </tr>
                  </table>
                </div>
              </div>
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

    } catch (error) {
      console.error('Print error:', error);
      setNoticeMessage("error", "Failed to generate print view");
    }
  };

  const handlePost = async () => {
    if (!initialData?.pret_id) {
      setNoticeMessage("warning", "Save the purchase return before posting");
      return;
    }

    if (!header.PartyID) {
      setNoticeMessage("warning", "Select a supplier before posting");
      return;
    }

    if (!header.PurchRetDate) {
      setNoticeMessage("warning", "Please select a return date before posting");
      return;
    }

    setSaving(true);
    try {
      const payload = mapHeaderToApi(true);
      const response = await axios.put(
        `http://localhost:5000/api/purchase-return/${initialData.pret_id}`,
        payload
      );

      if (!response?.data?.success) {
        throw new Error("Posting failed: no confirmation from server");
      }

      const nowPosted = !!response?.data?.posted;
      if (!nowPosted) {
        throw new Error("Posting failed: backend did not confirm posting");
      }

      setNoticeMessage("success", "Purchase return posted successfully");
      setHeader((prev) => ({ ...prev, IsPosted: true }));
      onDataChanged?.();
    } catch (error) {
      console.error(error);
      const message = error?.response?.data?.message || error?.response?.data?.error || error?.message || "Failed to post purchase return";
      try {
        await axios.put(
          `http://localhost:5000/api/purchase-return/${initialData.pret_id}`,
          { ...mapHeaderToApi(false), is_posted: false }
        );
      } catch (rollbackErr) {
        console.error("Rollback failed", rollbackErr);
      }
      setHeader((prev) => ({ ...prev, IsPosted: false }));
      setNoticeMessage("error", `${message}. Please contact the system administrator.`);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (isDirty) {
      const shouldClose = window.confirm("Discard changes?");
      if (!shouldClose) return;
    }
    onClose?.();
  };

  const currentIndex = initialData?.purch_ret_id 
    ? allReturns.findIndex(r => r.purch_ret_id === initialData.purch_ret_id)
    : -1;

  const handleNew = async () => {
    const selectedFYearID = localStorage.getItem("selectedFYearID");
    if (!selectedFYearID) {
      setNoticeMessage("warning", "Please select an accounting period first");
      return;
    }
    await resetForm();
  };

  return (
    <div className="space-y-4 max-w-[104rem] mx-auto">
      <NoticeBanner notice={notice} onClose={() => setNotice({ open: false })} />

      {/* Form header controls + status */}
      <div className="flex items-start justify-between">
        {/* Left: section heading and command buttons */}
        <div className="flex flex-col gap-3">
          <h2 className="text-2xl font-semibold text-gray-900">Purchase Return</h2>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleNew}
              className="px-4 py-2 rounded-lg border bg-white text-gray-800 hover:bg-gray-50"
            >
              New
            </button>
            <button
              disabled={saving || header.IsPosted || !isDirty}
              onClick={() => handleSave(false)}
              className="px-4 py-2 rounded-lg text-white shadow bg-gradient-to-r from-purple-400 to-purple-600 hover:from-purple-500 hover:to-purple-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              disabled={!initialData?.pret_id}
              onClick={handlePrint}
              className="px-4 py-2 rounded-lg border bg-white text-gray-800 hover:bg-gray-50 disabled:opacity-50"
              title="Print current return"
            >
              Print
            </button>
            <button
              disabled={saving || header.IsPosted || !initialData?.pret_id}
              onClick={handlePost}
              className="px-4 py-2 rounded-lg border bg-white text-gray-800 hover:bg-gray-50 disabled:opacity-50"
            >
              Post
            </button>
            <button
              onClick={handleClose}
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
            <span>{currentIndex >= 0 ? `${currentIndex + 1} / ${allReturns.length}` : `0 / ${allReturns.length}`}</span>
            <button
              title="Previous"
              onClick={() => {
                if (currentIndex > 0 && onNavigate) {
                  onNavigate(allReturns[currentIndex - 1]);
                }
              }}
              className="px-2 py-1 border rounded disabled:opacity-50"
              disabled={currentIndex <= 0}
            >
              ‹
            </button>
            <button
              title="Next"
              onClick={() => {
                if (currentIndex >= 0 && currentIndex < allReturns.length - 1 && onNavigate) {
                  onNavigate(allReturns[currentIndex + 1]);
                }
              }}
              className="px-2 py-1 border rounded disabled:opacity-50"
              disabled={currentIndex < 0 || currentIndex >= allReturns.length - 1}
            >
              ›
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold shadow ${header.IsPosted ? 'bg-gray-200 text-gray-600 line-through' : 'bg-purple-600 text-white'}`}>
              DRAFT
            </span>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold shadow ${header.IsPosted ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
              POSTED
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {/* Header fields - 3 fields in first line, Remark in second line */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* First Line: Return No, Return Date, Supplier */}
          <div>
            <label className="block text-sm text-gray-600">Return No</label>
            <input
              type="text"
              value={header.PurchRetNo}
              onChange={(event) =>
                setHeader((prev) => ({ ...prev, PurchRetNo: event.target.value }))
              }
              className="mt-1 w-full px-3 py-2 rounded border border-gray-300"
              readOnly={!!initialData?.pret_id}
              disabled={!!initialData?.pret_id}
              title="Auto-generated during Save"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600">Return Date</label>
            <input
              type="date"
              value={header.PurchRetDate}
              onChange={async (event) => {
                const newDate = event.target.value;
                setHeader((prev) => ({ ...prev, PurchRetDate: newDate }));
                
                // Real-time validation of transaction date
                if (newDate) {
                  try {
                    const validation = await validateTransactionDate(newDate);
                    if (!validation.isValid) {
                      setNoticeMessage("error", validation.message);
                    }
                  } catch (error) {
                    setNoticeMessage("error", "Error validating transaction date");
                  }
                }
              }}
              className="mt-1 w-full px-3 py-2 rounded border border-gray-300"
              disabled={header.IsPosted}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600">Supplier</label>
            <select
              value={header.PartyID}
              onChange={(event) => {
                const partyId = event.target.value;
                const party = suppliers.find((item) => String(item.partyid) === String(partyId));
                setHeader((prev) => ({
                  ...prev,
                  PartyID: partyId,
                  PartyName: party?.partyname || "",
                }));
              }}
              className="mt-1 w-full px-3 py-2 rounded border border-gray-300"
              disabled={header.IsPosted}
            >
              <option value="">-- Select --</option>
              {suppliers.map((supplier) => (
                <option key={supplier.partyid} value={supplier.partyid}>
                  {supplier.partyname}
                </option>
              ))}
            </select>
          </div>
          {/* Second Line: Remark (spans full width) */}
          <div className="md:col-span-3">
            <label className="block text-sm text-gray-600">Remark</label>
            <input
              type="text"
              value={header.Remark}
              onChange={(event) =>
                setHeader((prev) => ({ ...prev, Remark: event.target.value }))
              }
              className="mt-1 w-full px-3 py-2 border rounded border-gray-300"
              disabled={header.IsPosted}
            />
          </div>
        </div>

        <section className="bg-white border border-gray-200 rounded-xl shadow-sm">
          <div className="px-6 pt-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setActiveTab("items")}
                className={`px-4 py-2 text-sm rounded-lg font-semibold transition-colors ${
                  activeTab === "items"
                    ? "bg-emerald-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Items
              </button>

            </div>
            <div className="space-x-2">
              <button
                type="button"
                onClick={addNewRow}
                className="inline-flex items-center px-3 py-2 text-sm font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={header.IsPosted}
              >
                + Add Item
              </button>
            </div>
          </div>

          {activeTab === "items" && (
            <div className="px-4 pb-4 pt-1">
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="min-w-full text-sm border-collapse">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500 tracking-wide">
                    <tr>
                      <th className="px-1 py-2 text-center border-r border-gray-200" style={{width: '40px'}}>#</th>
                      <th className="px-1 py-2 text-left border-r border-gray-200" style={{width: '300px'}}>Item</th>
                      <th className="px-1 py-2 text-right border-r border-gray-200" style={{width: '60px'}}>Qty</th>
                      <th className="px-1 py-2 text-right border-r border-gray-200" style={{width: '80px'}}>Rate</th>
                      <th className="px-1 py-2 text-right border-r border-gray-200" style={{width: '90px'}}>Taxable</th>
                      <th className="px-1 py-2 text-center border-r border-gray-200" style={{width: '120px'}}>
                        <div className="text-center">CGST</div>
                        <div className="flex justify-between text-xs mt-1">
                          <span>%</span>
                          <span>Amt</span>
                        </div>
                      </th>
                      <th className="px-1 py-2 text-center border-r border-gray-200" style={{width: '120px'}}>
                        <div className="text-center">SGST</div>
                        <div className="flex justify-between text-xs mt-1">
                          <span>%</span>
                          <span>Amt</span>
                        </div>
                      </th>
                      <th className="px-1 py-2 text-center border-r border-gray-200" style={{width: '120px'}}>
                        <div className="text-center">IGST</div>
                        <div className="flex justify-between text-xs mt-1">
                          <span>%</span>
                          <span>Amt</span>
                        </div>
                      </th>
                      <th className="px-1 py-2 text-right border-r border-gray-200" style={{width: '90px'}}>Total</th>
                      <th className="px-1 py-2 text-left border-r border-gray-200" style={{width: '120px'}}>Supp. Inv. No</th>
                      <th className="px-1 py-2 text-left border-r border-gray-200" style={{width: '120px'}}>Supp. Inv. Date</th>
                      <th className="px-1 py-2 text-center" style={{width: '80px'}}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row, index) => (
                      <tr key={row.Srno} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-1 py-2 font-semibold text-gray-700 text-center border-r border-gray-100">{row.Srno}</td>
                        <td className={`px-1 py-2 border-r border-gray-100 ${!header.IsPosted ? 'cursor-pointer' : 'cursor-not-allowed'}`} onClick={!header.IsPosted ? () => openItemModal(index) : undefined}>
                          <span className="text-sm text-gray-900">
                            {row.ItemName || "Select an item"}
                          </span>
                        </td>
                        <td className="px-1 py-2 text-right border-r border-gray-100">
                          <input
                            type="number"
                            value={row.Qty}
                            onChange={(event) => updateItem(index, "Qty", parseNumber(event.target.value))}
                            className="w-full border border-gray-300 rounded px-1 py-1 text-xs text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            min="0"
                            disabled={header.IsPosted}
                          />
                        </td>
                        <td className="px-1 py-2 text-right border-r border-gray-100">
                          <input
                            type="number"
                            value={row.Rate}
                            onChange={(event) => updateItem(index, "Rate", parseNumber(event.target.value))}
                            className="w-full border border-gray-300 rounded px-1 py-1 text-xs text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            min="0"
                            disabled={header.IsPosted}
                          />
                        </td>
                        <td className="px-1 py-2 text-gray-800 font-semibold text-right border-r border-gray-100">
                          {formatNumber(row.TaxableAmount)}
                        </td>
                        <td className="px-1 py-2 border-r border-gray-100">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              value={row.CGSTPer}
                              onChange={(event) => updateItem(index, "CGSTPer", parseNumber(event.target.value))}
                              className="w-12 border border-gray-300 rounded px-1 py-1 text-xs text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              placeholder="%"
                              max="99.99"
                              disabled={header.IsPosted}
                            />
                            <div className="text-xs bg-gray-100 border rounded px-1 py-1 text-right w-12">
                              {formatNumber(row.CGSTAmount)}
                            </div>
                          </div>
                        </td>
                        <td className="px-1 py-2 border-r border-gray-100">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              value={row.SGSTPer}
                              onChange={(event) => updateItem(index, "SGSTPer", parseNumber(event.target.value))}
                              className="w-12 border border-gray-300 rounded px-1 py-1 text-xs text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              placeholder="%"
                              max="99.99"
                              disabled={header.IsPosted}
                            />
                            <div className="text-xs bg-gray-100 border rounded px-1 py-1 text-right w-12">
                              {formatNumber(row.SGSTAmount)}
                            </div>
                          </div>
                        </td>
                        <td className="px-1 py-2 border-r border-gray-100">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              value={row.IGSTPer}
                              onChange={(event) => updateItem(index, "IGSTPer", parseNumber(event.target.value))}
                              className="w-12 border border-gray-300 rounded px-1 py-1 text-xs text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              placeholder="%"
                              max="99.99"
                              disabled={header.IsPosted}
                            />
                            <div className="text-xs bg-gray-100 border rounded px-1 py-1 text-right w-12">
                              {formatNumber(row.IGSTAmount)}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-gray-800 font-semibold text-right">
                          {formatNumber(n(row.Total).toFixed(2))}
                        </td>
                        <td className="px-3 py-2 text-left">
                          <span className="text-xs text-gray-600">{row.SupplierInvNo || '-'}</span>
                        </td>
                        <td className="px-3 py-2 text-left">
                          <span className="text-xs text-gray-600">{row.SupplierInvDate || '-'}</span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeRow(index)}
                            className="inline-flex items-center px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={header.IsPosted}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                    {/* Totals Row */}
                    <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold text-gray-700">
                      <td className="px-1 py-2 text-center border-r border-gray-100"></td>
                      <td className="px-1 py-2 text-right border-r border-gray-100">Totals:</td>
                      <td className="px-1 py-2 text-right border-r border-gray-100">
                        {formatNumber(items.reduce((sum, row) => sum + n(row.Qty), 0).toFixed(2))}
                      </td>
                      <td className="px-1 py-2 text-right border-r border-gray-100"></td>
                      <td className="px-1 py-2 text-right border-r border-gray-100">
                        {formatNumber(items.reduce((sum, row) => sum + n(row.TaxableAmount), 0).toFixed(2))}
                      </td>
                      <td className="px-1 py-2 border-r border-gray-100">
                        <div className="flex items-center gap-1">
                          <div className="w-8"></div>
                          <div className="text-xs bg-gray-200 border rounded px-1 py-1 text-right w-12 font-semibold">
                            {formatNumber(items.reduce((sum, row) => sum + n(row.CGSTAmount), 0).toFixed(2))}
                          </div>
                        </div>
                      </td>
                      <td className="px-1 py-2 border-r border-gray-100">
                        <div className="flex items-center gap-1">
                          <div className="w-8"></div>
                          <div className="text-xs bg-gray-200 border rounded px-1 py-1 text-right w-12 font-semibold">
                            {formatNumber(items.reduce((sum, row) => sum + n(row.SGSTAmount), 0).toFixed(2))}
                          </div>
                        </div>
                      </td>
                      <td className="px-1 py-2 border-r border-gray-100">
                        <div className="flex items-center gap-1">
                          <div className="w-8"></div>
                          <div className="text-xs bg-gray-200 border rounded px-1 py-1 text-right w-12 font-semibold">
                            {formatNumber(items.reduce((sum, row) => sum + n(row.IGSTAmount), 0).toFixed(2))}
                          </div>
                        </div>
                      </td>
                      <td className="px-1 py-2 text-right border-r border-gray-100">
                        {formatNumber(items.reduce((sum, row) => sum + n(row.Total), 0).toFixed(2))}
                      </td>
                      <td className="px-1 py-2 border-r border-gray-100"></td>
                      <td className="px-1 py-2 border-r border-gray-100"></td>
                      <td className="px-1 py-2 text-center"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              {/* Summary Information */}
              <div className="mt-4 flex justify-end">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 w-80">
                  <div className="space-y-3 text-sm">
                    {/* 1st Line: Taxable Total */}
                    <div className="flex justify-between">
                      <span>Taxable Total:</span>
                      <span className="font-semibold">{formatNumber(header.TaxableTotal)}</span>
                    </div>
                    
                    {/* 2nd Line: GST Amount */}
                    <div className="flex justify-between">
                      <span>GST Amount:</span>
                      <span className="font-semibold">
                        {formatNumber(header.CGSTAmount + header.SGSTAmount + header.IGSTAmount)}
                      </span>
                    </div>
                    
                    {/* 3rd Line: Total Amount */}
                    <div className="flex justify-between">
                      <span>Total Amount:</span>
                      <span className="font-semibold">
                        {formatNumber((header.TaxableTotal + header.CGSTAmount + header.SGSTAmount + header.IGSTAmount).toFixed(2))}
                      </span>
                    </div>
                    
                    {/* 4th Line: Adjustment */}
                    <div className="flex justify-between items-center">
                      <label>Adjustment:</label>
                      <input
                        type="number"
                        value={header.RoundedOff}
                        onChange={(event) => {
                          const newRoundedOff = parseNumber(event.target.value);
                          setHeader((prev) => {
                            const TaxableTotal = prev.TaxableTotal;
                            const CGSTAmount = prev.CGSTAmount;
                            const SGSTAmount = prev.SGSTAmount;
                            const IGSTAmount = prev.IGSTAmount;
                            const TotalAmount = Number(
                              (TaxableTotal + CGSTAmount + SGSTAmount + IGSTAmount + newRoundedOff).toFixed(2)
                            );
                            return {
                              ...prev,
                              RoundedOff: newRoundedOff,
                              TotalAmount,
                            };
                          });
                        }}
                        className="w-24 border border-gray-300 rounded px-2 py-1 text-sm text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        disabled={header.IsPosted}
                      />
                    </div>
                    
                    {/* 5th Line: Grand Total */}
                    <div className="flex justify-between border-t pt-2 mt-2">
                      <span className="font-bold">Grand Total:</span>
                      <span className="font-bold text-lg">
                        {formatNumber(header.TotalAmount.toFixed(2))}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}


        </section>
      </div>

      {itemModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded shadow-lg w-full max-w-7xl max-h-[95vh] flex flex-col">
            <div className="p-3 border-b flex items-center justify-between">
              <div className="font-semibold">Select Item</div>
              <button onClick={closeItemModal} className="px-2 py-1 border rounded">Close</button>
            </div>
            <div className="flex flex-1 overflow-hidden">
              {/* Left: searchable list with keyboard navigation */}
              <div className="w-1/2 border-r flex flex-col">
                <div className="p-3 border-b">
                  <input
                    ref={searchInputRef}
                    placeholder="Search by code or name..."
                    value={itemSearch}
                    onChange={(event) => { setItemSearch(event.target.value); setHighlightIndex(0); }}
                    onKeyDown={handleModalKeyDown}
                    className="border p-2 rounded w-full"
                    autoFocus
                  />
                </div>
                <div className="overflow-y-auto flex-1" tabIndex={0} onKeyDown={handleModalKeyDown}>
                  <SearchableItemTable
                    items={filteredItems}
                    highlightIndex={highlightIndex}
                    onSelect={selectItemFromModal}
                    onHover={setHighlightIndex}
                    tableId="purchase-return-item"
                  />
                </div>
              </div>

              {/* Right: details pane + quantity/rate + calculated totals */}
              <div className="w-1/2 flex flex-col">
                {modalItem ? (
                  <div className="p-3 space-y-3 flex-1 overflow-y-auto">
                    {/* Selected Item Display */}
                    <div>
                      <label className="block text-xs text-gray-600">Selected Item</label>
                      <textarea 
                        readOnly 
                        value={modalItem.itemname || ''} 
                        rows={2} 
                        className="w-full border rounded p-2 resize-none bg-gray-50" 
                      />
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                        <span>Code: {modalItem.itemcode}</span>
                        {modalItem.unit && <span>Unit: {modalItem.unit}</span>}
                        {modalItem.hsncode && <span>HSN: {modalItem.hsncode}</span>}
                      </div>
                    </div>

                    {/* GST % inputs */}
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <label className="block text-xs text-gray-600">CGST %</label>
                        <input
                          type="number"
                          value={modalValues.CGSTPer}
                          onChange={(event) => setModalField("CGSTPer", event.target.value)}
                          className="w-full border rounded p-2 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600">SGST %</label>
                        <input
                          type="number"
                          value={modalValues.SGSTPer}
                          onChange={(event) => setModalField("SGSTPer", event.target.value)}
                          className="w-full border rounded p-2 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600">IGST %</label>
                        <input
                          type="number"
                          value={modalValues.IGSTPer}
                          onChange={(event) => setModalField("IGSTPer", event.target.value)}
                          className="w-full border rounded p-2 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>
                    </div>

                    {/* Qty / Rate */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <label className="block text-xs text-gray-600">Qty</label>
                        <input
                          ref={qtyInputRef}
                          type="number"
                          value={modalValues.Qty}
                          onChange={(event) => setModalField("Qty", event.target.value)}
                          className="w-full border rounded p-3 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          min="0"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600">Rate</label>
                        <input
                          ref={rateInputRef}
                          type="number"
                          value={modalValues.Rate}
                          onChange={(event) => setModalField("Rate", event.target.value)}
                          className="w-full border rounded p-3 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          min="0"
                        />
                      </div>
                    </div>

                    {/* Supplier Invoice Details */}
                    <div className="grid grid-cols-2 gap-3 text-sm bg-blue-50 border border-blue-200 rounded p-3">
                      <div>
                        <label className="block text-xs text-blue-700 font-semibold">Supplier Invoice No.</label>
                        <input
                          type="text"
                          value={modalValues.SupplierInvNo}
                          onChange={(event) => setModalField("SupplierInvNo", event.target.value)}
                          placeholder="Enter supplier invoice number"
                          className="w-full border border-blue-300 rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-blue-700 font-semibold">Supplier Invoice Date</label>
                        <input
                          type="date"
                          value={modalValues.SupplierInvDate}
                          onChange={(event) => setModalField("SupplierInvDate", event.target.value)}
                          className="w-full border border-blue-300 rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    {/* Calculated preview */}
                    <div className="mt-4 p-3 bg-gray-50 rounded border text-sm space-y-2">
                      <div className="flex justify-between">
                        <span>Taxable Value:</span>
                        <span className="font-semibold">{formatNumber(modalValues.TaxableAmount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>CGST Amount ({modalValues.CGSTPer}%):</span>
                        <span className="font-semibold">{formatNumber(modalValues.CGSTAmount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>SGST Amount ({modalValues.SGSTPer}%):</span>
                        <span className="font-semibold">{formatNumber(modalValues.SGSTAmount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>IGST Amount ({modalValues.IGSTPer}%):</span>
                        <span className="font-semibold">{formatNumber(modalValues.IGSTAmount)}</span>
                      </div>
                      <div className="flex justify-between border-t pt-2 text-base font-semibold">
                        <span>Total Value:</span>
                        <span>{formatNumber(modalValues.Total)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-3 border-t">
                      <button
                        type="button"
                        onClick={() => commitModalItem(false)}
                        className="px-3 py-2 border rounded text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                      >
                        Add & Continue
                      </button>
                      <button
                        type="button"
                        onClick={() => commitModalItem(true)}
                        className="px-3 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                      >
                        Add Item
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-gray-500">
                    <div className="text-center">
                      <div className="text-lg mb-2">👈</div>
                      <div>Select an item from the list</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}