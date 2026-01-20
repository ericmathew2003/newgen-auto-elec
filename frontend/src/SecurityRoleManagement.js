import React, { useState, useEffect } from 'react';
import { 
  FiShield, 
  FiPlus, 
  FiEdit, 
  FiTrash2, 
  FiSearch, 
  FiSave,
  FiX,
  FiUsers,
  FiCalendar,
  FiAlertCircle,
  FiCheckCircle,
  FiFileText
} from 'react-icons/fi';
import API_BASE_URL from './config/api';

const SecurityRoleManagement = () => {
  // State management
  const [roles, setRoles] = useState([]);
  const [filteredRoles, setFilteredRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [formLoading, setFormLoading] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    role_name: '',
    role_description: '',
    is_active: true
  });

  // Fetch roles on component mount
  useEffect(() => {
    fetchRoles();
  }, []);

  // Filter roles when search term or roles change
  useEffect(() => {
    filterRoles();
  }, [roles, searchTerm]);

  // Auto-dismiss messages
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Fetch all roles
  const fetchRoles = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_BASE_URL}/api/roles`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setRoles(data);
        setError('');
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to fetch roles');
      }
    } catch (err) {
      setError('Network error: Cannot connect to server');
      console.error('Error fetching roles:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filter roles based on search term
  const filterRoles = () => {
    if (!searchTerm.trim()) {
      setFilteredRoles(roles);
      return;
    }

    const filtered = roles.filter(role =>
      role.role_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (role.role_description && role.role_description.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    setFilteredRoles(filtered);
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      role_name: '',
      role_description: '',
      is_active: true
    });
    setShowForm(false);
    setEditingRole(null);
    setError('');
    setSuccess('');
  };

  // Validate form data
  const validateForm = () => {
    if (!formData.role_name.trim()) {
      setError('Role name is required');
      return false;
    }

    if (formData.role_name.trim().length < 2) {
      setError('Role name must be at least 2 characters long');
      return false;
    }

    return true;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!validateForm()) {
      return;
    }

    setFormLoading(true);

    try {
      const token = localStorage.getItem('token');
      const url = editingRole 
        ? `${API_BASE_URL}/api/roles/${editingRole.role_id}` 
        : `${API_BASE_URL}/api/roles`;
      
      const method = editingRole ? 'PUT' : 'POST';

      const payload = {
        role_name: formData.role_name.trim(),
        role_description: formData.role_description.trim() || null,
        is_active: formData.is_active
      };

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const result = await response.json();
        setSuccess(result.message || `Role ${editingRole ? 'updated' : 'created'} successfully!`);
        resetForm();
        fetchRoles();
      } else {
        const errorData = await response.json();
        setError(errorData.message || `Failed to ${editingRole ? 'update' : 'create'} role`);
      }
    } catch (err) {
      setError('Network error: Cannot save role');
      console.error('Error saving role:', err);
    } finally {
      setFormLoading(false);
    }
  };

  // Handle edit role
  const handleEdit = (role) => {
    setFormData({
      role_name: role.role_name,
      role_description: role.role_description || '',
      is_active: role.is_active
    });
    setEditingRole(role);
    setShowForm(true);
    setError('');
    setSuccess('');
  };

  // Handle delete role
  const handleDelete = async (role) => {
    if (!window.confirm(`Are you sure you want to delete role "${role.role_name}"?\\n\\nThis action cannot be undone.`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/roles/${role.role_id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        setSuccess(result.message || 'Role deleted successfully');
        fetchRoles();
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to delete role');
      }
    } catch (err) {
      setError('Network error: Cannot delete role');
      console.error('Error deleting role:', err);
    }
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <FiShield className="w-8 h-8 mr-3 text-red-600" />
              Role Management
            </h1>
            <p className="text-gray-600 mt-2">Manage system roles and permissions</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center space-x-2 px-6 py-3 bg-red-600 text-white font-semibold rounded-lg shadow-lg hover:bg-red-700 transition duration-200"
          >
            <FiPlus size={20} />
            <span>Add Role</span>
          </button>
        </div>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-300 text-red-700 rounded-lg flex items-center">
          <FiAlertCircle size={20} className="mr-2 flex-shrink-0" />
          <span>{error}</span>
          <button
            onClick={() => setError('')}
            className="ml-auto text-red-500 hover:text-red-700"
          >
            <FiX size={16} />
          </button>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-100 border border-green-300 text-green-700 rounded-lg flex items-center">
          <FiCheckCircle size={20} className="mr-2 flex-shrink-0" />
          <span>{success}</span>
          <button
            onClick={() => setSuccess('')}
            className="ml-auto text-green-500 hover:text-green-700"
          >
            <FiX size={16} />
          </button>
        </div>
      )}

      {/* Role Form */}
      {showForm && (
        <div className="mb-8 bg-white p-6 rounded-lg shadow-lg border">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold flex items-center">
              <FiShield className="w-5 h-5 mr-2 text-red-600" />
              {editingRole ? 'Edit Role' : 'Add New Role'}
            </h2>
            <button
              onClick={resetForm}
              className="text-gray-400 hover:text-gray-600"
            >
              <FiX size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Role Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Role Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="role_name"
                  value={formData.role_name}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Enter role name"
                  required
                />
              </div>

              {/* Active Status */}
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                />
                <label className="text-sm font-medium text-gray-700">Active Role</label>
              </div>
            </div>

            {/* Role Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Role Description
              </label>
              <textarea
                name="role_description"
                value={formData.role_description}
                onChange={handleInputChange}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="Enter role description (optional)"
              />
            </div>

            {/* Form Actions */}
            <div className="flex justify-end space-x-4 pt-6 border-t">
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-2 text-gray-600 hover:text-gray-800 font-medium"
                disabled={formLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={formLoading}
                className="flex items-center space-x-2 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition duration-200 disabled:opacity-50"
              >
                {formLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <FiSave size={16} />
                )}
                <span>{editingRole ? 'Update Role' : 'Create Role'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search */}
      <div className="mb-6 bg-white p-4 rounded-lg shadow-sm border">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search roles by name or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Roles Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredRoles.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                    <FiShield size={48} className="mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-medium">No roles found</p>
                    <p className="text-sm">
                      {searchTerm
                        ? 'Try adjusting your search criteria'
                        : 'Click "Add Role" to create your first role'
                      }
                    </p>
                  </td>
                </tr>
              ) : (
                filteredRoles.map((role) => (
                  <tr key={role.role_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mr-3">
                          <FiShield size={16} className="text-red-600" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{role.role_name}</div>
                          <div className="text-sm text-gray-500">Role ID: {role.role_id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-start text-sm text-gray-900">
                        <FiFileText size={14} className="mr-2 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div className="max-w-xs">
                          {role.role_description ? (
                            <p className="line-clamp-2">{role.role_description}</p>
                          ) : (
                            <span className="text-gray-500 italic">No description</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        role.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {role.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center text-sm text-gray-900">
                        <FiCalendar size={14} className="mr-2 text-gray-400" />
                        {formatDate(role.created_date)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleEdit(role)}
                          className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                          title="Edit Role"
                        >
                          <FiEdit size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(role)}
                          className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                          title="Delete Role"
                        >
                          <FiTrash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      {filteredRoles.length > 0 && (
        <div className="mt-4 text-sm text-gray-500 text-center">
          Showing {filteredRoles.length} of {roles.length} roles
        </div>
      )}
    </div>
  );
};

export default SecurityRoleManagement;