import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { usePageNavigation, Breadcrumb } from "./components/NavigationHelper";
import API_BASE_URL from "./config/api";

export default function MakePage() {
  const { id, isNewMode, isEditMode, showForm, navigateToList, navigateToNew, navigateToEdit } = usePageNavigation('/makes');

  const [makes, setMakes] = useState([]);
  const [editingMake, setEditingMake] = useState(null);
  const [formData, setFormData] = useState({ MakeID: "New", MakeName: "" });
  const [initialFormData, setInitialFormData] = useState({ MakeID: "New", MakeName: "" });
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage] = useState(50);
  const idInputRef = useRef(null);

  // Toast notification state
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // Fetch makes
  const fetchMakes = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/makes/all`);
      setMakes(res.data);
    } catch (err) {
      console.error("Error fetching makes:", err);
    }
  };

  useEffect(() => {
    fetchMakes();
  }, []);

  // Initialize form data for new mode immediately
  useEffect(() => {
    if (isNewMode) {
      setEditingMake(null);
      setFormData({ MakeID: "New", MakeName: "" });
      setInitialFormData({ MakeID: "New", MakeName: "" });
    }
  }, [isNewMode]);

  // Handle edit mode - load make data when ID is in URL
  useEffect(() => {
    if (isEditMode && id && makes.length > 0) {
      const make = makes.find(m => m.makeid.toString() === id);
      if (make) {
        setEditingMake(make);
        setFormData({
          MakeID: make.makeid,
          MakeName: make.makename || "",
        });
        setInitialFormData({
          MakeID: String(make.makeid ?? ""),
          MakeName: String(make.makename ?? ""),
        });
      } else {
        // Make not found, redirect to list
        navigateToList();
      }
    }
  }, [isEditMode, id, makes, navigateToList]);

  // Toast notification helper
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'success' });
    }, 3000);
  };

  // Handle Add/Edit submit
  const handleSubmit = async (e, { addAnother = false } = {}) => {
    e.preventDefault();

    if (!formData.MakeName.trim()) {
      showToast("Make Name is required", 'error');
      return;
    }

    // Duplicate check
    if (!editingMake) {
      const exists = makes.find(
        (m) => m.makename.toLowerCase() === formData.MakeName.toLowerCase()
      );
      if (exists) {
        showToast("Make Name already exists!", 'error');
        return;
      }
    } else {
      const exists = makes.find(
        (m) =>
          m.makename.toLowerCase() === formData.MakeName.toLowerCase() &&
          m.makeid !== editingMake.makeid
      );
      if (exists) {
        showToast("Make Name already exists!", 'error');
        return;
      }
    }

    try {
      if (editingMake) {
        await axios.put(
          `http://localhost:5000/api/makes/edit/${editingMake.makeid}`,
          { MakeName: formData.MakeName }
        );
        showToast("Make updated successfully!", 'success');
      } else {
        await axios.post(`${API_BASE_URL}/api/makes/add`, { MakeName: formData.MakeName });
        showToast("Make added successfully!", 'success');
      }
      fetchMakes();

      if (addAnother && !editingMake) {
        setFormData({ MakeID: "New", MakeName: "" });
        setTimeout(() => idInputRef.current?.focus(), 0);
        return;
      }

      // Navigate back to makes list
      navigateToList();
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.response?.data?.error || "Something went wrong!";
      showToast(errorMessage, 'error');
      console.error(err);
    }
  };

  // Handle Delete with reference checking
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this Make?")) return;
    try {
      await axios.delete(`http://localhost:5000/api/makes/delete/${id}`);
      showToast("Make deleted successfully!", 'success');
      fetchMakes();
    } catch (err) {
      console.error(err);
      if (err.response?.status === 400) {
        showToast("Record exists in item master, cannot delete", 'error');
      } else {
        showToast("Error deleting make", 'error');
      }
    }
  };

  // Click to Edit
  const handleDoubleClick = (make) => {
    navigateToEdit(make.makeid);
  };

  // This useEffect is no longer needed as we handle initialization in the navigation-based useEffect above

  // Dirty check
  const isDirty =
    String(formData.MakeID ?? "").trim() !== String(initialFormData.MakeID ?? "").trim() ||
    String(formData.MakeName ?? "").trim() !== String(initialFormData.MakeName ?? "").trim();

  const hasRequiredValues = String(formData.MakeName ?? "").trim().length > 0;

  const canSave = isDirty && hasRequiredValues;

  // Search filter
  const filteredMakes = makes.filter(
    (m) =>
      m.makeid.toString().includes(searchTerm.toLowerCase()) ||
      m.makename.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pagination
  const totalRecords = filteredMakes.length;
  const totalPages = Math.ceil(totalRecords / recordsPerPage);
  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = startIndex + recordsPerPage;
  const currentRecords = filteredMakes.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const goToPreviousPage = () => currentPage > 1 && setCurrentPage(currentPage - 1);
  const goToNextPage = () => currentPage < totalPages && setCurrentPage(currentPage + 1);

  // Record nav in edit form
  const getCurrentRecordIndex = () =>
    editingMake ? filteredMakes.findIndex((m) => m.makeid === editingMake.makeid) : -1;

  const goToPreviousRecord = () => {
    const currentIndex = getCurrentRecordIndex();
    if (currentIndex > 0) {
      const previousMake = filteredMakes[currentIndex - 1];
      navigateToEdit(previousMake.makeid);
    }
  };

  const goToNextRecord = () => {
    const currentIndex = getCurrentRecordIndex();
    if (currentIndex < filteredMakes.length - 1) {
      const nextMake = filteredMakes[currentIndex + 1];
      navigateToEdit(nextMake.makeid);
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

      <div className="p-6">
        {/* Breadcrumb */}
        <Breadcrumb
          basePath="/makes"
          currentPage="Makes"
          itemName={showForm ? (isNewMode ? "New Make" : `Edit Make: ${formData.MakeName}`) : null}
        />

        {/* Header */}
        <div className="flex flex-col items-start mb-4">
          <div className="flex items-center justify-between w-full mb-2">
            <div className="flex items-center gap-2">
              <button
                onClick={navigateToNew}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg shadow hover:bg-purple-700"
              >
                New
              </button>

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
                  {!editingMake && (
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
                    onClick={navigateToList}
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
                </>
              )}
            </div>

            {/* Pagination UI */}
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
                  ◀
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
                  ▶
                </button>
              </div>
            )}

            {/* Record navigation in form */}
            {showForm && editingMake && filteredMakes.length > 1 && (
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
                  ◀
                </button>
                <span className="font-medium">
                  Record {getCurrentRecordIndex() + 1} / {filteredMakes.length}
                </span>
                <button
                  type="button"
                  onClick={goToNextRecord}
                  disabled={getCurrentRecordIndex() === filteredMakes.length - 1}
                  className={`p-1 rounded ${getCurrentRecordIndex() === filteredMakes.length - 1
                    ? "text-gray-300 cursor-not-allowed"
                    : "text-gray-600 hover:bg-gray-100"
                    }`}
                >
                  ▶
                </button>
              </div>
            )}
          </div>
          <h1 className="text-xl font-semibold">Master Makes</h1>
        </div>

        {/* Table OR Form */}
        {!showForm ? (
          <div className="border rounded-lg shadow-sm overflow-auto max-h-[70vh]">
            <table className="w-full border-collapse">
              <thead className="bg-gray-100 text-left sticky top-0 z-10">
                <tr>
                  <th className="px-2 py-1 border-b">Make ID</th>
                  <th className="px-2 py-1 border-b">Make Name</th>
                  <th className="px-2 py-1 border-b text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentRecords.map((make) => (
                  <tr
                    key={make.makeid}
                    onClick={() => handleDoubleClick(make)}
                    className="cursor-pointer hover:bg-indigo-50 transition-colors"
                    title="Click to edit make"
                  >
                    <td className="px-2 py-1 border-b">{make.makeid}</td>
                    <td className="px-2 py-1 border-b">{make.makename}</td>
                    <td className="px-2 py-1 border-b text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent row click event
                          handleDelete(make.makeid);
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
                      No Makes Found
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
                {editingMake ? "Make / Edit" : "Make / New"}
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
                    <label className="col-span-4 text-sm text-gray-700">Make ID</label>
                    <input
                      type="text"
                      value={formData.MakeID}
                      readOnly
                      className="col-span-8 border rounded px-3 py-2 text-sm bg-gray-100 cursor-not-allowed"
                    />
                  </div>
                  <div className="grid grid-cols-12 items-center gap-x-3">
                    <label className="col-span-4 text-sm text-gray-700">Make Name</label>
                    <input
                      type="text"
                      value={formData.MakeName}
                      onChange={(e) => setFormData({ ...formData, MakeName: e.target.value })}
                      className="col-span-8 border rounded px-3 py-2 text-sm"
                      required
                    />
                  </div>
                </div>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
