import { useState, useEffect, useRef } from 'react';

const useFormState = (initialData, isEditing = false) => {
  // Keep a stable template of the initial data across renders
  const templateRef = useRef(initialData);

  const [formData, setFormData] = useState(templateRef.current);
  const [initialFormData, setInitialFormData] = useState(templateRef.current);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // If parent passes a changed initialData object later, update template once when not showing form
  useEffect(() => {
    if (!showForm && !editingItem) {
      templateRef.current = initialData;
    }
  }, [initialData, showForm, editingItem]);

  // Do not auto-reset on showForm; startAdding handles resets explicitly to avoid clobbering preset values (e.g., auto IDs)

  const startEditing = (item) => {
    setEditingItem(item);
    setFormData(item);
    setInitialFormData(item);
    setShowForm(true);
  };

  const startAdding = () => {
    setEditingItem(null);
    setFormData(templateRef.current);
    setInitialFormData(templateRef.current);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingItem(null);
    setFormData(templateRef.current);
    setInitialFormData(templateRef.current);
  };

  const isDirty = JSON.stringify(formData) !== JSON.stringify(initialFormData);

  return {
    formData,
    setFormData,
    initialFormData,
    showForm,
    editingItem,
    isDirty,
    startEditing,
    startAdding,
    closeForm
  };
};

export default useFormState;

