import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { 
  Pagination, SearchBar, DataTable, FormWrapper, PageHeader, Notice,
  usePagination, useNotice, useFormState 
} from './components';

export default function MakePage() {
  const [makes, setMakes] = useState([]);
  const makeNameRef = useRef(null);
  
  // Custom hooks for state management
  const { notice, showNotice, closeNotice } = useNotice();
  const { formData, setFormData, showForm, editingItem, isDirty, startEditing: originalStartEditing, startAdding, closeForm } = useFormState({
    MakeID: "",
    MakeName: ""
  });

  // Override startEditing to properly map database fields to form fields
  const startEditing = (make) => {
    const mappedData = {
      MakeID: make.makeid,
      MakeName: make.makename
    };
    originalStartEditing(mappedData);
  };

  // Search and pagination
  const {
    currentPage,
    setCurrentPage,
    searchTerm,
    setSearchTerm
  } = usePagination(makes);

  const filteredMakes = makes.filter(
    (m) =>
      m.makeid.toString().includes(searchTerm.toLowerCase()) ||
      m.makename.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate pagination for filtered results
  const totalRecords = filteredMakes.length;
  const totalPages = Math.ceil(totalRecords / 50);
  const startIndex = (currentPage - 1) * 50;
  const endIndex = startIndex + 50;
  const currentRecords = filteredMakes.slice(startIndex, endIndex);

  // Fetch makes
  const fetchMakes = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/makes/all");
      setMakes(res.data);
    } catch (err) {
      console.error("Error fetching makes:", err);
    }
  };

  useEffect(() => {
    fetchMakes();
  }, []);

  // Validation and submission
  const canSave = isDirty && formData.MakeName.trim();

  const handleSubmit = async (e, { addAnother = false } = {}) => {
    e.preventDefault();

    if (!formData.MakeName.trim()) {
      showNotice('error', 'Make Name is required');
      return;
    }

    // If adding, MakeID is auto-derived in onNew; do not block save if it's present or computed
    if (!editingItem && !String(formData.MakeID ?? '').trim()) {
      showNotice('error', 'Make ID is required');
      return;
    }

    // Duplicate check
    if (!editingItem) {
      const exists = makes.find(
        (m) =>
          m.makeid === parseInt(formData.MakeID) ||
          m.makename.toLowerCase() === formData.MakeName.toLowerCase()
      );
      if (exists) {
        showNotice('error', '❌ Make ID or Name already exists!');
        return;
      }
    } else {
      const exists = makes.find(
        (m) =>
          (m.makeid === parseInt(formData.MakeID) ||
            m.makename.toLowerCase() === formData.MakeName.toLowerCase()) &&
          m.makeid !== editingItem.makeid
      );
      if (exists) {
        showNotice('error', '❌ Make ID or Name already exists!');
        return;
      }
    }

    try {
      if (editingItem) {
        await axios.put(
          `http://localhost:5000/api/makes/edit/${editingItem.makeid}`,
          { MakeName: formData.MakeName }
        );
        showNotice('success', 'Make updated successfully');
      } else {
        await axios.post("http://localhost:5000/api/makes/add", {
          MakeID: Number(formData.MakeID),
          MakeName: formData.MakeName,
        });
        showNotice('success', 'Make added successfully');
      }
      
      await fetchMakes();
      
      if (addAnother && !editingItem) {
        const nextId = makes.length ? Math.max(...makes.map(m => Number(m.makeid) || 0)) + 1 : 1;
        setFormData({ MakeID: String(nextId), MakeName: "" });
        setTimeout(() => makeNameRef.current && makeNameRef.current.focus(), 0);
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
    if (!window.confirm("Are you sure you want to delete this Make?")) return;
    try {
      await axios.delete(`http://localhost:5000/api/makes/delete/${id}`);
      await fetchMakes();
      showNotice('success', 'Make deleted');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Delete failed";
      showNotice('error', msg);
      console.error("Delete make error:", err);
    }
  };

  // Table columns configuration
  const columns = [
    { key: 'makeid', header: 'Make ID', hidden: true },
    { key: 'makename', header: 'Make Name' },
    { 
      key: 'actions', 
      header: 'Actions', 
      align: 'right',
      render: (_, row) => (
        <button
          onClick={() => handleDelete(row.makeid)}
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
    return filteredMakes.findIndex(m => m.makeid === editingItem.MakeID);
  };

  const recordNavigation = {
    currentIndex: getCurrentRecordIndex(),
    totalRecords: filteredMakes.length,
    isFirst: getCurrentRecordIndex() === 0,
    isLast: getCurrentRecordIndex() === filteredMakes.length - 1,
    onPrevious: () => {
      const currentIndex = getCurrentRecordIndex();
      if (currentIndex > 0) {
        startEditing(filteredMakes[currentIndex - 1]);
      }
    },
    onNext: () => {
      const currentIndex = getCurrentRecordIndex();
      if (currentIndex < filteredMakes.length - 1) {
        startEditing(filteredMakes[currentIndex + 1]);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Notice notice={notice} onClose={closeNotice} />
      
      <div className="p-6">
        <PageHeader
          title="Master Makes"
          onNew={() => {
            const nextId = makes.length ? Math.max(...makes.map(m => Number(m.makeid) || 0)) + 1 : 1;
            startAdding();
            setFormData({ MakeID: String(nextId), MakeName: "" });
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
            emptyMessage="No Makes Found"
          />
        ) : (
          <FormWrapper
            title={editingItem ? "Make / Edit" : "Make / New"}
            onClose={closeForm}
            showRecordNavigation={!!editingItem && filteredMakes.length > 1}
            recordNavigation={recordNavigation}
          >
            <form onSubmit={(e) => handleSubmit(e)}>
              <div className="border rounded-md p-4 bg-gray-50">
                <div className="grid grid-cols-12 items-center gap-x-3">
                  <label className="col-span-4 text-sm text-gray-700">Make Name</label>
                  <input
                    type="text"
                    value={formData.MakeName}
                    onChange={(e) => setFormData({ ...formData, MakeName: e.target.value })}
                    ref={makeNameRef}
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