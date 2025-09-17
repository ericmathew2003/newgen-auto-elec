import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { 
  Pagination, SearchBar, DataTable, FormWrapper, PageHeader, Notice,
  usePagination, useNotice, useFormState 
} from './components';

export default function ItemPage() {
  const [items, setItems] = useState([]);
  const [dropdownData, setDropdownData] = useState({
    groups: [],
    makes: [],
    brands: []
  });
  const [errors, setErrors] = useState({});
  const [searchFields, setSearchFields] = useState({
    itemname: true,
    groupname: false,
    makename: false,
    brandname: false,
    itemcode: false,
  });
  
  const idInputRef = useRef(null);
  const fieldRefs = useRef({});
  
  // Custom hooks for state management
  const { notice, showNotice, closeNotice } = useNotice();
  const { formData, setFormData, showForm, editingItem, isDirty, startEditing: originalStartEditing, startAdding, closeForm } = useFormState({
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
    Billable: false,
    Deleted: false
  });

  // Override startEditing to properly map database fields to form fields
  const startEditing = (item) => {
    // Sanitize potential MONEY/text values (remove currency symbols/commas)
    const cleanMoney = (v) => {
      if (v === null || v === undefined) return "";
      const s = String(v);
      const cleaned = s.replace(/[^0-9.-]/g, "");
      return cleaned;
    };

    const mappedData = {
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
    originalStartEditing(mappedData);
  };

  // Search and pagination
  const {
    currentPage,
    setCurrentPage,
    searchTerm,
    setSearchTerm
  } = usePagination(items);

  const filteredItems = items.filter((item) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;

    // Multi-word AND search across selected fields (Odoo-like)
    const tokens = term.split(/\s+/).map(t => t.replace(/\*/g, '')).filter(Boolean);

    // Build selected field values
    const fields = [];
    if (searchFields.itemname) fields.push(item.itemname?.toLowerCase());
    if (searchFields.itemcode) fields.push(item.itemcode?.toString().toLowerCase());
    if (searchFields.groupname) fields.push(item.groupname?.toLowerCase());
    if (searchFields.makename) fields.push(item.makename?.toLowerCase());
    if (searchFields.brandname) fields.push(item.brandname?.toLowerCase());

    const selectedValues = fields.filter(Boolean);
    if (selectedValues.length === 0) return true;

    // Each token must appear in at least one of the selected fields
    return tokens.every((t) => selectedValues.some((val) => val.includes(t)));
  });

  // Calculate pagination for filtered results
  const totalRecords = filteredItems.length;
  const totalPages = Math.ceil(totalRecords / 50);
  const startIndex = (currentPage - 1) * 50;
  const endIndex = startIndex + 50;
  const currentRecords = filteredItems.slice(startIndex, endIndex);

  // Fetch items
  const fetchItems = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/items/all");
      setItems(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch dropdown data
  const fetchDropdownData = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/items/dropdown-data");
      setDropdownData(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchItems();
    fetchDropdownData();
  }, []);

  // Auto-resize Item Name textarea based on content
  useEffect(() => {
    const el = fieldRefs.current['ItemName'];
    if (el && el.tagName === 'TEXTAREA') {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [formData.ItemName, showForm, editingItem]);

  // Format helpers
  const formatAmount = (v) => {
    if (v === null || v === undefined || v === '') return '-';
    const num = Number(String(v).replace(/[^0-9.-]/g, ''));
    if (Number.isNaN(num)) return '-';
    return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatPercent = (v) => {
    if (v === null || v === undefined || v === '') return '-';
    const num = Number(v);
    if (Number.isNaN(num)) return '-';
    return `${num.toLocaleString('en-IN', { maximumFractionDigits: 2 })}%`;
  };

  const setFieldRef = (name) => (el) => {
    if (el) fieldRefs.current[name] = el;
  };

  const inputClass = (name) => `w-full border rounded px-3 py-1 text-sm font-semibold ${errors[name] ? 'border-red-500 ring-1 ring-red-300' : ''}`;

  // Validation and submission
  const canSave = isDirty && formData.ItemName.trim();

  const normalizeForApi = (d) => {
    const n = (v) => (v === "" ? null : v);
    const num = (v) => (v === "" ? null : Number(v));
    return {
      ...d,
      ItemCode: editingItem ? Number(d.ItemCode) : Number(d.ItemCode || 0),
      GroupID: d.GroupID ? Number(d.GroupID) : null,
      MakeID: d.MakeID ? Number(d.MakeID) : null,
      BrandID: d.BrandID ? Number(d.BrandID) : null,
      PartyID: d.PartyID ? Number(d.PartyID) : null,
      Cost: num(d.Cost),
      AvgCost: num(d.AvgCost),
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
  };

  const handleSubmit = async (e, { addAnother = false } = {}) => {
    e.preventDefault();

    // reset previous errors
    setErrors({});

    // basic client-side validation
    if (!formData.ItemName.trim()) {
      setErrors({ ItemName: "Item Name is required" });
      fieldRefs.current.ItemName?.focus();
      return;
    }
    if (!editingItem && !formData.ItemCode) {
      setErrors({ ItemCode: "Item Code is required" });
      fieldRefs.current.ItemCode?.focus();
      return;
    }

    if (!editingItem) {
      const exists = items.find(
        (item) =>
          item.itemcode === formData.ItemCode ||
          item.itemname.toLowerCase() === formData.ItemName.toLowerCase()
      );
      if (exists) {
        setErrors({ ItemCode: "Code or Name already exists", ItemName: "Code or Name already exists" });
        (fieldRefs.current.ItemCode || fieldRefs.current.ItemName)?.focus();
        return;
      }
    }

    try {
      const payload = normalizeForApi(formData);
      if (editingItem) {
        await axios.put(
          `http://localhost:5000/api/items/edit/${editingItem.ItemCode}`,
          payload
        );
        showNotice('success', 'Item updated successfully!');
      } else {
        await axios.post("http://localhost:5000/api/items/add", payload);
        showNotice('success', 'Item added successfully!');
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
          Billable: false,
          Deleted: false
        });
        if (idInputRef.current) {
          idInputRef.current.focus();
        }
      } else {
        closeForm();
      }
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.message || err?.response?.data || err.message || "Error saving item";
      const newErrors = {};
      const lower = String(msg).toLowerCase();
      if (lower.includes("itemcode") || lower.includes("primary key") || lower.includes("duplicate")) {
        newErrors.ItemCode = "Invalid or duplicate Item Code";
      }
      if (lower.includes("foreign key") && lower.includes("group")) newErrors.GroupID = "Invalid Group";
      if (lower.includes("foreign key") && lower.includes("make")) newErrors.MakeID = "Invalid Make";
      if (lower.includes("foreign key") && lower.includes("brand")) newErrors.BrandID = "Invalid Brand";
      if (lower.includes("party")) newErrors.PartyID = "Invalid Party";
      setErrors(newErrors);
      const firstErrField = Object.keys(newErrors)[0];
      if (firstErrField && fieldRefs.current[firstErrField]) {
        fieldRefs.current[firstErrField].focus();
      }
      showNotice('error', msg);
    }
  };

  // Delete handler
  const handleDelete = async (itemCode) => {
    if (window.confirm("Are you sure you want to delete this item?")) {
      try {
        await axios.delete(`http://localhost:5000/api/items/delete/${itemCode}`);
        showNotice('success', 'Item deleted successfully!');
        fetchItems();
      } catch (err) {
        console.error(err);
        showNotice('error', 'Error deleting item');
      }
    }
  };

  // Table columns configuration
  const columns = [
    { key: 'groupname', header: 'Group' },
    { key: 'makename', header: 'Make' },
    { key: 'itemname', header: 'Item Name' },
    { key: 'cost', header: 'Cost', align: 'right', render: (value) => formatAmount(value) },
    { key: 'sprice', header: 'S.Price', align: 'right', render: (value) => formatAmount(value) },
    { key: 'mrp', header: 'MRP', align: 'right', render: (value) => formatAmount(value) },
    { key: 'curstock', header: 'Stock', align: 'right' },
    { key: 'cgst', header: 'CGST', align: 'right' },
    { key: 'sgst', header: 'SGST', align: 'right' },
    { key: 'brandname', header: 'Brand' },
    { key: 'itemcode', header: 'Item Code' },
    { key: 'billable', header: 'Billable', align: 'right', render: (value) => String(value ?? '-') },
    { 
      key: 'actions', 
      header: 'Actions', 
      align: 'right',
      render: (_, row) => (
        <button
          onClick={() => handleDelete(row.itemcode)}
          className="text-red-600 hover:text-red-800 text-xs"
        >
          Delete
        </button>
      )
    }
  ];

  // Record navigation for edit form
  const getCurrentRecordIndex = () => {
    if (!editingItem) return -1;
    return filteredItems.findIndex(item => item.itemcode === editingItem.ItemCode);
  };

  const recordNavigation = {
    currentIndex: getCurrentRecordIndex(),
    totalRecords: filteredItems.length,
    isFirst: getCurrentRecordIndex() === 0,
    isLast: getCurrentRecordIndex() === filteredItems.length - 1,
    onPrevious: () => {
    const currentIndex = getCurrentRecordIndex();
    if (currentIndex > 0) {
        startEditing(filteredItems[currentIndex - 1]);
    }
    },
    onNext: () => {
    const currentIndex = getCurrentRecordIndex();
    if (currentIndex < filteredItems.length - 1) {
        startEditing(filteredItems[currentIndex + 1]);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Notice notice={notice} onClose={closeNotice} />
      
      <div className="p-0">
        <PageHeader
          title="Master Items"
          onNew={() => {
            startAdding();
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
                  Billable: false,
                  Deleted: false
                });
                setTimeout(() => {
                  if (idInputRef.current) {
                    idInputRef.current.focus();
                  }
                }, 100);
              }}
          showForm={showForm}
          onSave={() => handleSubmit({ preventDefault: () => {} })}
          onCancel={closeForm}
          onSaveAndAddAnother={() => handleSubmit({ preventDefault: () => {} }, { addAnother: true })}
          canSave={canSave}
          isEditing={!!editingItem}
          pagination={
            !showForm && totalRecords > 0 ? (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalRecords={totalRecords}
                recordsPerPage={50}
                onPageChange={setCurrentPage}
              />
            ) : null
          }
          searchBar={
            !showForm ? (
              <SearchBar
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                    placeholder="Search items..."
                searchFields={searchFields}
                onSearchFieldsChange={setSearchFields}
                showFieldFilters={true}
              />
            ) : null
          }
        />

        {!showForm ? (
          <DataTable
            data={currentRecords}
            columns={columns}
            onRowClick={startEditing}
            onRowDoubleClick={startEditing}
            emptyMessage="No items found. Try adding a new item or adjusting your search."
            className="min-w-[1200px]"
          />
        ) : (
          <FormWrapper
            title={editingItem ? "Item / Edit" : "Item / New"}
            onClose={closeForm}
            showRecordNavigation={!!editingItem && filteredItems.length > 1}
            recordNavigation={recordNavigation}
          >
            <form className="form-horizontal" onSubmit={(e) => handleSubmit(e)}>
              <div className="px-1 py-1">
                {/* Header panel */}
                <div className="border rounded-md p-1 bg-gray-50 space-y-1" style={{ width: 'fit-content' }}>
                  <div className="flex gap-2 items-center">
                    {/* Group */}
                    <div className="flex items-center gap-1">
                      <label className="text-sm text-gray-700 whitespace-nowrap">Group</label>
                      <select
                        value={formData.GroupID}
                        onChange={(e) => setFormData({ ...formData, GroupID: e.target.value })}
                        ref={setFieldRef('GroupID')}
                        className={`${inputClass('GroupID')} w-48`}
                        style={{ marginLeft: '2.5rem' }}
                      >
                        <option value="">Select Group</option>
                        {dropdownData.groups.map((group) => (
                          <option key={group.groupid} value={group.groupid}>
                            {group.groupname}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Item Code (only when adding) */}
                    {!editingItem && (
                      <div className="w-32">
                        <label className="block text-sm text-gray-700 mb-1">Item Code</label>
                        <input
                          type="text"
                          value={formData.ItemCode}
                          onChange={(e) => setFormData({ ...formData, ItemCode: e.target.value })}
                          ref={(el) => { idInputRef.current = el; setFieldRef('ItemCode')(el); }}
                          className={inputClass('ItemCode')}
                          required
                        />
                        {errors.ItemCode && <p className="text-xs text-red-600 mt-1">{errors.ItemCode}</p>}
                      </div>
                    )}

                    {/* Is Expense and Billable */}
                    <div className="flex items-center gap-2" style={{ marginLeft: '2.5rem' }}>
                      <label className="flex items-center text-sm text-gray-700">
                        Is Expense:
                        <input
                          type="checkbox"
                          checked={formData.IsExpence}
                          onChange={(e) => setFormData({ ...formData, IsExpence: e.target.checked })}
                          className="ml-2"
                        />
                      </label>
                      
                      <label className="flex items-center text-sm text-gray-700">
                        Billable:
                        <input
                          type="checkbox"
                          checked={formData.Billable}
                          onChange={(e) => setFormData({ ...formData, Billable: e.target.checked })}
                          className="ml-2"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="flex gap-2 items-center">
                    {/* Brand + Vendor row */}
                    <div className="flex items-center gap-1">
                      <label className="text-sm text-gray-700 whitespace-nowrap">Brand</label>
                      <select
                        value={formData.BrandID}
                        onChange={(e) => setFormData({ ...formData, BrandID: e.target.value })}
                        ref={setFieldRef('BrandID')}
                        className={`${inputClass('BrandID')} w-48`}
                        style={{ marginLeft: '2.5rem' }}
                      >
                        <option value="">Select Brand</option>
                        {dropdownData.brands.map((brand) => (
                          <option key={brand.brandid} value={brand.brandid}>
                            {brand.brandname}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-1" style={{ marginLeft: '2.5rem' }}>
                      <label className="text-sm text-gray-700 whitespace-nowrap">Vendor</label>
                      <div>
                        <input
                          type="text"
                          value={formData.PartyID}
                          onChange={(e) => setFormData({ ...formData, PartyID: e.target.value })}
                          ref={setFieldRef('PartyID')}
                          className={`${inputClass('PartyID')} w-48`}
                        />
                        {errors.PartyID && <p className="text-xs text-red-600 mt-1">{errors.PartyID}</p>}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 items-center">
                    {/* Make + Model row */}
                    <div className="flex items-center gap-1">
                      <label className="text-sm text-gray-700 whitespace-nowrap">Make</label>
                      <select
                        value={formData.MakeID}
                        onChange={(e) => setFormData({ ...formData, MakeID: e.target.value })}
                        ref={setFieldRef('MakeID')}
                        className={`${inputClass('MakeID')} w-48`}
                        style={{ marginLeft: '2.5rem' }}
                      >
                        <option value="">Select Make</option>
                        {dropdownData.makes.map((make) => (
                          <option key={make.makeid} value={make.makeid}>
                            {make.makename}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-1" style={{ marginLeft: '2.5rem' }}>
                      <label className="text-sm text-gray-700 whitespace-nowrap">Model</label>
                      <input
                        type="text"
                        value={formData.Model}
                        onChange={(e) => setFormData({ ...formData, Model: e.target.value })}
                        ref={setFieldRef('Model')}
                        className={`${inputClass('Model')} w-48`}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    {/* Item Name */}
                    <div className="flex items-start gap-1">
                      <label className="text-sm text-gray-700 mt-1 whitespace-nowrap">Item Name</label>
                      <div className="w-96" style={{ marginLeft: '0.5rem', width: '26rem' }}>
                        <textarea
                          value={formData.ItemName}
                          onChange={(e) => setFormData({ ...formData, ItemName: e.target.value })}
                          ref={setFieldRef('ItemName')}
                          className={`${inputClass('ItemName')} resize-none leading-4 min-h-[30px] whitespace-normal break-words`}
                          rows={2}
                          required
                        />
                        {errors.ItemName && <p className="text-xs text-red-600 mt-1">{errors.ItemName}</p>}
                      </div>
                    </div>

                    {/* Packing and Unit */}
                    <div className="flex items-start gap-1">
                      <label className="text-sm text-gray-700 mt-1 whitespace-nowrap">Packing</label>
                      <div className="flex gap-2 items-center" style={{ marginLeft: '1.5rem' }}>
                        <input
                          type="text"
                          value={formData.Packing}
                          onChange={(e) => setFormData({ ...formData, Packing: e.target.value })}
                          ref={setFieldRef('Packing')}
                          className={`${inputClass('Packing')} w-52`}
                        />
                        <div className="flex items-center gap-1">
                          <label className="text-sm text-gray-700 whitespace-nowrap">Unit</label>
                          <input
                            type="text"
                            value={formData.Unit}
                            onChange={(e) => setFormData({ ...formData, Unit: e.target.value })}
                            ref={setFieldRef('Unit')}
                            className={`${inputClass('Unit')} w-24`}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Specifics */}
                <div className="border rounded-md p-1 relative mt-2 bg-white" style={{ width: 'fit-content' }}>
                  <span className="absolute -top-2 left-2 bg-white px-1 text-xs font-semibold text-gray-800">Specifics</span>
                  <div className="space-y-1">
                    {/* Row 1: Supp. Ref, HSN Code, Part No */}
                    <div className="flex items-center">
                      <label className="text-xs text-gray-700 whitespace-nowrap">Supp. Ref</label>
                      <input
                        type="text"
                        value={formData.SuppRef}
                        onChange={(e) => setFormData({ ...formData, SuppRef: e.target.value })}
                        ref={setFieldRef('SuppRef')}
                        className={`${inputClass('SuppRef')} text-xs px-1 ml-1`}
                        style={{ width: '7.5rem' }}
                      />
                      <span style={{ width: '1rem' }}></span>
                      <label className="text-xs text-gray-700 whitespace-nowrap">HSN Code</label>
                      <input
                        type="text"
                        value={formData.HSNCode}
                        onChange={(e) => setFormData({ ...formData, HSNCode: e.target.value })}
                        className={`${inputClass('HSNCode')} text-xs px-1 ml-1`}
                        style={{ width: '7.5rem' }}
                      />
                      <span style={{ width: '1rem' }}></span>
                      <label className="text-xs text-gray-700 whitespace-nowrap">Part No</label>
                      <input
                        type="text"
                        value={formData.PartNo}
                        onChange={(e) => setFormData({ ...formData, PartNo: e.target.value })}
                        ref={setFieldRef('PartNo')}
                        className={`${inputClass('PartNo')} text-xs px-1 ml-1`}
                        style={{ width: '7.5rem' }}
                      />
                    </div>

                    {/* Row 2: Barcode, Shelf, Curr. Stock */}
                    <div className="flex items-center">
                      <label className="text-xs text-gray-700 whitespace-nowrap">Barcode</label>
                      <span style={{ width: '2ch' }}></span>
                      <input
                        type="text"
                        value={formData.Barcode}
                        onChange={(e) => setFormData({ ...formData, Barcode: e.target.value })}
                        ref={setFieldRef('Barcode')}
                        className={`${inputClass('Barcode')} text-xs px-1 ml-1`}
                        style={{ width: '7.5rem' }}
                      />
                      <span style={{ width: '1rem' }}></span>
                      <label className="text-xs text-gray-700 whitespace-nowrap">Shelf</label>
                      <input
                        type="text"
                        value={formData.Shelf}
                        onChange={(e) => setFormData({ ...formData, Shelf: e.target.value })}
                        ref={setFieldRef('Shelf')}
                        className={`${inputClass('Shelf')} text-xs px-1 ml-1`}
                        style={{ width: '7.5rem' }}
                      />
                      <span style={{ width: 'calc(1rem + 2ch)' }}></span>
                      <label className="text-xs text-gray-700 whitespace-nowrap">Stock</label>
                      <input
                        type="number"
                        value={formData.CurStock}
                        onChange={(e) => setFormData({ ...formData, CurStock: e.target.value })}
                        ref={setFieldRef('CurStock')}
                        className={`${inputClass('CurStock')} text-xs px-1 ml-1`}
                        style={{ width: '7.5rem' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Tax and Price sections side by side */}
                <div className="grid grid-cols-12 gap-2 mt-2">
                  {/* Tax */}
                  <div className="col-span-3 border rounded-md p-2 relative bg-white" style={{ width: 'fit-content' }}>
                    <span className="absolute -top-2 left-2 bg-white px-1 text-xs font-semibold text-gray-800">Tax</span>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-800 whitespace-nowrap w-12">CGST %</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.CGST}
                          onChange={(e) => setFormData({ ...formData, CGST: e.target.value })}
                          ref={setFieldRef('CGST')}
                          className={`${inputClass('CGST')} font-semibold text-xs px-1`}
                          style={{ width: '7.5rem' }}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-800 whitespace-nowrap w-12">SGST %</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.SGST}
                          onChange={(e) => setFormData({ ...formData, SGST: e.target.value })}
                          className={`${inputClass('SGST')} font-semibold text-xs px-1`}
                          style={{ width: '7.5rem' }}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-800 whitespace-nowrap w-12">IGST %</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.IGST}
                          onChange={(e) => setFormData({ ...formData, IGST: e.target.value })}
                          className={`${inputClass('IGST')} font-semibold text-xs px-1`}
                          style={{ width: '7.5rem' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="col-span-9 border rounded-md p-1 relative bg-white" style={{ width: 'fit-content', marginLeft: '1.5rem' }}>
                    <span className="absolute -top-2 left-2 bg-white px-1 text-xs font-semibold text-gray-800">Price</span>
                    <div className="grid grid-cols-2 gap-2">
                      {/* Column 1: Avg Cost, MRP, MU on MRP */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-1">
                          <label className="text-xs text-gray-800 whitespace-nowrap w-20">Avg. Cost</label>
                          <input
                            type="number"
                            step="0.01"
                            value={formData.AvgCost}
                            onChange={(e) => setFormData({ ...formData, AvgCost: e.target.value })}
                            ref={setFieldRef('AvgCost')}
                            className={`${inputClass('AvgCost')} font-semibold text-xs px-1`}
                            style={{ width: '6rem' }}
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <label className="text-xs text-gray-800 whitespace-nowrap w-20">MRP</label>
                          <input
                            type="number"
                            step="0.01"
                            value={formData.MRP}
                            onChange={(e) => setFormData({ ...formData, MRP: e.target.value })}
                            ref={setFieldRef('MRP')}
                            className={`${inputClass('MRP')} font-semibold text-xs px-1`}
                            style={{ width: '6rem' }}
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <label className="text-xs text-gray-800 whitespace-nowrap w-20">MU on MRP</label>
                          <div className="border rounded px-1 py-1 text-xs bg-white font-semibold" style={{ width: '6rem' }}>
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
                          <label className="text-xs text-gray-800 whitespace-nowrap w-20">Cost</label>
                          <input
                            type="number"
                            step="0.01"
                            value={formData.Cost}
                            onChange={(e) => setFormData({ ...formData, Cost: e.target.value })}
                            ref={setFieldRef('Cost')}
                            className={`${inputClass('Cost')} font-semibold text-xs px-1`}
                            style={{ width: '6rem' }}
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <label className="text-xs text-gray-800 whitespace-nowrap w-20">Selling Price</label>
                          <input
                            type="number"
                            step="0.01"
                            value={formData.SPrice}
                            onChange={(e) => setFormData({ ...formData, SPrice: e.target.value })}
                            ref={setFieldRef('SPrice')}
                            className={`${inputClass('SPrice')} font-semibold text-xs px-1`}
                            style={{ width: '6rem' }}
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <label className="text-xs text-gray-800 whitespace-nowrap w-20">MU on SP</label>
                          <div className="border rounded px-1 py-1 text-xs bg-white font-semibold" style={{ width: '6rem' }}>
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
          </FormWrapper>
        )}
      </div>
    </div>
  );
}