import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { 
  Pagination, SearchBar, DataTable, FormWrapper, PageHeader, Notice,
  usePagination, useNotice, useFormState 
} from './components';

export default function GroupPage() {
  const [groups, setGroups] = useState([]);
  const groupNameRef = useRef(null);
  
  // Custom hooks for state management
  const { notice, showNotice, closeNotice } = useNotice();
  const { formData, setFormData, showForm, editingItem, isDirty, startEditing: originalStartEditing, startAdding, closeForm } = useFormState({
    GroupID: "",
    GroupName: ""
  });

  // Override startEditing to properly map database fields to form fields
  const startEditing = (group) => {
    const mappedData = {
      GroupID: group.groupid,
      GroupName: group.groupname
    };
    originalStartEditing(mappedData);
  };

  // Search and pagination
  const {
    currentPage,
    setCurrentPage,
    searchTerm,
    setSearchTerm
  } = usePagination(groups);

  const filteredGroups = groups.filter(
    (g) =>
      g.groupid.toString().includes(searchTerm.toLowerCase()) ||
      g.groupname.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate pagination for filtered results
  const totalRecords = filteredGroups.length;
  const totalPages = Math.ceil(totalRecords / 50);
  const startIndex = (currentPage - 1) * 50;
  const endIndex = startIndex + 50;
  const currentRecords = filteredGroups.slice(startIndex, endIndex);

  // Fetch groups
  const fetchGroups = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/groups/all");
      setGroups(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  // Validation and submission
  const canSave = isDirty && formData.GroupName.trim();

  const handleSubmit = async (e, { addAnother = false } = {}) => {
    e.preventDefault();

    if (!formData.GroupName.trim()) {
      showNotice('error', 'Group Name is required');
      return;
    }

    if (!editingItem && !formData.GroupID) {
      showNotice('error', 'Group ID is required');
      return;
    }

    // Duplicate check
    if (!editingItem) {
      const exists = groups.find(
        (g) => g.groupname.toLowerCase() === formData.GroupName.toLowerCase()
      );
      if (exists) {
        showNotice('error', '❌ Group Name already exists!');
        return;
      }
    } else {
      const exists = groups.find(
        (g) => g.groupname.toLowerCase() === formData.GroupName.toLowerCase() && g.groupid !== editingItem.groupid
      );
      if (exists) {
        showNotice('error', '❌ Group Name already exists!');
        return;
      }
    }

    try {
      if (editingItem) {
        await axios.put(
          `http://localhost:5000/api/groups/edit/${editingItem.groupid}`,
          { GroupName: formData.GroupName }
        );
        showNotice('success', 'Group updated successfully');
      } else {
        await axios.post("http://localhost:5000/api/groups/add", {
          GroupID: Number(formData.GroupID),
          GroupName: formData.GroupName,
        });
        showNotice('success', 'Group added successfully');
      }
      
      await fetchGroups();
      
      if (addAnother && !editingItem) {
        const nextId = groups.length ? Math.max(...groups.map(g => Number(g.groupid) || 0)) + 1 : 1;
        setFormData({ GroupID: String(nextId), GroupName: "" });
        setTimeout(() => groupNameRef.current && groupNameRef.current.focus(), 0);
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
    if (!window.confirm("Are you sure you want to delete this Group?")) return;
    try {
      await axios.delete(`http://localhost:5000/api/groups/delete/${id}`);
      await fetchGroups();
      showNotice('success', 'Group deleted');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Delete failed";
      showNotice('error', msg);
      console.error("Delete group error:", err);
    }
  };

  // Table columns configuration
  const columns = [
    { key: 'groupid', header: 'Group ID', hidden: true },
    { key: 'groupname', header: 'Group Name' },
    { 
      key: 'actions', 
      header: 'Actions', 
      align: 'right',
      render: (_, row) => (
        <button
          onClick={() => handleDelete(row.groupid)}
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
    return filteredGroups.findIndex(g => g.groupid === editingItem.GroupID);
  };

  const recordNavigation = {
    currentIndex: getCurrentRecordIndex(),
    totalRecords: filteredGroups.length,
    isFirst: getCurrentRecordIndex() === 0,
    isLast: getCurrentRecordIndex() === filteredGroups.length - 1,
    onPrevious: () => {
      const currentIndex = getCurrentRecordIndex();
      if (currentIndex > 0) {
        startEditing(filteredGroups[currentIndex - 1]);
      }
    },
    onNext: () => {
      const currentIndex = getCurrentRecordIndex();
      if (currentIndex < filteredGroups.length - 1) {
        startEditing(filteredGroups[currentIndex + 1]);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Notice notice={notice} onClose={closeNotice} />
      
      <div className="p-6">
        <PageHeader
          title="Master Groups"
          onNew={() => {
            const nextId = groups.length ? Math.max(...groups.map(g => Number(g.groupid) || 0)) + 1 : 1;
            startAdding();
            setFormData({ GroupID: String(nextId), GroupName: "" });
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
            emptyMessage="No Groups Found"
          />
        ) : (
          <FormWrapper
            title={editingItem ? "Group / Edit" : "Group / New"}
            onClose={closeForm}
            showRecordNavigation={!!editingItem && filteredGroups.length > 1}
            recordNavigation={recordNavigation}
          >
            <form onSubmit={(e) => handleSubmit(e)}>
              <div className="border rounded-md p-4 bg-gray-50">
                <div className="grid grid-cols-12 items-center gap-x-3">
                  <label className="col-span-4 text-sm text-gray-700">Group Name</label>
                  <input
                    type="text"
                    value={formData.GroupName}
                    onChange={(e) => setFormData({ ...formData, GroupName: e.target.value })}
                    ref={groupNameRef}
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