import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { 
  Pagination, SearchBar, DataTable, FormWrapper, PageHeader, Notice,
  usePagination, useNotice, useFormState 
} from './components';

export default function SupplierPage() {
  const [parties, setParties] = useState([]);
  const idInputRef = useRef(null);
  
  // Custom hooks for state management
  const { notice, showNotice, closeNotice } = useNotice();
  const { formData, setFormData, initialFormData, showForm, editingItem, isDirty, startEditing: originalStartEditing, startAdding, closeForm } = useFormState({
    PartyID: "",
    PartyCode: "",
    PartyType: "2",
    PartyName: "",
    ContactNo: "",
    Address1: "",
    Address2: "",
    AccountID: "",
    GSTNum: "",
  });

  // Override startEditing to properly map database fields to form fields
  const startEditing = (party) => {
    const mappedData = {
      PartyID: party.partyid,
      PartyCode: String(party.partycode ?? ""),
      PartyType: party.partytype?.toString() || "2",
      PartyName: party.partyname ?? "",
      ContactNo: party.contactno ?? "",
      Address1: party.address1 ?? "",
      Address2: party.address2 ?? "",
      AccountID: party.accountid?.toString() || "",
      GSTNum: party.gstnum ?? "",
    };
    originalStartEditing(mappedData);
  };

  // Search and pagination
  const {
    currentPage,
    setCurrentPage,
    searchTerm,
    setSearchTerm
  } = usePagination(parties);

  const filteredParties = parties.filter(
    (p) =>
      p.partyid.toString().includes(searchTerm.toLowerCase()) ||
      p.partycode.toString().includes(searchTerm.toLowerCase()) ||
      p.partyname.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate pagination for filtered results
  const totalRecords = filteredParties.length;
  const totalPages = Math.ceil(totalRecords / 50);
  const startIndex = (currentPage - 1) * 50;
  const endIndex = startIndex + 50;
  const currentRecords = filteredParties.slice(startIndex, endIndex);

  // API: fetch all parties (suppliers)
  const fetchParties = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/party/all");
      const all = Array.isArray(res.data) ? res.data : [];
      const suppliers = all.filter(p => String(p.partytype ?? '').toString() === '2');
      setParties(suppliers);
    } catch (err) {
      console.error('Error fetching parties:', err);
    }
  };

  useEffect(() => {
    fetchParties();
  }, []);

  // Validation and submission
  const canSave = isDirty && formData.PartyName.trim();

  const handleSubmit = async (e, { addAnother = false } = {}) => {
    e.preventDefault();

    if (!formData.PartyName.trim()) {
      showNotice('error', 'Party Name is required');
      return;
    }

    if (!editingItem && !formData.PartyCode.trim()) {
      showNotice('error', 'Party Code is required');
      return;
    }

    // Duplicate check
    if (!editingItem) {
      const exists = parties.find(
        (p) =>
          String(p.partycode ?? '').toLowerCase() === String(formData.PartyCode ?? '').toLowerCase() ||
          String(p.partyname ?? '').toLowerCase() === String(formData.PartyName ?? '').toLowerCase()
      );
      if (exists) {
        showNotice('error', '❌ Party Code or Name already exists!');
        return;
      }
    } else {
      const exists = parties.find((p) => {
        if (p.partyid === editingItem.PartyID) return false; // exclude current record
        const codeChanged = String(formData.PartyCode ?? '').trim().toLowerCase() !== String(initialFormData.PartyCode ?? '').trim().toLowerCase();
        const nameChanged = String(formData.PartyName ?? '').trim().toLowerCase() !== String(initialFormData.PartyName ?? '').trim().toLowerCase();
        const codeDup = codeChanged && String(p.partycode ?? '').trim().toLowerCase() === String(formData.PartyCode ?? '').trim().toLowerCase();
        const nameDup = nameChanged && String(p.partyname ?? '').trim().toLowerCase() === String(formData.PartyName ?? '').trim().toLowerCase();
        return codeDup || nameDup;
      });
      if (exists) {
        showNotice('error', '❌ Party Code or Name already exists!');
        return;
      }
    }

    try {
      if (editingItem) {
        const { PartyID, ...rest } = formData;
        await axios.put(`http://localhost:5000/api/party/edit/${editingItem.PartyID}`, { ...rest, PartyType: 2 });
        showNotice('success', 'Supplier updated successfully');
      } else {
        await axios.post("http://localhost:5000/api/party/add", { ...formData, PartyType: 2 });
        showNotice('success', 'Supplier added successfully');
      }
      
      await fetchParties();
      
      if (addAnother && !editingItem) {
        setFormData({
          PartyID: "",
          PartyCode: "",
          PartyType: "2",
          PartyName: "",
          ContactNo: "",
          Address1: "",
          Address2: "",
          AccountID: "",
          GSTNum: "",
        });
        setTimeout(() => idInputRef.current && idInputRef.current.focus(), 0);
        return;
      }
      
      closeForm();
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || "Something went wrong!";
      showNotice('error', msg);
      console.error(err);
    }
  };

  // Delete handler
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this Supplier?")) return;
    try {
      await axios.delete(`http://localhost:5000/api/party/delete/${id}`);
      await fetchParties();
      showNotice('success', 'Supplier deleted');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Delete failed";
      showNotice('error', msg);
      console.error("Delete supplier error:", err);
    }
  };

  // Table columns configuration
  const columns = [
    { key: 'partyid', header: 'ID', hidden: true },
    { key: 'partycode', header: 'Code' },
    { key: 'partyname', header: 'Name' },
    { key: 'contactno', header: 'Contact' },
    { key: 'address1', header: 'Address' },
    { key: 'gstnum', header: 'GST' },
    { 
      key: 'actions', 
      header: 'Actions', 
      align: 'right',
      render: (_, row) => (
        <button
          onClick={() => handleDelete(row.partyid)}
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
    return filteredParties.findIndex(p => p.partyid === editingItem.PartyID);
  };

  const recordNavigation = {
    currentIndex: getCurrentRecordIndex(),
    totalRecords: filteredParties.length,
    isFirst: getCurrentRecordIndex() === 0,
    isLast: getCurrentRecordIndex() === filteredParties.length - 1,
    onPrevious: () => {
      const currentIndex = getCurrentRecordIndex();
      if (currentIndex > 0) {
        startEditing(filteredParties[currentIndex - 1]);
      }
    },
    onNext: () => {
      const currentIndex = getCurrentRecordIndex();
      if (currentIndex < filteredParties.length - 1) {
        startEditing(filteredParties[currentIndex + 1]);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Notice notice={notice} onClose={closeNotice} />
      
      <div className="p-6">
        <PageHeader
          title="Master Suppliers"
          onNew={() => {
            startAdding();
            setFormData({
              PartyID: "",
              PartyCode: "",
              PartyType: "2",
              PartyName: "",
              ContactNo: "",
              Address1: "",
              Address2: "",
              AccountID: "",
              GSTNum: "",
            });
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
                placeholder="Search suppliers..."
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
            emptyMessage="No Suppliers Found"
          />
        ) : (
          <FormWrapper
            title={editingItem ? "Supplier / Edit" : "Supplier / New"}
            onClose={closeForm}
            showRecordNavigation={!!editingItem && filteredParties.length > 1}
            recordNavigation={recordNavigation}
          >
            <form onSubmit={(e) => handleSubmit(e)}>
              <div className="border rounded-md p-4 bg-gray-50 space-y-4">
                <div className="grid grid-cols-12 items-center gap-x-3">
                  <label className="col-span-4 text-sm text-gray-700">Party Code</label>
                  <input
                    type="text"
                    value={formData.PartyCode}
                    onChange={(e) => setFormData({ ...formData, PartyCode: e.target.value })}
                    ref={idInputRef}
                    className="col-span-8 border rounded px-3 py-2 text-sm"
                    required
                  />
                </div>
                
                <div className="grid grid-cols-12 items-center gap-x-3">
                  <label className="col-span-4 text-sm text-gray-700">Party Name</label>
                  <input
                    type="text"
                    value={formData.PartyName}
                    onChange={(e) => setFormData({ ...formData, PartyName: e.target.value })}
                    className="col-span-8 border rounded px-3 py-2 text-sm"
                    required
                  />
                </div>
                
                <div className="grid grid-cols-12 items-center gap-x-3">
                  <label className="col-span-4 text-sm text-gray-700">Contact No</label>
                  <input
                    type="text"
                    value={formData.ContactNo}
                    onChange={(e) => setFormData({ ...formData, ContactNo: e.target.value })}
                    className="col-span-8 border rounded px-3 py-2 text-sm"
                  />
                </div>
                
                <div className="grid grid-cols-12 items-center gap-x-3">
                  <label className="col-span-4 text-sm text-gray-700">Address 1</label>
                  <input
                    type="text"
                    value={formData.Address1}
                    onChange={(e) => setFormData({ ...formData, Address1: e.target.value })}
                    className="col-span-8 border rounded px-3 py-2 text-sm"
                  />
                </div>
                
                <div className="grid grid-cols-12 items-center gap-x-3">
                  <label className="col-span-4 text-sm text-gray-700">Address 2</label>
                  <input
                    type="text"
                    value={formData.Address2}
                    onChange={(e) => setFormData({ ...formData, Address2: e.target.value })}
                    className="col-span-8 border rounded px-3 py-2 text-sm"
                  />
                </div>
                
                <div className="grid grid-cols-12 items-center gap-x-3">
                  <label className="col-span-4 text-sm text-gray-700">GST Number</label>
                  <input
                    type="text"
                    value={formData.GSTNum}
                    onChange={(e) => setFormData({ ...formData, GSTNum: e.target.value })}
                    className="col-span-8 border rounded px-3 py-2 text-sm"
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