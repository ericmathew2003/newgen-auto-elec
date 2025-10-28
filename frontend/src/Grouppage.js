import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { usePageNavigation, Breadcrumb } from "./components/NavigationHelper";
import API_BASE_URL from "./config/api";

export default function GroupPage() {
  const { id, isNewMode, isEditMode, showForm, navigateToList, navigateToNew, navigateToEdit } = usePageNavigation('/groups');
  
  const [groups, setGroups] = useState([]);
  const [editingGroup, setEditingGroup] = useState(null);
  const [formData, setFormData] = useState({ GroupID: "New", GroupName: "" });
  const [initialFormData, setInitialFormData] = useState({ GroupID: "New", GroupName: "" });
  const [searchTerm, setSearchTerm] = useState(""); // 🔎 search state
  const [currentPage, setCurrentPage] = useState(1); // 📄 pagination state
  const [recordsPerPage] = useState(50); // 📄 records per page
  const idInputRef = useRef(null);

  // Toast notification state
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // Fetch groups
  const fetchGroups = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/groups/all`);
      setGroups(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  // Initialize form data for new mode immediately
  useEffect(() => {
    if (isNewMode) {
      setEditingGroup(null);
      setFormData({ GroupID: "New", GroupName: "" });
      setInitialFormData({ GroupID: "New", GroupName: "" });
    }
  }, [isNewMode]);

  // Handle edit mode - load group data when ID is in URL
  useEffect(() => {
    if (isEditMode && id && groups.length > 0) {
      const group = groups.find(g => g.groupid.toString() === id);
      if (group) {
        setEditingGroup(group);
        setFormData({ GroupID: group.groupid, GroupName: group.groupname });
        setInitialFormData({
          GroupID: String(group.groupid ?? ""),
          GroupName: String(group.groupname ?? "")
        });
      } else {
        // Group not found, redirect to list
        navigateToList();
      }
    }
  }, [isEditMode, id, groups, navigateToList]);

  // Toast notification helper
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'success' });
    }, 3000);
  };

  // ✅ Handle Add/Edit form submit with validation
  const handleSubmit = async (e, { addAnother = false } = {}) => {
    e.preventDefault();

    if (!formData.GroupName.trim()) {
      showToast("Group Name is required", 'error');
      return;
    }

    if (!editingGroup) {
      const exists = groups.find(
        (g) => g.groupname.toLowerCase() === formData.GroupName.toLowerCase()
      );
      if (exists) {
        showToast("Group Name already exists!", 'error');
        return;
      }
    } else {
      const exists = groups.find(
        (g) =>
          g.groupname.toLowerCase() === formData.GroupName.toLowerCase() &&
          g.groupid !== editingGroup.groupid
      );
      if (exists) {
        showToast("Group Name already exists!", 'error');
        return;
      }
    }

    try {
      if (editingGroup) {
        await axios.put(
          `${API_BASE_URL}/api/groups/edit/${editingGroup.groupid}`,
          { GroupName: formData.GroupName }
        );
        showToast("Group updated successfully!", 'success');
      } else {
        await axios.post(`${API_BASE_URL}/api/groups/add`, { GroupName: formData.GroupName });
        showToast("Group added successfully!", 'success');
      }
      fetchGroups();
      
      if (addAnother && !editingGroup) {
        setFormData({ GroupID: "New", GroupName: "" });
        setTimeout(() => idInputRef.current && idInputRef.current.focus(), 0);
        return;
      }
      
      // Navigate back to groups list
      navigateToList();
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.response?.data?.error || "Something went wrong!";
      showToast(errorMessage, 'error');
      console.error(err);
    }
  };

  // Handle Delete with reference checking
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this Group?")) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/groups/delete/${id}`);
      showToast("Group deleted successfully!", 'success');
      fetchGroups();
    } catch (err) {
      console.error(err);
      if (err.response?.status === 400) {
        showToast("Record exists in item master, cannot delete", 'error');
      } else {
        showToast("Error deleting group", 'error');
      }
    }
  };

  // Handle Click Edit
  const handleDoubleClick = (group) => {
    navigateToEdit(group.groupid);
  };

  // This useEffect is no longer needed as we handle initialization in the navigation-based useEffect above

  // Dirty check
  const isDirty =
    String(formData.GroupID ?? "").trim() !== String(initialFormData.GroupID ?? "").trim() ||
    String(formData.GroupName ?? "").trim() !== String(initialFormData.GroupName ?? "").trim();

  const hasRequiredValues = String(formData.GroupName ?? "").trim().length > 0;

  const canSave = isDirty && hasRequiredValues;

  // 🔎 Filter groups by searchTerm
  const filteredGroups = groups.filter(
    (g) =>
      g.groupid.toString().includes(searchTerm.toLowerCase()) ||
      g.groupname.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 📄 Pagination calculations
  const totalRecords = filteredGroups.length;
  const totalPages = Math.ceil(totalRecords / recordsPerPage);
  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = startIndex + recordsPerPage;
  const currentRecords = filteredGroups.slice(startIndex, endIndex);
  
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
    if (!editingGroup) return -1;
    return filteredGroups.findIndex(g => g.groupid === editingGroup.groupid);
  };

  const goToPreviousRecord = () => {
    const currentIndex = getCurrentRecordIndex();
    if (currentIndex > 0) {
      const previousGroup = filteredGroups[currentIndex - 1];
      navigateToEdit(previousGroup.groupid);
    }
  };

  const goToNextRecord = () => {
    const currentIndex = getCurrentRecordIndex();
    if (currentIndex < filteredGroups.length - 1) {
      const nextGroup = filteredGroups[currentIndex + 1];
      navigateToEdit(nextGroup.groupid);
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
          basePath="/groups" 
          currentPage="Groups" 
          itemName={showForm ? (isNewMode ? "New Group" : `Edit Group: ${formData.GroupName}`) : null}
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
                {!editingGroup && (
                  <button
                    type="button"
                    disabled={!canSave}
                    className={`px-3 py-2 text-sm border rounded ${
                      canSave ? "" : "opacity-50 cursor-not-allowed"
                    }`}
                    onClick={() =>
                      handleSubmit({ preventDefault: () => {} }, { addAnother: true })
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
                  onClick={() => handleSubmit({ preventDefault: () => {} })}
                  className={`px-4 py-2 text-sm rounded text-white ${
                    canSave
                      ? "bg-purple-600 hover:bg-purple-700"
                      : "bg-purple-400 cursor-not-allowed opacity-60"
                  }`}
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
            {showForm && editingGroup && filteredGroups.length > 1 && (
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
                  Record {getCurrentRecordIndex() + 1} / {filteredGroups.length}
                </span>
                <button
                  type="button"
                  onClick={goToNextRecord}
                  disabled={getCurrentRecordIndex() === filteredGroups.length - 1}
                  className={`p-1 rounded ${
                    getCurrentRecordIndex() === filteredGroups.length - 1
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
          <h1 className="text-xl font-semibold">Master Groups</h1>
        </div>

        {/* Table OR Form */}
        {!showForm ? (
          <div className="border rounded-lg shadow-sm overflow-auto max-h-[70vh]">
            <table className="w-full border-collapse">
              <thead className="bg-gray-100 text-left sticky top-0 z-10">
                <tr>
                  <th className="p-3 border-b">Group Name</th>
                  <th className="p-3 border-b text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentRecords.map((group) => (
                  <tr
                    key={group.groupid}
                    onClick={() => handleDoubleClick(group)}
                    className="cursor-pointer hover:bg-indigo-50 transition-colors"
                    title="Click to edit group"
                  >
                    <td className="px-2 py-1 border-b">{group.groupname}</td>
                    <td className="px-2 py-1 border-b text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent row click event
                          handleDelete(group.groupid);
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
                      No Groups Found
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
                {editingGroup ? "Group / Edit" : "Group / New"}
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
                    <label className="col-span-4 text-sm text-gray-700">Group ID</label>
                    <input
                      type="text"
                      value={formData.GroupID}
                      readOnly
                      className="col-span-8 border rounded px-3 py-2 text-sm bg-gray-100 cursor-not-allowed"
                    />
                  </div>
                  <div className="grid grid-cols-12 items-center gap-x-3">
                    <label className="col-span-4 text-sm text-gray-700">Group Name</label>
                    <input
                      key={isNewMode ? 'new' : `edit-${id}`}
                      type="text"
                      value={formData.GroupName || ""}
                      onChange={(e) => setFormData({ ...formData, GroupName: e.target.value })}
                      className="col-span-8 border rounded px-3 py-2 text-sm"
                      required
                      placeholder="Enter group name"
                      autoFocus={isNewMode}
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
