import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { 
  Pagination, SearchBar, DataTable, FormWrapper, PageHeader, Notice,
  usePagination, useNotice, useFormState 
} from './components';

export default function BrandPage() {
  const [brands, setBrands] = useState([]);
  const brandNameRef = useRef(null);
  
  // Custom hooks for state management
  const { notice, showNotice, closeNotice } = useNotice();
  const { formData, setFormData, showForm, editingItem, isDirty, startEditing: originalStartEditing, startAdding, closeForm } = useFormState({
    BrandID: "",
    BrandName: ""
  });

  // Override startEditing to properly map database fields to form fields
  const startEditing = (brand) => {
    const mappedData = {
      BrandID: brand.brandid,
      BrandName: brand.brandname
    };
    originalStartEditing(mappedData);
  };

  // Search and pagination
  const {
    currentPage,
    setCurrentPage,
    searchTerm,
    setSearchTerm
  } = usePagination(brands);

  const filteredBrands = brands.filter(
    (b) =>
      b.brandid.toString().includes(searchTerm.toLowerCase()) ||
      b.brandname.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate pagination for filtered results
  const totalRecords = filteredBrands.length;
  const totalPages = Math.ceil(totalRecords / 50);
  const startIndex = (currentPage - 1) * 50;
  const endIndex = startIndex + 50;
  const currentRecords = filteredBrands.slice(startIndex, endIndex);

  // Fetch brands
  const fetchBrands = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/brands/all");
      setBrands(res.data);
    } catch (err) {
      console.error("Error fetching brands:", err);
    }
  };

  useEffect(() => {
    fetchBrands();
  }, []);

  // Validation and submission
  const canSave = isDirty && formData.BrandName.trim();

  const handleSubmit = async (e, { addAnother = false } = {}) => {
    e.preventDefault();

    if (!formData.BrandName.trim()) {
      showNotice('error', 'Brand Name is required');
      return;
    }

    if (!editingItem && !formData.BrandID) {
      showNotice('error', 'Brand ID is required');
      return;
    }

    // Duplicate check
    if (!editingItem) {
      const exists = brands.find(
        (b) =>
          b.brandid === parseInt(formData.BrandID) ||
          b.brandname.toLowerCase() === formData.BrandName.toLowerCase()
      );
      if (exists) {
        showNotice('error', '❌ Brand ID or Name already exists!');
        return;
      }
    } else {
      const exists = brands.find(
        (b) =>
          (b.brandid === parseInt(formData.BrandID) ||
            b.brandname.toLowerCase() === formData.BrandName.toLowerCase()) &&
          b.brandid !== editingItem.brandid
      );
      if (exists) {
        showNotice('error', '❌ Brand ID or Name already exists!');
        return;
      }
    }

    try {
      if (editingItem) {
        await axios.put(
          `http://localhost:5000/api/brands/edit/${editingItem.brandid}`,
          { BrandName: formData.BrandName }
        );
        showNotice('success', 'Brand updated successfully');
      } else {
        await axios.post("http://localhost:5000/api/brands/add", {
          BrandID: Number(formData.BrandID),
          BrandName: formData.BrandName,
        });
        showNotice('success', 'Brand added successfully');
      }
      
      await fetchBrands();
      
      if (addAnother && !editingItem) {
        const nextId = brands.length ? Math.max(...brands.map(b => Number(b.brandid) || 0)) + 1 : 1;
        setFormData({ BrandID: String(nextId), BrandName: "" });
        setTimeout(() => brandNameRef.current && brandNameRef.current.focus(), 0);
        return;
      }
      
      closeForm();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Something went wrong!";
      showNotice('error', msg);
      console.error(err);
    }
  };

  // Delete handler
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this Brand?")) return;
    try {
      await axios.delete(`http://localhost:5000/api/brands/delete/${id}`);
      await fetchBrands();
      showNotice('success', 'Brand deleted');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Delete failed";
      showNotice('error', msg);
      console.error("Delete brand error:", err);
    }
  };

  // Table columns configuration
  const columns = [
    { key: 'brandid', header: 'Brand ID', hidden: true },
    { key: 'brandname', header: 'Brand Name' },
    { 
      key: 'actions', 
      header: 'Actions', 
      align: 'right',
      render: (_, row) => (
        <button
          onClick={() => handleDelete(row.brandid)}
          className="text-red-600 hover:underline"
        >
          Delete
        </button>
      )
    }
  ];

  // Record navigation for edit form
  const getCurrentRecordIndex = () => {
    if (!editingItem) return -1;
    return filteredBrands.findIndex(b => b.brandid === editingItem.BrandID);
  };

  const recordNavigation = {
    currentIndex: getCurrentRecordIndex(),
    totalRecords: filteredBrands.length,
    isFirst: getCurrentRecordIndex() === 0,
    isLast: getCurrentRecordIndex() === filteredBrands.length - 1,
    onPrevious: () => {
      const currentIndex = getCurrentRecordIndex();
      if (currentIndex > 0) {
        startEditing(filteredBrands[currentIndex - 1]);
      }
    },
    onNext: () => {
      const currentIndex = getCurrentRecordIndex();
      if (currentIndex < filteredBrands.length - 1) {
        startEditing(filteredBrands[currentIndex + 1]);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Notice notice={notice} onClose={closeNotice} />
      
      <div className="p-6">
        <PageHeader
          title="Master Brands"
          onNew={() => {
            const nextId = brands.length ? Math.max(...brands.map(b => Number(b.brandid) || 0)) + 1 : 1;
            startAdding();
            setFormData({ BrandID: String(nextId), BrandName: "" });
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
                placeholder="Search by ID or Name..."
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
            emptyMessage="No Brands Found"
          />
        ) : (
          <FormWrapper
            title={editingItem ? "Brand / Edit" : "Brand / New"}
            onClose={closeForm}
            showRecordNavigation={!!editingItem && filteredBrands.length > 1}
            recordNavigation={recordNavigation}
          >
            <form onSubmit={(e) => handleSubmit(e)}>
              <div className="border rounded-md p-4 bg-gray-50">
                <div className="grid grid-cols-12 items-center gap-x-3">
                  <label className="col-span-4 text-sm text-gray-700">Brand Name</label>
                  <input
                    type="text"
                    value={formData.BrandName}
                    onChange={(e) => setFormData({ ...formData, BrandName: e.target.value })}
                    ref={brandNameRef}
                    className="col-span-8 border rounded px-3 py-2 text-sm"
                    required
                  />
                </div>
              </div>
            </form>
          </FormWrapper>
        )}
      </div>
    </div>
  );
}