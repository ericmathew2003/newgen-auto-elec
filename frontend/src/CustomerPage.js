import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { usePageNavigation, Breadcrumb } from "./components/NavigationHelper";
import API_BASE_URL from "config/api";

export default function CustomerPage() {
  const { id, isNewMode, isEditMode, showForm, navigateToList, navigateToNew, navigateToEdit } = usePageNavigation('/customers');
  
  // Data and UI state
  const [parties, setParties] = useState([]);
  const [editingParty, setEditingParty] = useState(null);
  const [formData, setFormData] = useState({
    PartyID: "",
    PartyType: "1", // Customer type fixed to 1
    PartyName: "",
    ContactNo: "",
    Address1: "",
    Address2: "",
    AccountID: "5", // Default account ID for customers
    GSTNum: "",
  });
  const [initialFormData, setInitialFormData] = useState({
    PartyID: "",
    PartyType: "1",
    PartyName: "",
    ContactNo: "",
    Address1: "",
    Address2: "",
    AccountID: "5",
    GSTNum: "",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage] = useState(50);
  const [accounts, setAccounts] = useState([]);
  const idInputRef = useRef(null);
  const nameInputRef = useRef(null);

  // Toast notification state
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // Helper function to get account name (now comes from joined data)
  const getAccountName = (party) => {
    // Use account name from joined query if available
    if (party.account_name) {
      return party.account_name;
    }
    
    // Fallback to lookup in accounts array
    if (!party.accountid) return '-';
    if (!accounts.length) return 'Loading...';
    
    const account = accounts.find(acc => acc.account_id === parseInt(party.accountid));
    return account ? account.account_name : `ID: ${party.accountid}`;
  };

  // Toast notification helper
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'success' });
    }, 3000);
  };

  // API: fetch all parties
  const fetchParties = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/party/all`);
      setParties(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  // API: fetch all accounts from acc_mas_account table
  const fetchAccounts = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/acc-mas-account/all`);
      setAccounts(res.data || []);
    } catch (err) {
      console.error("Error fetching accounts:", err);
      setAccounts([]);
    }
  };

  useEffect(() => {
    fetchParties();
    fetchAccounts();
  }, []);

  // Initialize form data for new mode immediately
  useEffect(() => {
    if (isNewMode) {
      setEditingParty(null);
      setFormData({
        PartyID: "",
        PartyType: "1",
        PartyName: "",
        ContactNo: "",
        Address1: "",
        Address2: "",
        AccountID: "5",
        GSTNum: "",
      });
      setInitialFormData({
        PartyID: "",
        PartyType: "1",
        PartyName: "",
        ContactNo: "",
        Address1: "",
        Address2: "",
        AccountID: "5",
        GSTNum: "",
      });
    }
  }, [isNewMode]);

  // Handle edit mode - load customer data when ID is in URL
  useEffect(() => {
    if (isEditMode && id && parties.length > 0) {
      const customer = parties.find(p => p.partyid.toString() === id);
      if (customer) {
        setEditingParty(customer);
        setFormData({
          PartyID: customer.partyid,
          PartyType: customer.partytype || "1",
          PartyName: customer.partyname || "",
          ContactNo: customer.contactno || "",
          Address1: customer.address1 || "",
          Address2: customer.address2 || "",
          AccountID: customer.accountid || "5",
          GSTNum: customer.gstnum || "",
        });
        setInitialFormData({
          PartyID: String(customer.partyid ?? ""),
          PartyType: String(customer.partytype ?? "1"),
          PartyName: String(customer.partyname ?? ""),
          ContactNo: String(customer.contactno ?? ""),
          Address1: String(customer.address1 ?? ""),
          Address2: String(customer.address2 ?? ""),
          AccountID: String(customer.accountid ?? "5"),
          GSTNum: String(customer.gstnum ?? ""),
        });
      } else {
        // Customer not found, redirect to list
        navigateToList();
      }
    }
  }, [isEditMode, id, parties, navigateToList]);

  // Validate and submit (add/edit)
  const handleSubmit = async (e, { addAnother = false } = {}) => {
    e.preventDefault();

    // Party ID is auto-generated, no validation needed
    if (!String(formData.PartyName).trim()) {
      showToast("Party Name is required", 'error');
      return;
    }

    // Duplicate checks (only check name since ID is auto-generated)
    if (!editingParty) {
      const exists = parties.find(
        (p) => typeof p.partyname === "string" && p.partyname.toLowerCase() === formData.PartyName.toLowerCase()
      );
      if (exists) {
        showToast("Party with same name already exists!", 'error');
        return;
      }
    } else {
      const exists = parties.find(
        (p) =>
          typeof p.partyname === "string" && 
          p.partyname.toLowerCase() === formData.PartyName.toLowerCase() &&
          p.partyid !== editingParty.partyid
      );
      if (exists) {
        showToast("Party with same name already exists!", 'error');
        return;
      }
    }

    try {
      if (editingParty) {
        // PUT edit (PartyID in URL; body excludes PartyID per backend route)
        const { PartyID, ...rest } = formData;
        // Ensure customer type stays 1 on edit
        await axios.put(`http://localhost:5000/api/party/edit/${editingParty.partyid}`, { ...rest, PartyType: 1 });
        showToast("Customer updated successfully!", 'success');
      } else {
        // POST add - exclude PartyID since it's auto-generated, force customer type to 1
        const { PartyID, ...rest } = formData;
        await axios.post(`${API_BASE_URL}/api/party/add`, { ...rest, PartyType: 1 });
        showToast("Customer added successfully!", 'success');
      }

      await fetchParties();

      if (addAnother && !editingParty) {
        setFormData({
          PartyID: "",
          PartyType: "1",
          PartyName: "",
          ContactNo: "",
          Address1: "",
          Address2: "",
          AccountID: "5",
          GSTNum: "",
        });
        // Focus on Party Name since PartyID is auto-generated
        setTimeout(() => nameInputRef.current && nameInputRef.current.focus(), 0);
        return;
      }

      // Form stays open after successful save/update
      // Update the initial form data to reflect the current saved state
      setInitialFormData({ ...formData });
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.response?.data?.error || "Something went wrong!";
      showToast(errorMessage, 'error');
      console.error(err);
    }
  };

  // Delete
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this Customer?")) return;
    try {
      await axios.delete(`http://localhost:5000/api/party/delete/${id}`);
      showToast("Customer deleted successfully!", 'success');
      fetchParties();
    } catch (err) {
      console.error(err);
      const errorMessage = err.response?.data?.message || err.response?.data?.error || "Error deleting customer";
      showToast(errorMessage, 'error');
    }
  };

  // Click to edit
  const handleDoubleClick = (party) => {
    navigateToEdit(party.partyid);
  };

  // Reset initial form state when opening a new entry
  useEffect(() => {
    if (showForm && !editingParty) {
      setInitialFormData({
        PartyID: "",
        PartyType: "1",
        PartyName: "",
        ContactNo: "",
        Address1: "",
        Address2: "",
        AccountID: "5",
        GSTNum: "",
      });
      // Focus on Party Name field since PartyID is auto-generated
      setTimeout(() => nameInputRef.current && nameInputRef.current.focus(), 0);
    }
  }, [showForm, editingParty]);

  // Dirty check: enable Save when any field has changed
  const isDirty = Object.keys(formData).some((key) =>
    String(formData[key] ?? '').trim() !== String(initialFormData[key] ?? '').trim()
  );

  // Only require Party Name (PartyID is auto-generated)
  const hasRequiredValues = String(formData.PartyName ?? '').trim().length > 0;

  const canSave = isDirty && hasRequiredValues;

  // Filter + pagination (Customers only: PartyType = 1)
  const filteredParties = parties
    .filter((p) => parseInt(p.partytype ?? 0, 10) === 1)
    .filter((p) => {
      const id = (p.partyid ?? "").toString();
      const name = (p.partyname ?? "").toLowerCase();
      const q = searchTerm.toLowerCase();
      return id.includes(q) || name.includes(q);
    });

  const totalRecords = filteredParties.length;
  const totalPages = Math.ceil(totalRecords / recordsPerPage) || 1;
  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = startIndex + recordsPerPage;
  const currentRecords = filteredParties.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const goToPreviousPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };
  const goToNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  // Record navigation while editing
  const getCurrentRecordIndex = () => {
    if (!editingParty) return -1;
    return filteredParties.findIndex((p) => p.partyid === editingParty.partyid);
  };
  const goToPreviousRecord = () => {
    const currentIndex = getCurrentRecordIndex();
    if (currentIndex > 0) {
      const previousCustomer = filteredParties[currentIndex - 1];
      navigateToEdit(previousCustomer.partyid);
    }
  };
  const goToNextRecord = () => {
    const currentIndex = getCurrentRecordIndex();
    if (currentIndex < filteredParties.length - 1) {
      const nextCustomer = filteredParties[currentIndex + 1];
      navigateToEdit(nextCustomer.partyid);
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
      
      <div className="p-2">
        {/* Breadcrumb */}
        <Breadcrumb 
          basePath="/customers" 
          currentPage="Customers" 
          itemName={showForm ? (isNewMode ? "New Customer" : `Edit Customer: ${formData.PartyName}`) : null}
        />
        
        {/* Header with New, Search and Form Actions */}
        <div className="flex flex-col items-start mb-2">
          <div className="flex items-center justify-between w-full mb-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (showForm) return; // disable New while in form
                  navigateToNew();
                }}
                disabled={showForm}
                className={`px-4 py-2 rounded-lg shadow text-white ${
                  showForm ? "bg-purple-400 cursor-not-allowed opacity-60" : "bg-purple-600 hover:bg-purple-700"
                }`}
              >
                New
              </button>

              {/* Search bar in table mode */}
              {!showForm && (
                <input
                  type="text"
                  placeholder="Search by ID or Name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="px-3 py-2 border rounded-md text-sm w-72"
                />
              )}

              {showForm && (
                <>
                  {!editingParty && (
                    <button
                      type="button"
                      disabled={!canSave}
                      className={`px-3 py-2 text-sm border rounded ${
                        canSave ? "" : "opacity-50 cursor-not-allowed"
                      }`}
                      onClick={(e) => {
                        e.preventDefault();
                        handleSubmit(e, { addAnother: true });
                      }}
                    >
                      Save & Add Another
                    </button>
                  )}
                  <button
                    type="button"
                    className="px-3 py-2 text-sm border rounded"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      navigateToList();
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!canSave}
                    onClick={(e) => {
                      e.preventDefault();
                      handleSubmit(e);
                    }}
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

            {/* Pagination summary in table mode */}
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
                    currentPage === totalPages
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

            {/* Record navigation while editing */}
            {showForm && editingParty && filteredParties.length > 1 && (
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
                    <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
                  </svg>
                </button>
                <span className="font-medium">
                  Record {getCurrentRecordIndex() + 1} / {filteredParties.length}
                </span>
                <button
                  type="button"
                  onClick={goToNextRecord}
                  disabled={getCurrentRecordIndex() === filteredParties.length - 1}
                  className={`p-1 rounded ${
                    getCurrentRecordIndex() === filteredParties.length - 1
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
          <h1 className="text-xl font-semibold">Master Customers</h1>
        </div>

        {/* Table or Full-Page Form */}
        {!showForm ? (
          <div className="border rounded-lg shadow-sm overflow-auto max-h-[70vh]">
            <table className="w-full border-collapse min-w-[900px]">
              <thead className="bg-gray-100 text-left sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-1 border-b">ID</th>
                  <th className="px-3 py-1 border-b w-[40ch]">Name</th>
                  <th className="px-3 py-1 border-b">Contact</th>
                  <th className="px-3 py-1 border-b">Address 1</th>
                  <th className="px-3 py-1 border-b">Account</th>
                  <th className="px-3 py-1 border-b">GST</th>
                  <th className="px-3 py-1 border-b text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentRecords.map((p) => (
                  <tr
                    key={p.partyid}
                    onClick={() => handleDoubleClick(p)}
                    className="cursor-pointer hover:bg-indigo-50 transition-colors whitespace-nowrap"
                    title="Click to edit customer"
                  >
                    <td className="px-3 py-1 border-b">{p.partyid}</td>
                    <td className="px-3 py-1 border-b truncate max-w-[40ch]">{p.partyname}</td>
                    <td className="px-3 py-1 border-b">{p.contactno || "-"}</td>
                    <td className="px-3 py-1 border-b truncate">{p.address1 || "-"}</td>
                    <td className="px-3 py-1 border-b">{getAccountName(p)}</td>
                    <td className="px-3 py-1 border-b">{p.gstnum || "-"}</td>
                    <td className="px-3 py-1 border-b text-right">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent row click event
                          handleDelete(p.partyid);
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
                    <td colSpan="7" className="text-center p-3">
                      No Customers Found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <form onSubmit={(e) => handleSubmit(e)} className="bg-white p-4 rounded-lg shadow space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-gray-600">Party ID</label>
                <input
                  ref={idInputRef}
                  type="text"
                  value={editingParty ? formData.PartyID : "Auto-generated"}
                  onChange={() => {}} // No-op since it's always read-only
                  readOnly={true}
                  className="mt-1 w-full px-3 py-2 border rounded bg-gray-100 text-gray-600"
                  title={editingParty ? "Party ID cannot be changed" : "Party ID will be auto-generated when saving"}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm text-gray-600">Party Name</label>
                <input
                  ref={nameInputRef}
                  type="text"
                  value={formData.PartyName}
                  onChange={(e) => setFormData({ ...formData, PartyName: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600">Contact No</label>
                <input
                  type="text"
                  value={formData.ContactNo}
                  onChange={(e) => setFormData({ ...formData, ContactNo: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border rounded"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm text-gray-600">Address 1</label>
                <input
                  type="text"
                  value={formData.Address1}
                  onChange={(e) => setFormData({ ...formData, Address1: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600">Address 2</label>
                <input
                  type="text"
                  value={formData.Address2}
                  onChange={(e) => setFormData({ ...formData, Address2: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border rounded"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600">Account</label>
                <select
                  value={formData.AccountID}
                  onChange={(e) => setFormData({ ...formData, AccountID: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border rounded"
                >
                  <option value="">Select Account</option>
                  {accounts.length === 0 && (
                    <option value="" disabled>Loading accounts...</option>
                  )}
                  {accounts.map((account) => (
                    <option key={account.account_id} value={account.account_id}>
                      {account.account_name} ({account.account_code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-600">GST Number</label>
                <input
                  type="text"
                  value={formData.GSTNum}
                  onChange={(e) => setFormData({ ...formData, GSTNum: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border rounded"
                />
              </div>
            </div>

            {/* Form action buttons duplicate for convenience */}
            <div className="flex items-center gap-2">

              {/* Record navigation in edit mode */}
              {editingParty && filteredParties.length > 1 && (
                <div className="ml-auto flex items-center gap-2 text-sm text-gray-600">
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
                      <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
                    </svg>
                  </button>
                  <span className="font-medium">
                    Record {getCurrentRecordIndex() + 1} / {filteredParties.length}
                  </span>
                  <button
                    type="button"
                    onClick={goToNextRecord}
                    disabled={getCurrentRecordIndex() === filteredParties.length - 1}
                    className={`p-1 rounded ${
                      getCurrentRecordIndex() === filteredParties.length - 1
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
          </form>
        )}
      </div>
    </div>
  );
}