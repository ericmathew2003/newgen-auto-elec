import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { usePageNavigation, Breadcrumb } from "./components/NavigationHelper";
import API_BASE_URL from "./config/api";

export default function BrandPage() {
  const { id, isNewMode, isEditMode, showForm, navigateToList, navigateToNew, navigateToEdit } = usePageNavigation('/brands');
  
  const [brands, setBrands] = useState([]);
  const [editingBrand, setEditingBrand] = useState(null);
  const [formData, setFormData] = useState({ BrandID: "New", BrandName: "" });
  const [initialFormData, setInitialFormData] = useState({ BrandID: "New", BrandName: "" });
  const [searchTerm, setSearchTerm] = useState(""); // 🔎 search state
  const [currentPage, setCurrentPage] = useState(1); // 📄 pagination state
  const [recordsPerPage] = useState(50); // 📄 records per page
  const idInputRef = useRef(null);

  // Toast notification state
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // Fetch brands
  const fetchBrands = async () => {
    try {
      console.log("Fetching brands...");
      const res = await axios.get(`${API_BASE_URL}/api/brands/all`);
      console.log("Brands data received:", res.data);
      setBrands(res.data);
    } catch (err) {
      console.error("Error fetching brands:", err);
    }
  };

  useEffect(() => {
    fetchBrands();
  }, []);

  // Initialize form data for new mode immediately
  useEffect(() => {
    if (isNewMode) {
      setEditingBrand(null);
      setFormData({ BrandID: "New", BrandName: "" });
      setInitialFormData({ BrandID: "New", BrandName: "" });
    }
  }, [isNewMode]);

  // Handle edit mode - load brand data when ID is in URL
  useEffect(() => {
    if (isEditMode && id && brands.length > 0) {
      const brand = brands.find(b => b.brandid.toString() === id);
      if (brand) {
        setEditingBrand(brand);
        setFormData({ BrandID: brand.brandid, BrandName: brand.brandname });
        setInitialFormData({
          BrandID: String(brand.brandid ?? ""),
          BrandName: String(brand.brandname ?? "")
        });
      } else {
        // Brand not found, redirect to list
        navigateToList();
      }
    }
  }, [isEditMode, id, brands, navigateToList]);

  // Toast notification helper
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'success' });
    }, 3000);
  };

  // Submit handler with validation
  const handleSubmit = async (e, { addAnother = false } = {}) => {
    e.preventDefault();

    if (!formData.BrandName.trim()) {
      showToast("Brand Name is required", 'error');
      return;
    }

    if (!editingBrand) {
      const exists = brands.find(
        (b) => b.brandname.toLowerCase() === formData.BrandName.toLowerCase()
      );
      if (exists) {
        showToast("Brand Name already exists!", 'error');
        return;
      }
    } else {
      const exists = brands.find(
        (b) =>
          b.brandname.toLowerCase() === formData.BrandName.toLowerCase() &&
          b.brandid !== editingBrand.brandid
      );
      if (exists) {
        showToast("Brand Name already exists!", 'error');
        return;
      }
    }

    try {
      if (editingBrand) {
        await axios.put(
          `${API_BASE_URL}/api/brands/edit/${editingBrand.brandid}`,
          { BrandName: formData.BrandName }
        );
        showToast("Brand updated successfully!", 'success');
      } else {
        await axios.post(`${API_BASE_URL}/api/brands/add`, { BrandName: formData.BrandName });
        showToast("Brand added successfully!", 'success');
      }
      fetchBrands();
      
      if (addAnother && !editingBrand) {
        setFormData({ BrandID: "New", BrandName: "" });
        setTimeout(() => idInputRef.current && idInputRef.current.focus(), 0);
        return;
      }
      
      // Navigate back to brands list
      navigateToList();
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.response?.data?.error || "Something went wrong!";
      showToast(errorMessage, 'error');
      console.error(err);
    }
  };

  // Handle Delete with reference checking
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this Brand?")) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/brands/delete/${id}`);
      showToast("Brand deleted successfully!", 'success');
      fetchBrands();
    } catch (err) {
      console.error(err);
      if (err.response?.status === 400) {
        showToast("Record exists in item master, cannot delete", 'error');
      } else {
        showToast("Error deleting brand", 'error');
      }
    }
  };

  // Click to edit
  const handleDoubleClick = (brand) => {
    navigateToEdit(brand.brandid);
  };

  // This useEffect is no longer needed as we handle initialization in the navigation-based useEffect above

  const isDirty =
    String(formData.BrandID ?? "").trim() !== String(initialFormData.BrandID ?? "").trim() ||
    String(formData.BrandName ?? "").trim() !== String(initialFormData.BrandName ?? "").trim();

  const hasRequiredValues = String(formData.BrandName ?? "").trim().length > 0;

  const canSave = isDirty && hasRequiredValues;

  // 🔎 Filter brands by searchTerm
  const filteredBrands = brands.filter(
    (b) =>
      b.brandid.toString().includes(searchTerm.toLowerCase()) ||
      b.brandname.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 📄 Pagination calculations
  const totalRecords = filteredBrands.length;
  const totalPages = Math.ceil(totalRecords / recordsPerPage);
  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = startIndex + recordsPerPage;
  const currentRecords = filteredBrands.slice(startIndex, endIndex);
  
  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Navigation functions
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

  // 🔄 Record navigation in edit form
  const getCurrentRecordIndex = () => {
    if (!editingBrand) return -1;
    return filteredBrands.findIndex(b => b.brandid === editingBrand.brandid);
  };

  const goToPreviousRecord = () => {
    const currentIndex = getCurrentRecordIndex();
    if (currentIndex > 0) {
      const previousBrand = filteredBrands[currentIndex - 1];
      navigateToEdit(previousBrand.brandid);
    }
  };

  const goToNextRecord = () => {
    const currentIndex = getCurrentRecordIndex();
    if (currentIndex < filteredBrands.length - 1) {
      const nextBrand = filteredBrands[currentIndex + 1];
      navigateToEdit(nextBrand.brandid);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Toast Notification */}
      {toast.show && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg text-white font-medium transition-all duration-300 ${
          toast.type === 'success' ? 'bg-green-500' : 
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
      
      <div className="p-6">
        {/* Breadcrumb */}
        <Breadcrumb 
          basePath="/brands" 
          currentPage="Brands" 
          itemName={showForm ? (isNewMode ? "New Brand" : `Edit Brand: ${formData.BrandName}`) : null}
        />
        
        {/* Header with New and Form Actions */}
        <div className="flex flex-col items-start mb-4">
          <div className="flex items-center justify-between w-full mb-2">
            <div className="flex items-center gap-2">
            <button
              onClick={navigateToNew}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg shadow hover:bg-purple-700"
            >
              New
            </button>

            {/* 🔎 Show search bar only when not adding/editing */}
            {!showForm && (
              <input
                type="text"
                placeholder="Search by ID or Name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-3 py-2 border rounded-md text-sm w-64"
              />
            )}

            {showForm && (
              <>
                {!editingBrand && (
                  <button
                    type="button"
                    disabled={!canSave}
                    className={`px-3 py-2 text-sm border rounded ${canSave ? "" : "opacity-50 cursor-not-allowed"}`}
                    onClick={() => handleSubmit({ preventDefault: () => {} }, { addAnother: true })}
                  >
                    Save & Add Another
                  </button>
                )}
                <button
                  type="button"
                  className="px-3 py-2 text-sm border rounded"
                  onClick={navigateToList}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!canSave}
                  onClick={() => handleSubmit({ preventDefault: () => {} })}
                  className={`px-4 py-2 text-sm rounded text-white ${canSave ? "bg-purple-600 hover:bg-purple-700" : "bg-purple-400 cursor-not-allowed opacity-60"}`}
                >
                  Save
                </button>
              </>
            )}
            </div>

            {/* 📄 Record Navigation - only show in table mode */}
            {!showForm && totalRecords > 0 && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <button
                  onClick={goToPreviousPage}
                  disabled={currentPage === 1}
                  className={`p-1 rounded ${
                    currentPage === 1
                      ? "text-gray-300 cursor-not-allowed"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
                  </svg>
                </button>
                <span className="font-medium">
                  {startIndex + 1}-{Math.min(endIndex, totalRecords)} / {totalRecords}
                </span>
                <button
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages}
                  className={`p-1 rounded ${
                    currentPage === totalPages
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

            {/* 🔄 Record navigation in edit form mode */}
            {showForm && editingBrand && filteredBrands.length > 1 && (
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
                  Record {getCurrentRecordIndex() + 1} / {filteredBrands.length}
                </span>
                <button
                  type="button"
                  onClick={goToNextRecord}
                  disabled={getCurrentRecordIndex() === filteredBrands.length - 1}
                  className={`p-1 rounded ${
                    getCurrentRecordIndex() === filteredBrands.length - 1
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
          <h1 className="text-xl font-semibold">Master Brands</h1>
        </div>

        {/* Table OR Form */}
        {!showForm ? (
          <div className="border rounded-lg shadow-sm overflow-auto max-h-[70vh]">
            <table className="w-full border-collapse">
              <thead className="bg-gray-100 text-left sticky top-0 z-10">
                <tr>
                  <th className="p-3 border-b">Brand ID</th>
                  <th className="p-3 border-b">Brand Name</th>
                  <th className="p-3 border-b text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentRecords.map((brand) => (
                  <tr
                    key={brand.brandid}
                    onClick={() => handleDoubleClick(brand)}
                    className="cursor-pointer hover:bg-indigo-50 transition-colors"
                    title="Click to edit brand"
                  >
                    <td className="px-2 py-1 border-b">{brand.brandid}</td>
                    <td className="px-2 py-1 border-b">{brand.brandname}</td>
                    <td className="px-2 py-1 border-b text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent row click event
                          handleDelete(brand.brandid);
                        }}
                        className="text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {totalRecords === 0 && (
                  <tr>
                    <td colSpan="3" className="text-center p-3">
                      No Brands Found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-white border rounded-lg shadow-sm">
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h2 className="text-[15px] font-semibold">
                {editingBrand ? "Brand / Edit" : "Brand / New"}
              </h2>
              <button
                className="text-gray-500 hover:text-gray-700"
                onClick={navigateToList}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <form onSubmit={(e) => handleSubmit(e)}>
              <div className="px-5 py-4">
                <div className="border rounded-md p-4 bg-gray-50">
                  <div className="grid grid-cols-12 items-center gap-x-3 mb-4">
                    <label className="col-span-4 text-sm text-gray-700">Brand ID</label>
                    <input
                      type="text"
                      value={formData.BrandID}
                      readOnly
                      className="col-span-8 border rounded px-3 py-2 text-sm bg-gray-100 cursor-not-allowed"
                    />
                  </div>
                  <div className="grid grid-cols-12 items-center gap-x-3">
                    <label className="col-span-4 text-sm text-gray-700">Brand Name</label>
                    <input
                      key={isNewMode ? 'new' : `edit-${id}`}
                      type="text"
                      value={formData.BrandName || ""}
                      onChange={(e) => setFormData({ ...formData, BrandName: e.target.value })}
                      className="col-span-8 border rounded px-3 py-2 text-sm"
                      required
                      placeholder="Enter brand name"
                      autoFocus={isNewMode}
                    />
                  </div>
                </div>
              </div>
              {/* Moved action buttons to header next to New */}
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
