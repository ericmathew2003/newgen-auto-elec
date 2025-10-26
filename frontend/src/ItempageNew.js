import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import API_BASE_URL from "./config/api";

export default function ItemPage() {
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    ItemCode: "",
    GroupID: "",
    MakeID: "",
    BrandID: "",
    ItemName: "",
    Packing: "",
    SuppRef: "",
    Barcode: "",
    Cost: "",
    AvgCost: "",
    OpeningStock: "",
    CurStock: "",
    SPrice: "",
    MRP: "",
    Unit: "",
    Shelf: "",
    PartNo: "",
    Model: "",
    CGST: "",
    SGST: "",
    IGST: "",
    HSNCode: "",
    PartyID: "",
    IsExpence: false,
    Billable: true,
    Deleted: false
  });
  const [initialFormData, setInitialFormData] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage] = useState(50);
  const [dropdownData, setDropdownData] = useState({
    groups: [],
    makes: [],
    brands: [],
    parties: []
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errors, setErrors] = useState({});

  // Sorting state
  const [sortField, setSortField] = useState('itemname');
  const [sortDirection, setSortDirection] = useState('asc');

  // Next ItemCode for display
  const [nextItemCode, setNextItemCode] = useState("");

  // Search field selector
  const [searchField, setSearchField] = useState('all');

  // Toast notification state
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // Tab-related state for transaction views
  const [activeTab, setActiveTab] = useState('details');
  const [transactionData, setTransactionData] = useState({
    purchases: [],
    sales: [],
    ledger: []
  });
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const idInputRef = useRef(null);
  const fieldRefs = useRef({});
  const setFieldRef = (name) => (el) => {
    if (el) fieldRefs.current[name] = el;
  };
  const inputClass = (name) => `w-full border rounded px-3 py-1 text-sm font-semibold ${errors[name] ? 'border-red-500 ring-1 ring-red-300' : ''}`;
  const labelClass = "text-sm text-gray-700 whitespace-nowrap text-left flex-shrink-0";
  const labelStyle = { width: '4.5rem' };
  const selectWidthStyle = { width: '22rem' };

  // Auto-resize Item Name textarea based on content
  useEffect(() => {
    const el = fieldRefs.current['ItemName'];
    if (el && el.tagName === 'TEXTAREA') {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [formData.ItemName, showForm, editingItem]);

  // Format helpers
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

  const formatPercent = (v) => {
    if (v === null || v === undefined || v === '') return '-';
    const num = Number(v);
    if (Number.isNaN(num)) return '-';
    return `${num.toLocaleString('en-IN', { maximumFractionDigits: 2 })}%`;
  };

  // Safe 2-decimal formatter for numbers that may arrive as strings or with symbols
  const formatNumber2 = (v) => {
    if (v === null || v === undefined) return '-';
    const s = String(v).trim();
    if (s === '') return '-';
    // remove common non-numeric characters like currency symbols, commas, spaces
    const cleaned = s.replace(/[^0-9.-]/g, '');
    const num = Number(cleaned);
    return Number.isNaN(num) ? '-' : num.toFixed(2);
  };

  const formatAmount = (v) => {
    if (v === null || v === undefined || v === '') return '-';
    const num = Number(String(v).replace(/[^0-9.-]/g, ''));
    if (Number.isNaN(num)) return '-';
    return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Helper function to get vendor name by partyid
  const getVendorName = (partyid) => {
    if (!partyid || !dropdownData.parties) return '-';
    const party = dropdownData.parties.find(p => p.partyid === partyid);
    return party ? party.partyname : '-';
  };

  // Toast notification helper
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'success' });
    }, 3000);
  };

  // Fetch items
  const fetchItems = async (withSpinner = false) => {
    try {
      if (withSpinner) {
        setIsRefreshing(true);
      }
      const res = await axios.get(`${API_BASE_URL}/api/items/all`);
      setItems(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      if (withSpinner) {
        setIsRefreshing(false);
      }
    }
  };

  // Fetch dropdown data
  const fetchDropdownData = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/items/dropdown-data`);
      setDropdownData((prev) => ({ ...prev, ...res.data }));
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch transaction data for tabs
  const fetchTransactionData = async (itemCode, type) => {
    if (!itemCode) return;

    setLoadingTransactions(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/items/${itemCode}/${type}`);
      setTransactionData(prev => ({
        ...prev,
        [type]: res.data || []
      }));
    } catch (err) {
      console.error(`Error fetching ${type}:`, err);
      setTransactionData(prev => ({
        ...prev,
        [type]: []
      }));
    } finally {
      setLoadingTransactions(false);
    }
  };

  // Handle tab change and fetch data if needed
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab !== 'details' && editingItem) {
      // Always fetch fresh data to ensure we get the latest confirmed/posted transactions
      fetchTransactionData(editingItem.itemcode, tab);
    }
  };

  useEffect(() => {
    fetchItems();
    fetchDropdownData();
  }, []);

  // Handle Add/Edit form submit with validation
  const normalizeForApi = (d) => {
    const n = (v) => (v === "" ? null : v);
    const num = (v) => (v === "" ? null : Number(v));
    const payload = {
      ...d,
      GroupID: d.GroupID ? Number(d.GroupID) : null,
      MakeID: d.MakeID ? Number(d.MakeID) : null,
      BrandID: d.BrandID ? Number(d.BrandID) : null,
      PartyID: d.PartyID ? Number(d.PartyID) : null,
      Cost: num(d.Cost),
      AvgCost: num(d.AvgCost),
      OpeningStock: num(d.OpeningStock),
      CurStock: num(d.CurStock),
      SPrice: num(d.SPrice),
      MRP: num(d.MRP),
      CGST: num(d.CGST),
      SGST: num(d.SGST),
      IGST: num(d.IGST),
      Packing: n(d.Packing),
      SuppRef: n(d.SuppRef),
      Barcode: n(d.Barcode),
      Unit: n(d.Unit),
      Shelf: n(d.Shelf),
      PartNo: n(d.PartNo),
      Model: n(d.Model),
      HSNCode: n(d.HSNCode),
    };

    // Only include ItemCode for editing existing items (auto-generated for new items)
    if (editingItem) {
      payload.ItemCode = Number(d.ItemCode);
    }

    return payload;
  };

  const handleSubmit = async (e, { addAnother = false } = {}) => {
    e.preventDefault();

    // reset previous errors
    setErrors({});

    // basic client-side validation
    const requiredFields = {
      ItemName: "Item Name is required",
      HSNCode: "HSN Code is required",
      GroupID: "Group is required",
      BrandID: "Brand is required",
      MakeID: "Make is required",
      CGST: "CGST is required",
      SGST: "SGST is required"
    };

    const validationErrors = {};

    // Check required fields
    for (const [field, message] of Object.entries(requiredFields)) {
      if (!formData[field] || String(formData[field]).trim() === "") {
        validationErrors[field] = message;
      }
    }

    // Special validation for numeric fields
    if (formData.CGST && isNaN(Number(formData.CGST))) {
      validationErrors.CGST = "CGST must be a valid number";
    }
    if (formData.SGST && isNaN(Number(formData.SGST))) {
      validationErrors.SGST = "SGST must be a valid number";
    }

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      // Focus on the first error field
      const firstErrorField = Object.keys(validationErrors)[0];
      fieldRefs.current[firstErrorField]?.focus();
      showToast("Please fill in all required fields: " + Object.values(validationErrors).join(", "), 'error');
      return;
    }

    if (!editingItem) {
      const exists = items.find(
        (item) =>
          item.itemname.toLowerCase() === formData.ItemName.toLowerCase()
      );
      if (exists) {
        setErrors({ ItemName: "Item Name already exists" });
        fieldRefs.current.ItemName?.focus();
        return;
      }
    }

    try {
      const payload = normalizeForApi(formData);
      if (editingItem) {
        await axios.put(
          `${API_BASE_URL}/api/items/edit/${editingItem.itemcode}`,
          payload
        );
        showToast("Item updated successfully!", 'success');
      } else {
        const response = await axios.post(`${API_BASE_URL}/api/items/add`, payload);
        showToast("Item added successfully!", 'success');

        // For new items, update the form with the generated ItemCode if available
        if (response.data && response.data.itemcode) {
          setFormData(prev => ({ ...prev, ItemCode: response.data.itemcode }));
          setEditingItem({ ...response.data });
        }
      }

      fetchItems();

      if (addAnother) {
        setFormData({
          ItemCode: "",
          GroupID: "",
          MakeID: "",
          BrandID: "",
          ItemName: "",
          Packing: "",
          SuppRef: "",
          Barcode: "",
          Cost: "",
          AvgCost: "",
          OpeningStock: "",
          CurStock: "",
          SPrice: "",
          MRP: "",
          Unit: "",
          Shelf: "",
          PartNo: "",
          Model: "",
          CGST: "",
          SGST: "",
          IGST: "",
          HSNCode: "",
          PartyID: "",
          IsExpence: false,
          Billable: true,
          Deleted: false
        });
        setInitialFormData({});
        setTimeout(() => {
          if (fieldRefs.current.GroupID) {
            fieldRefs.current.GroupID.focus();
          }
        }, 100);
      } else {
        // Form stays open after successful save/update
        // Update the initial form data to reflect the current saved state
        setInitialFormData({ ...formData });
      }
    } catch (err) {
      console.error(err);
      // Try to parse backend error
      const msg = err?.response?.data?.message || err?.response?.data || err.message || "Error saving item";
      // Heuristics to highlight fields based on common DB errors
      const newErrors = {};
      const lower = String(msg).toLowerCase();
      if (lower.includes("itemcode") || lower.includes("primary key") || lower.includes("duplicate")) {
        newErrors.ItemCode = "Invalid or duplicate Item Code";
      }
      if (lower.includes("foreign key") && lower.includes("group")) newErrors.GroupID = "Invalid Group";
      if (lower.includes("foreign key") && lower.includes("make")) newErrors.MakeID = "Invalid Make";
      if (lower.includes("foreign key") && lower.includes("brand")) newErrors.BrandID = "Invalid Brand";
      if (lower.includes("party")) newErrors.PartyID = "Invalid Party";
      if (lower.includes("cost")) newErrors.Cost = "Invalid Cost";
      if (lower.includes("mrp")) newErrors.MRP = "Invalid MRP";
      if (lower.includes("sprice")) newErrors.SPrice = "Invalid Sale Price";
      if (lower.includes("cgst")) newErrors.CGST = "Invalid CGST";
      if (lower.includes("sgst")) newErrors.SGST = "Invalid SGST";
      if (lower.includes("igst")) newErrors.IGST = "Invalid IGST";
      setErrors(newErrors);
      const firstErrField = Object.keys(newErrors)[0];
      if (firstErrField && fieldRefs.current[firstErrField]) {
        fieldRefs.current[firstErrField].focus();
      }
      showToast(msg, 'error');
    }
  };

  // Handle delete
  const handleDelete = async (itemCode) => {
    if (window.confirm("Are you sure you want to delete this item?")) {
      try {
        await axios.delete(`${API_BASE_URL}/api/items/delete/${itemCode}`);
        showToast("Item deleted successfully!", 'success');
        fetchItems();
      } catch (err) {
        console.error(err);
        showToast("Error deleting item", 'error');
      }
    }
  };

  // Handle click to edit
  const handleDoubleClick = (item) => {
    // Sanitize potential MONEY/text values (remove currency symbols/commas)
    const cleanMoney = (v) => {
      if (v === null || v === undefined) return "";
      const s = String(v);
      const cleaned = s.replace(/[^0-9.-]/g, "");
      return cleaned;
    };

    setEditingItem(item);
    const editFormData = {
      ItemCode: item.itemcode ?? "",
      GroupID: item.groupid ?? "",
      MakeID: item.makeid ?? "",
      BrandID: item.brandid ?? "",
      ItemName: item.itemname ?? "",
      Packing: item.packing ?? "",
      SuppRef: item.suppref ?? "",
      Barcode: item.barcode ?? "",
      Cost: cleanMoney(item.cost),
      AvgCost: cleanMoney(item.avgcost),
      OpeningStock: item.opening_stock ?? "",
      CurStock: item.curstock ?? "",
      SPrice: cleanMoney(item.sprice),
      MRP: cleanMoney(item.mrp),
      Unit: item.unit ?? "",
      Shelf: item.shelf ?? "",
      PartNo: item.partno ?? "",
      Model: item.model ?? "",
      CGST: item.cgst ?? "",
      SGST: item.sgst ?? "",
      IGST: item.igst ?? "",
      HSNCode: item.hsncode ?? "",
      PartyID: item.partyid ?? "",
      IsExpence: item.isexpence || false,
      Billable: item.billable ?? false,
      Deleted: item.deleted || false
    };
    setFormData(editFormData);
    setInitialFormData(editFormData);

    // Reset tab state for new item
    setActiveTab('details');
    setTransactionData({
      purchases: [],
      sales: [],
      ledger: []
    });

    setShowForm(true);
  };

  // Check if form data has changed
  const hasFormChanged = () => {
    return JSON.stringify(formData) !== JSON.stringify(initialFormData);
  };

  const canSave = hasFormChanged() && formData.ItemName.trim();

  // Sorting function
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Search, sorting and pagination logic with multi-term search
  const filteredItems = (() => {
    let result = items.filter((item) => {
      if (!searchTerm.trim()) return true;

      // Split search term into individual words and filter out empty strings
      const searchTerms = searchTerm.toLowerCase().split(/\s+/).filter(term => term.length > 0);

      // Helper function to check if all search terms are contained in a field
      const containsAllTerms = (fieldValue) => {
        const fieldText = String(fieldValue || '').toLowerCase();
        return searchTerms.every(term => fieldText.includes(term));
      };

      // Search in specific field or all fields
      switch (searchField) {
        case 'itemcode':
          return containsAllTerms(item.itemcode);
        case 'itemname':
          return containsAllTerms(item.itemname);
        case 'groupname':
          return containsAllTerms(item.groupname);
        case 'makename':
          return containsAllTerms(item.makename);
        case 'brandname':
          return containsAllTerms(item.brandname);
        case 'all':
        default:
          // Search across all specified fields - item matches if ANY field contains ALL terms
          return (
            containsAllTerms(item.itemcode) ||
            containsAllTerms(item.itemname) ||
            containsAllTerms(item.groupname) ||
            containsAllTerms(item.makename) ||
            containsAllTerms(item.brandame) ||
            containsAllTerms(item.groupname) ||
            containsAllTerms(item.makename) ||
            containsAllTerms(item.brandname)
          );
      }
    });

    // Apply sorting
    result.sort((a, b) => {
      let aVal, bVal;

      switch (sortField) {
        case 'groupname':
          aVal = String(a.groupname || '').toLowerCase();
          bVal = String(b.groupname || '').toLowerCase();
          break;
        case 'makename':
          aVal = String(a.makename || '').toLowerCase();
          bVal = String(b.makename || '').toLowerCase();
          break;
        case 'itemname':
          aVal = String(a.itemname || '').toLowerCase();
          bVal = String(b.itemname || '').toLowerCase();
          break;
        case 'avgcost':
          aVal = Number(a.avgcost || 0);
          bVal = Number(b.avgcost || 0);
          break;
        case 'sprice':
          aVal = Number(a.sprice || 0);
          bVal = Number(b.sprice || 0);
          break;
        case 'mrp':
          aVal = Number(a.mrp || 0);
          bVal = Number(b.mrp || 0);
          break;

        case 'curstock':
          aVal = Number(a.curstock || 0);
          bVal = Number(b.curstock || 0);
          break;
        case 'cgst':
          aVal = Number(a.cgst || 0);
          bVal = Number(b.cgst || 0);
          break;
        case 'sgst':
          aVal = Number(a.sgst || 0);
          bVal = Number(b.sgst || 0);
          break;
        case 'brandname':
          aVal = String(a.brandname || '').toLowerCase();
          bVal = String(b.brandname || '').toLowerCase();
          break;
        case 'itemcode':
          // Extract numeric part from item code for proper numeric sorting
          aVal = parseInt(String(a.itemcode || '0').replace(/[^0-9]/g, ''), 10) || 0;
          bVal = parseInt(String(b.itemcode || '0').replace(/[^0-9]/g, ''), 10) || 0;
          break;
        case 'vendorname':
          aVal = getVendorName(a.partyid).toLowerCase();
          bVal = getVendorName(b.partyid).toLowerCase();
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
  })();

  const totalRecords = filteredItems.length;
  const totalPages = Math.ceil(totalRecords / recordsPerPage);
  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = startIndex + recordsPerPage;
  const currentItems = filteredItems.slice(startIndex, endIndex);

  // Pagination functions
  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  // Record navigation in edit form
  const getCurrentRecordIndex = () => {
    if (!editingItem) return -1;
    return filteredItems.findIndex(item => item.itemcode === editingItem.itemcode);
  };

  const goToPreviousRecord = () => {
    const currentIndex = getCurrentRecordIndex();
    if (currentIndex > 0) {
      const previousItem = filteredItems[currentIndex - 1];
      handleDoubleClick(previousItem);
    }
  };

  const goToNextRecord = () => {
    const currentIndex = getCurrentRecordIndex();
    if (currentIndex < filteredItems.length - 1) {
      const nextItem = filteredItems[currentIndex + 1];
      handleDoubleClick(nextItem);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Toast Notification */}
      {toast.show && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg text-white font-medium transition-all duration-300 ${toast.type === 'success' ? 'bg-green-500' :
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

      <div className="p-0">
        {/* Header with New and Form Actions */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-4">
            <button
              className="px-4 py-2 text-sm rounded text-white bg-purple-600 hover:bg-purple-700 shadow-sm"
              onClick={() => {
                setShowForm(true);
                setEditingItem(null);
                setFormData({
                  ItemCode: "",
                  GroupID: "",
                  MakeID: "",
                  BrandID: "",
                  ItemName: "",
                  Packing: "",
                  SuppRef: "",
                  Barcode: "",
                  Cost: "",
                  AvgCost: "",
                  OpeningStock: "",
                  CurStock: "",
                  SPrice: "",
                  MRP: "",
                  Unit: "",
                  Shelf: "",
                  PartNo: "",
                  Model: "",
                  CGST: "",
                  SGST: "",
                  IGST: "",
                  HSNCode: "",
                  PartyID: "",
                  IsExpence: false,
                  Billable: true,
                  Deleted: false
                });
                setInitialFormData({});
                setTimeout(() => {
                  if (fieldRefs.current.GroupID) {
                    fieldRefs.current.GroupID.focus();
                  }
                }, 100);
              }}
            >
              New
            </button>

            {/* 🔎 Odoo-Style Filter */}
            {!showForm && (
              <div className="flex items-center gap-3">
                {/* Filter Container with Odoo-style appearance */}
                <div className="flex items-center bg-white border border-gray-300 rounded-md shadow-sm hover:shadow-md transition-shadow">
                  {/* Filter Icon */}
                  <div className="flex items-center px-3 py-2 border-r border-gray-200">
                    <svg
                      className="h-4 w-4 text-gray-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.414A1 1 0 013 6.707V4z"
                      />
                    </svg>
                    <span className="ml-2 text-sm text-gray-600 font-medium">Filter</span>
                  </div>

                  {/* Field Selector */}
                  <select
                    value={searchField}
                    onChange={(e) => {
                      setSearchField(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="px-3 py-2 text-sm bg-transparent border-none outline-none text-gray-700 cursor-pointer min-w-[100px]"
                    title="Select field to search in"
                  >
                    <option value="all">All Fields</option>
                    <option value="itemcode">Item Code</option>
                    <option value="itemname">Item Name</option>
                    <option value="groupname">Group</option>
                    <option value="makename">Make</option>
                    <option value="brandname">Brand</option>
                  </select>

                  {/* Search Input */}
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder={searchField === 'all' ? 'Search... (e.g., "bosch 110")' : `Search in ${searchField === 'itemcode' ? 'Item Code' : searchField === 'suppliername' ? 'Supplier Name' : searchField === 'itemname' ? 'Item Name' : searchField === 'groupname' ? 'Group' : searchField === 'makename' ? 'Make' : 'Brand'}...`}
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-full px-3 py-2 text-sm bg-transparent border-none outline-none placeholder-gray-400 min-w-[200px]"
                    />
                    {searchTerm && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchTerm('');
                          setCurrentPage(1);
                        }}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        title="Clear search"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => fetchItems(true)}
                  disabled={isRefreshing}
                  className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-md shadow-sm transition-colors ${isRefreshing
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-white text-gray-700 hover:bg-gray-50 border-gray-300"
                    }`}
                  title="Refresh item list"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {isRefreshing ? "Refreshing..." : "Refresh"}
                </button>
              </div>
            )}

            {showForm && (
              <>
                {!editingItem && (
                  <button
                    type="button"
                    disabled={!canSave}
                    className={`px-3 py-2 text-sm border rounded ${canSave ? "" : "opacity-50 cursor-not-allowed"
                      }`}
                    onClick={() =>
                      handleSubmit({ preventDefault: () => { } }, { addAnother: true })
                    }
                  >
                    Save & Add Another
                  </button>
                )}
                <button
                  type="button"
                  className="px-3 py-2 text-sm border rounded"
                  onClick={() => {
                    setShowForm(false);
                    setEditingItem(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!canSave}
                  onClick={() => handleSubmit({ preventDefault: () => { } })}
                  className={`px-4 py-2 text-sm rounded text-white ${canSave
                    ? "bg-purple-600 hover:bg-purple-700"
                    : "bg-purple-400 cursor-not-allowed opacity-60"
                    }`}
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => fetchItems(true)}
                  disabled={isRefreshing}
                  className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-md shadow-sm transition-colors ${isRefreshing
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'
                    }`}
                  title="Refresh item data"
                >
                  {isRefreshing ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Refreshing...
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Refresh
                    </>
                  )}
                </button>
              </>
            )}
          </div>

          {/* Record Navigation - show in table mode and edit form mode */}
          {!showForm && totalRecords > 0 && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <button
                onClick={goToPreviousPage}
                disabled={currentPage === 1}
                className={`p-1 rounded ${currentPage === 1
                  ? "text-gray-300 cursor-not-allowed"
                  : "text-gray-600 hover:bg-gray-100"
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
                className={`p-1 rounded ${currentPage === totalPages
                  ? "text-gray-300 cursor-not-allowed"
                  : "text-gray-600 hover:bg-gray-100"
                  }`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
                </svg>
              </button>
            </div>
          )}

          {/* Record navigation in edit form mode */}
          {showForm && editingItem && filteredItems.length > 1 && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <button
                type="button"
                onClick={goToPreviousRecord}
                disabled={getCurrentRecordIndex() === 0}
                className={`p-1 rounded ${getCurrentRecordIndex() === 0
                  ? "text-gray-300 cursor-not-allowed"
                  : "text-gray-600 hover:bg-gray-100"
                  }`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
                </svg>
              </button>
              <span className="font-medium">
                Record {getCurrentRecordIndex() + 1} / {filteredItems.length}
              </span>
              <button
                type="button"
                onClick={goToNextRecord}
                disabled={getCurrentRecordIndex() === filteredItems.length - 1}
                className={`p-1 rounded ${getCurrentRecordIndex() === filteredItems.length - 1
                  ? "text-gray-300 cursor-not-allowed"
                  : "text-gray-600 hover:bg-gray-100"
                  }`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
                </svg>
              </button>
            </div>
          )}
        </div>

        <h1 className="text-xl font-semibold mb-1">Master Items</h1>

        {/* Table OR Form */}
        {!showForm ? (
          <div className="border rounded-lg shadow-sm overflow-auto max-h-[70vh]">
            <table className="min-w-[1200px] border-collapse table-auto">
              <thead className="bg-gray-100 text-left sticky top-0 z-10">
                <tr className="bg-gray-50 border-b">
                  <th
                    className="text-left p-2 text-sm font-medium text-gray-700 w-[25ch] cursor-pointer hover:bg-gray-200 select-none"
                    onClick={() => handleSort('groupname')}
                    title="Click to sort by Group"
                  >
                    <div className="flex items-center justify-between">
                      <span>Group</span>
                      <span className="ml-1">
                        {sortField === 'groupname' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th
                    className="text-left p-2 text-sm font-medium text-gray-700 w-20 cursor-pointer hover:bg-gray-200 select-none"
                    onClick={() => handleSort('makename')}
                    title="Click to sort by Make"
                  >
                    <div className="flex items-center justify-between">
                      <span>Make</span>
                      <span className="ml-1">
                        {sortField === 'makename' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th
                    className="text-left p-2 text-sm font-medium text-gray-700 w-[40ch] cursor-pointer hover:bg-gray-200 select-none"
                    onClick={() => handleSort('itemname')}
                    title="Click to sort by Item Name"
                  >
                    <div className="flex items-center justify-between">
                      <span>Item Name</span>
                      <span className="ml-1">
                        {sortField === 'itemname' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th
                    className="text-right p-1 text-sm font-medium text-gray-700 w-16 cursor-pointer hover:bg-gray-200 select-none"
                    onClick={() => handleSort('avgcost')}
                    title="Click to sort by Avg Cost"
                  >
                    <div className="flex items-center justify-between">
                      <span>Avg Cost</span>
                      <span className="ml-1">
                        {sortField === 'avgcost' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th
                    className="text-right p-1 text-sm font-medium text-gray-700 w-20 cursor-pointer hover:bg-gray-200 select-none"
                    onClick={() => handleSort('sprice')}
                    title="Click to sort by Sales Price"
                  >
                    <div className="flex items-center justify-between">
                      <span>S.Price</span>
                      <span className="ml-1">
                        {sortField === 'sprice' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th
                    className="text-right p-1 text-sm font-medium text-gray-700 w-16 cursor-pointer hover:bg-gray-200 select-none"
                    onClick={() => handleSort('mrp')}
                    title="Click to sort by MRP"
                  >
                    <div className="flex items-center justify-between">
                      <span>MRP</span>
                      <span className="ml-1">
                        {sortField === 'mrp' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>

                  <th
                    className="text-right p-1 text-sm font-medium text-gray-700 w-16 cursor-pointer hover:bg-gray-200 select-none"
                    onClick={() => handleSort('curstock')}
                    title="Click to sort by Current Stock"
                  >
                    <div className="flex items-center justify-between">
                      <span>Stock</span>
                      <span className="ml-1">
                        {sortField === 'curstock' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th
                    className="text-right p-1 text-sm font-medium text-gray-700 w-14 cursor-pointer hover:bg-gray-200 select-none"
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
                    className="text-right p-1 text-sm font-medium text-gray-700 w-14 cursor-pointer hover:bg-gray-200 select-none"
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
                    className="text-left p-2 text-sm font-medium text-gray-700 w-20 cursor-pointer hover:bg-gray-200 select-none"
                    onClick={() => handleSort('brandname')}
                    title="Click to sort by Brand"
                  >
                    <div className="flex items-center justify-between">
                      <span>Brand</span>
                      <span className="ml-1">
                        {sortField === 'brandname' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th
                    className="text-left p-2 text-sm font-medium text-gray-700 w-20 cursor-pointer hover:bg-gray-200 select-none"
                    onClick={() => handleSort('itemcode')}
                    title="Click to sort by Item Code"
                  >
                    <div className="flex items-center justify-between">
                      <span>Item Code</span>
                      <span className="ml-1">
                        {sortField === 'itemcode' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th
                    className="text-left p-2 text-sm font-medium text-gray-700 w-[20ch] cursor-pointer hover:bg-gray-200 select-none"
                    onClick={() => handleSort('vendorname')}
                    title="Click to sort by Vendor"
                  >
                    <div className="flex items-center justify-between">
                      <span>Vendor</span>
                      <span className="ml-1">
                        {sortField === 'vendorname' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th className="text-right p-1 text-sm font-medium text-gray-700 w-16">Billable</th>
                  <th className="text-left p-2 text-sm font-medium text-gray-700 w-20">Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.map((item, index) => (
                  <tr
                    key={item.itemcode}
                    className={`border-b hover:bg-gray-50 cursor-pointer ${index % 2 === 0 ? "bg-white" : "bg-gray-50"
                      }`}
                    onClick={() => handleDoubleClick(item)}
                    title="Click to edit item"
                  >
                    <td className="px-2 py-1 text-sm whitespace-normal align-top w-[25ch] max-w-[25ch] two-line">{item.groupname || '-'}</td>
                    <td className="px-2 py-1 text-sm break-words align-top">{item.makename || '-'}</td>
                    <td className="px-2 py-1 text-sm break-words whitespace-normal align-top max-w-[40ch] two-line">{item.itemname || '-'}</td>
                    <td className="p-1 text-right text-sm align-top">{formatAmount(item.avgcost)}</td>
                    <td className="p-1 text-right text-sm align-top">{formatAmount(item.sprice)}</td>
                    <td className="p-1 text-right text-sm align-top">{formatAmount(item.mrp)}</td>

                    <td className="p-1 text-right text-sm align-top">{item.curstock || '-'}</td>
                    <td className="p-1 text-right text-sm align-top">{item.cgst || '-'}</td>
                    <td className="p-1 text-right text-sm align-top">{item.sgst || '-'}</td>
                    <td className="p-2 text-sm break-words align-top">{item.brandname || '-'}</td>
                    <td className="p-2 text-sm break-words align-top">{item.itemcode || '-'}</td>
                    <td className="px-2 py-1 text-sm break-words whitespace-normal align-top max-w-[20ch] two-line">{getVendorName(item.partyid)}</td>
                    <td className="p-1 text-right text-sm align-top">{String(item.billable ?? '-')}</td>
                    <td className="p-2 text-sm align-top">
                      <button
                        className="text-red-600 hover:text-red-800 text-xs"
                        onClick={() => handleDelete(item.itemcode)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {currentItems.length === 0 && (
                  <tr>
                    <td className="p-4 text-center text-sm text-gray-500" colSpan={14}>
                      No items found. Try adding a new item or adjusting your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div
            className="bg-gray-50 border rounded-lg shadow-sm flex flex-col"
            style={{ width: '80rem', overflow: 'visible', minHeight: 'calc(100vh - 10rem)' }}
          >
            {/* Tabs - only show for existing items */}
            {editingItem && (
              <div className="flex border-b bg-white rounded-t-lg">
                <button
                  type="button"
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'details'
                    ? 'border-blue-500 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  onClick={() => handleTabChange('details')}
                >
                  Item Details
                </button>
                <button
                  type="button"
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'purchases'
                    ? 'border-blue-500 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  onClick={() => handleTabChange('purchases')}
                >
                  Purchases
                </button>
                <button
                  type="button"
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'sales'
                    ? 'border-blue-500 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  onClick={() => handleTabChange('sales')}
                >
                  Sales
                </button>
                <button
                  type="button"
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'ledger'
                    ? 'border-blue-500 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  onClick={() => handleTabChange('ledger')}
                >
                  Item Ledger
                </button>
              </div>
            )}

            {/* Tab Content */}
            {activeTab === 'details' ? (
              <form
                className="form-horizontal flex-1 flex flex-col"
                onSubmit={(e) => handleSubmit(e)}
              >
                <div className="px-1 py-1 flex flex-col h-full gap-2">
                  {/* Header panel: Group, Item Code, Is Expense, Billable; Brand, Vendor, Make, Model; Item Name, Packing */}
                  <div className="border rounded-md p-1 bg-gray-50 space-y-1" style={{ width: '50rem' }}>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <label className={labelClass} style={labelStyle}>Group</label>
                        <select
                          value={formData.GroupID}
                          onChange={(e) => setFormData({ ...formData, GroupID: e.target.value })}
                          ref={setFieldRef('GroupID')}
                          className={`${inputClass('GroupID')} text-left`}
                          style={selectWidthStyle}
                          tabIndex={1}
                        >
                          <option value="">Select Group</option>
                          {dropdownData.groups.map((group) => (
                            <option key={group.groupid} value={group.groupid}>
                              {group.groupname}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div
                        className="flex items-center gap-4 ml-4 flex-shrink-0 whitespace-nowrap"
                        style={{ width: '32rem', maxWidth: '32rem' }}
                      >
                        <label className="flex items-center text-sm text-gray-700 gap-2">
                          <span>Is Expense</span>
                          <input
                            type="checkbox"
                            checked={formData.IsExpence}
                            onChange={(e) => setFormData({ ...formData, IsExpence: e.target.checked })}
                          />
                        </label>
                        <label className="flex items-center text-sm text-gray-700 gap-2">
                          <span>Billable</span>
                          <input
                            type="checkbox"
                            checked={formData.Billable}
                            onChange={(e) => setFormData({ ...formData, Billable: e.target.checked })}
                          />
                        </label>
                      </div>


                    </div>

                    <div className="flex gap-3 items-start">
                      {/* Brand and Make stacked with equal widths */}
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1">
                          <label className={labelClass} style={labelStyle}>Brand</label>
                          <select
                            value={formData.BrandID}
                            onChange={(e) => setFormData({ ...formData, BrandID: e.target.value })}
                            ref={setFieldRef('BrandID')}
                            className={`${inputClass('BrandID')} text-left`}
                            style={selectWidthStyle}
                            tabIndex={2}
                          >
                            <option value="">Select Brand</option>
                            {dropdownData.brands.map((brand) => (
                              <option key={brand.brandid} value={brand.brandid}>
                                {brand.brandname}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center gap-1">
                          <label className={labelClass} style={labelStyle}>Make</label>
                          <select
                            value={formData.MakeID}
                            onChange={(e) => setFormData({ ...formData, MakeID: e.target.value })}
                            ref={setFieldRef('MakeID')}
                            className={`${inputClass('MakeID')} text-left`}
                            style={selectWidthStyle}
                            tabIndex={3}
                          >
                            <option value="">Select Make</option>
                            {dropdownData.makes.map((make) => (
                              <option key={make.makeid} value={make.makeid}>
                                {make.makename}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <label className="text-sm text-gray-700 whitespace-nowrap">Item Code</label>
                          <input
                            type="text"
                            value={editingItem ? formData.ItemCode : "Auto-generated"}
                            onChange={() => { }} // No-op since it's always read-only
                            ref={(el) => {
                              setFieldRef('ItemCode')(el);
                            }}
                            className={`${inputClass('ItemCode')} w-36 text-left`}
                            readOnly={true}
                            style={{ backgroundColor: '#f3f4f6', color: '#6b7280' }}
                            title={editingItem ? "Item Code cannot be changed" : "Item Code will be auto-generated when saving"}
                          />
                        </div>
                        {errors.ItemCode && <p className="text-xs text-red-600">{errors.ItemCode}</p>}
                      </div>
                    </div>



                    <div className="space-y-1">
                      {/* Item Name - label and textbox side by side */}
                      <div className="flex items-start gap-1 w-full">
                        <label className={`${labelClass} mt-1`} style={labelStyle}>Item Name</label>
                        <div style={{ width: '34.5rem', display: 'flex', flexDirection: 'column' }}>
                          <textarea
                            value={formData.ItemName}
                            onChange={(e) => setFormData({ ...formData, ItemName: e.target.value })}
                            ref={setFieldRef('ItemName')}
                            className={`${inputClass('ItemName')} resize-none leading-4 min-h-[30px] whitespace-normal break-words text-left`}
                            rows={2}
                            required
                            tabIndex={4}
                          />
                          {errors.ItemName && <p className="text-xs text-red-600 mt-1">{errors.ItemName}</p>}
                        </div>
                      </div>

                      {/* Packing field - moved from above */}
                      <div className="flex items-start gap-1">
                        <label className={`${labelClass} mt-1`} style={labelStyle}>Packing</label>
                        <div className="flex flex-col">
                          <input
                            type="text"
                            value={formData.Packing}
                            onChange={(e) => setFormData({ ...formData, Packing: e.target.value })}
                            ref={setFieldRef('Packing')}
                            className={`${inputClass('Packing')} w-64 text-left`}
                            tabIndex={5}
                          />
                          {errors.Packing && <p className="text-xs text-red-600 mt-1">{errors.Packing}</p>}
                        </div>
                      </div>

                      {/* Vendor and Unit aligned on the same row */}
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                          <label className={labelClass} style={labelStyle}>Vendor</label>
                          <select
                            value={formData.PartyID}
                            onChange={(e) => setFormData({ ...formData, PartyID: e.target.value })}
                            ref={setFieldRef('PartyID')}
                            className={`${inputClass('PartyID')} text-left`}
                            style={selectWidthStyle}
                            tabIndex={6}
                          >
                            <option value="">Select Vendor</option>
                            {dropdownData.parties.map((party) => (
                              <option key={party.partyid} value={party.partyid}>
                                {party.partyname}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-sm text-gray-700 whitespace-nowrap">Unit</label>
                          <input
                            type="text"
                            value={formData.Unit}
                            onChange={(e) => setFormData({ ...formData, Unit: e.target.value })}
                            ref={setFieldRef('Unit')}
                            className={`${inputClass('Unit')} w-24`}
                            tabIndex={7}
                          />
                        </div>
                      </div>
                      {errors.PartyID && <p className="text-xs text-red-600 mt-1">{errors.PartyID}</p>}
                    </div>
                  </div>

                  {/* Specifics */}
                  <div className="border rounded-md p-1 relative mt-2 bg-gray-50 flex-1" style={{ width: '50rem' }}>
                    <span className="absolute -top-2 left-2 bg-gray-50 px-1 text-sm font-semibold text-gray-700">Specifics</span>
                    <div className="space-y-1 h-full">
                      {/* Row 1: Supp. Ref, HSN Code, Part No */}
                      <div className="grid grid-cols-3 gap-3 items-center">
                        <div className="flex items-center gap-1">
                          <label className={`${labelClass} w-14`}>Supp. Ref</label>
                          <input
                            type="text"
                            value={formData.SuppRef}
                            onChange={(e) => setFormData({ ...formData, SuppRef: e.target.value })}
                            ref={setFieldRef('SuppRef')}
                            className={`${inputClass('SuppRef')} text-sm px-2`}
                            style={{ width: '9rem' }}
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <label className={`${labelClass} w-14`}>HSN Code</label>
                          <input
                            type="text"
                            value={formData.HSNCode}
                            onChange={(e) => setFormData({ ...formData, HSNCode: e.target.value })}
                            className={`${inputClass('HSNCode')} text-sm px-2`}
                            style={{ width: '9rem' }}
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <label className={`${labelClass} w-14`}>Part No</label>
                          <input
                            type="text"
                            value={formData.PartNo}
                            onChange={(e) => setFormData({ ...formData, PartNo: e.target.value })}
                            ref={setFieldRef('PartNo')}
                            className={`${inputClass('PartNo')} text-sm px-2`}
                            style={{ width: '9rem' }}
                          />
                        </div>
                      </div>

                      {/* Row 2: Barcode, Shelf, Curr. Stock */}
                      <div className="grid grid-cols-3 gap-3 items-center">
                        <div className="flex items-center gap-1">
                          <label className={`${labelClass} w-14`}>Barcode</label>
                          <input
                            type="text"
                            value={formData.Barcode}
                            onChange={(e) => setFormData({ ...formData, Barcode: e.target.value })}
                            ref={setFieldRef('Barcode')}
                            className={`${inputClass('Barcode')} text-sm px-2`}
                            style={{ width: '9rem' }}
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <label className={`${labelClass} w-14`}>Shelf</label>
                          <input
                            type="text"
                            value={formData.Shelf}
                            onChange={(e) => setFormData({ ...formData, Shelf: e.target.value })}
                            ref={setFieldRef('Shelf')}
                            className={`${inputClass('Shelf')} text-sm px-2`}
                            style={{ width: '9rem' }}
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <label className={`${labelClass} w-16`}>Opening</label>
                          <input
                            type="number"
                            value={formData.OpeningStock}
                            onChange={(e) => setFormData({ ...formData, OpeningStock: e.target.value })}
                            ref={setFieldRef('OpeningStock')}
                            className={`${inputClass('OpeningStock')} text-sm px-2`}
                            style={{ width: '9rem' }}
                            title="Opening Stock - Physical stock quantity before system implementation"
                            placeholder="0"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <label className={`${labelClass} w-16`}>Current</label>
                          <input
                            type="number"
                            value={formData.CurStock}
                            onChange={(e) => setFormData({ ...formData, CurStock: e.target.value })}
                            ref={setFieldRef('CurStock')}
                            className={`${inputClass('CurStock')} text-sm px-2`}
                            style={{ width: '9rem' }}
                            title="Current Stock - System calculated stock from transactions"
                            placeholder="0"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tax and Price sections side by side */}
                  <div
                    className="grid mt-2"
                    style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem', width: '50rem', marginTop: 'auto' }}
                  >
                    {/* Tax */}
                    <div
                      className="border rounded-md relative bg-gray-50 p-2"
                      style={{ width: '100%' }}
                    >
                      <span className="absolute -top-2 left-2 bg-gray-50 px-1 text-sm font-semibold text-gray-700">Tax</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <div className="flex items-center" style={{ gap: '0.4rem' }}>
                          <label className="text-sm text-gray-700 whitespace-nowrap w-16">CGST %</label>
                          <input
                            type="number"
                            step="0.01"
                            value={formData.CGST}
                            onChange={(e) => setFormData({ ...formData, CGST: e.target.value })}
                            ref={setFieldRef('CGST')}
                            className={`${inputClass('CGST')} font-semibold text-sm px-2`}
                            style={{ width: '8rem' }}
                          />
                        </div>
                        <div className="flex items-center" style={{ gap: '0.4rem' }}>
                          <label className="text-sm text-gray-700 whitespace-nowrap w-16">SGST %</label>
                          <input
                            type="number"
                            step="0.01"
                            value={formData.SGST}
                            onChange={(e) => setFormData({ ...formData, SGST: e.target.value })}
                            className={`${inputClass('SGST')} font-semibold text-sm px-2`}
                            style={{ width: '8rem' }}
                          />
                        </div>
                        <div className="flex items-center" style={{ gap: '0.4rem' }}>
                          <label className="text-sm text-gray-700 whitespace-nowrap w-16">IGST %</label>
                          <input
                            type="number"
                            step="0.01"
                            value={formData.IGST}
                            onChange={(e) => setFormData({ ...formData, IGST: e.target.value })}
                            className={`${inputClass('IGST')} font-semibold text-sm px-2`}
                            style={{ width: '8rem' }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Price */}
                    <div
                      className="border rounded-md p-2 relative bg-gray-50"
                      style={{ width: '100%' }}
                    >
                      <span className="absolute -top-2 left-2 bg-gray-50 px-1 text-sm font-semibold text-gray-700">Price</span>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(2, max-content)',
                          columnGap: '2rem',
                          rowGap: '0.35rem',
                          alignItems: 'center',
                        }}
                      >
                        {/* Column 1: Avg Cost, MRP, MU on MRP */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-1">
                            <label className="text-sm text-gray-700 whitespace-nowrap w-24">Avg. Cost</label>
                            <input
                              type="number"
                              step="0.01"
                              value={formData.AvgCost}
                              onChange={(e) => setFormData({ ...formData, AvgCost: e.target.value })}
                              ref={setFieldRef('AvgCost')}
                              className={`${inputClass('AvgCost')} font-semibold text-sm px-2`}
                              style={{ width: '8rem' }}
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <label className="text-sm text-gray-700 whitespace-nowrap w-24">MRP</label>
                            <input
                              type="number"
                              step="0.01"
                              value={formData.MRP}
                              onChange={(e) => setFormData({ ...formData, MRP: e.target.value })}
                              ref={setFieldRef('MRP')}
                              className={`${inputClass('MRP')} font-semibold text-sm px-2`}
                              style={{ width: '8rem' }}
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <label className="text-sm text-gray-700 whitespace-nowrap w-24">MU on MRP</label>
                            <div className="border rounded px-2 py-1 text-sm bg-white font-semibold" style={{ width: '8rem' }}>
                              {formatPercent(
                                formData.Cost && Number(formData.Cost) !== 0
                                  ? ((Number(formData.MRP || 0) - Number(formData.Cost || 0)) / Number(formData.Cost)) * 100
                                  : null
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Column 2: Cost, Selling Price, MU on SP */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-1">
                            <label className="text-sm text-gray-700 whitespace-nowrap w-24">Cost</label>
                            <input
                              type="number"
                              step="0.01"
                              value={formData.Cost}
                              onChange={(e) => setFormData({ ...formData, Cost: e.target.value })}
                              ref={setFieldRef('Cost')}
                              className={`${inputClass('Cost')} font-semibold text-sm px-2`}
                              style={{ width: '8rem' }}
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <label className="text-sm text-gray-700 whitespace-nowrap w-24">Selling Price</label>
                            <input
                              type="number"
                              step="0.01"
                              value={formData.SPrice}
                              onChange={(e) => setFormData({ ...formData, SPrice: e.target.value })}
                              ref={setFieldRef('SPrice')}
                              className={`${inputClass('SPrice')} font-semibold text-sm px-2`}
                              style={{ width: '8rem' }}
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <label className="text-sm text-gray-700 whitespace-nowrap w-24">MU on SP</label>
                            <div className="border rounded px-2 py-1 text-sm bg-white font-semibold" style={{ width: '8rem' }}>
                              {formatPercent(
                                formData.Cost && Number(formData.Cost) !== 0
                                  ? ((Number(formData.SPrice || 0) - Number(formData.Cost || 0)) / Number(formData.Cost)) * 100
                                  : null
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            ) : (
              /* Transaction Tab Content */
              <div className="flex-1 p-4">
                {loadingTransactions ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-gray-500">Loading {activeTab}...</div>
                  </div>
                ) : (
                  <>
                    {activeTab === 'purchases' && (
                      <div>
                        <h3 className="text-lg font-semibold mb-4">Purchase History (Confirmed Only)</h3>
                        {(() => {
                          // Data is already filtered at backend level for confirmed purchases
                          const confirmedPurchases = transactionData.purchases;
                          return confirmedPurchases.length > 0 ? (
                            <div className="overflow-auto">
                              <table className="min-w-full border-collapse border border-gray-300">
                                <thead className="bg-gray-100">
                                  <tr>
                                    <th className="border border-gray-300 px-3 py-2 text-left text-sm font-medium">Date</th>
                                    <th className="border border-gray-300 px-3 py-2 text-left text-sm font-medium">Supplier</th>
                                    <th className="border border-gray-300 px-3 py-2 text-right text-sm font-medium">Qty</th>
                                    <th className="border border-gray-300 px-3 py-2 text-right text-sm font-medium">Rate</th>
                                    <th className="border border-gray-300 px-3 py-2 text-right text-sm font-medium">Amount</th>
                                    <th className="border border-gray-300 px-3 py-2 text-left text-sm font-medium">Invoice</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {confirmedPurchases.map((purchase, index) => (
                                    <tr key={index} className="hover:bg-gray-50">
                                      <td className="border border-gray-300 px-3 py-2 text-sm">{purchase.tran_date}</td>
                                      <td className="border border-gray-300 px-3 py-2 text-sm">{purchase.supplier_name}</td>
                                      <td className="border border-gray-300 px-3 py-2 text-sm text-right">{purchase.qty}</td>
                                      <td className="border border-gray-300 px-3 py-2 text-sm text-right">{purchase.rate}</td>
                                      <td className="border border-gray-300 px-3 py-2 text-sm text-right">{purchase.amount}</td>
                                      <td className="border border-gray-300 px-3 py-2 text-sm">{purchase.invoice_no}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="text-gray-500 text-center py-8">No confirmed purchase records found</div>
                          );
                        })()}
                      </div>
                    )}

                    {activeTab === 'sales' && (
                      <div>
                        <h3 className="text-lg font-semibold mb-4">Sales History (Posted Only)</h3>
                        {(() => {
                          // Data is already filtered at backend level for posted sales
                          const postedSales = transactionData.sales;
                          return postedSales.length > 0 ? (
                            <div className="overflow-auto">
                              <table className="min-w-full border-collapse border border-gray-300">
                                <thead className="bg-gray-100">
                                  <tr>
                                    <th className="border border-gray-300 px-3 py-2 text-left text-sm font-medium">Date</th>
                                    <th className="border border-gray-300 px-3 py-2 text-left text-sm font-medium">Customer</th>
                                    <th className="border border-gray-300 px-3 py-2 text-right text-sm font-medium">Qty</th>
                                    <th className="border border-gray-300 px-3 py-2 text-right text-sm font-medium">Rate</th>
                                    <th className="border border-gray-300 px-3 py-2 text-right text-sm font-medium">Amount</th>
                                    <th className="border border-gray-300 px-3 py-2 text-left text-sm font-medium">Invoice</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {postedSales.map((sale, index) => (
                                    <tr key={index} className="hover:bg-gray-50">
                                      <td className="border border-gray-300 px-3 py-2 text-sm">{sale.tran_date}</td>
                                      <td className="border border-gray-300 px-3 py-2 text-sm">{sale.customer_name}</td>
                                      <td className="border border-gray-300 px-3 py-2 text-sm text-right">{sale.qty}</td>
                                      <td className="border border-gray-300 px-3 py-2 text-sm text-right">{sale.rate}</td>
                                      <td className="border border-gray-300 px-3 py-2 text-sm text-right">{sale.amount}</td>
                                      <td className="border border-gray-300 px-3 py-2 text-sm">{sale.invoice_no}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="text-gray-500 text-center py-8">No posted sales records found</div>
                          );
                        })()}
                      </div>
                    )}

                    {activeTab === 'ledger' && (
                      <div>
                        <h3 className="text-lg font-semibold mb-4">Item Ledger (Confirmed/Posted Only)</h3>
                        {(() => {
                          // Data is already filtered at backend level for confirmed/posted transactions
                          const validLedgerEntries = transactionData.ledger;
                          return validLedgerEntries.length > 0 ? (
                            <div className="overflow-auto">
                              <table className="min-w-full border-collapse border border-gray-300">
                                <thead className="bg-gray-100">
                                  <tr>
                                    <th className="border border-gray-300 px-3 py-2 text-left text-sm font-medium">Date</th>
                                    <th className="border border-gray-300 px-3 py-2 text-left text-sm font-medium">Type</th>
                                    <th className="border border-gray-300 px-3 py-2 text-left text-sm font-medium">Reference</th>
                                    <th className="border border-gray-300 px-3 py-2 text-right text-sm font-medium">In</th>
                                    <th className="border border-gray-300 px-3 py-2 text-right text-sm font-medium">Out</th>
                                    <th className="border border-gray-300 px-3 py-2 text-right text-sm font-medium">Balance</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {validLedgerEntries.map((entry, index) => (
                                    <tr key={index} className="hover:bg-gray-50">
                                      <td className="border border-gray-300 px-3 py-2 text-sm">{entry.tran_date}</td>
                                      <td className="border border-gray-300 px-3 py-2 text-sm">{entry.tran_type}</td>
                                      <td className="border border-gray-300 px-3 py-2 text-sm">{entry.reference}</td>
                                      <td className="border border-gray-300 px-3 py-2 text-sm text-right">{entry.qty_in || '-'}</td>
                                      <td className="border border-gray-300 px-3 py-2 text-sm text-right">{entry.qty_out || '-'}</td>
                                      <td className="border border-gray-300 px-3 py-2 text-sm text-right">{entry.balance}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="text-gray-500 text-center py-8">No confirmed/posted ledger entries found</div>
                          );
                        })()}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}