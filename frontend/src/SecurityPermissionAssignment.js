import React, { useState, useEffect } from 'react';
import { 
  FiShield, 
  FiUsers,
  FiCheck,
  FiX,
  FiSave,
  FiRefreshCw,
  FiAlertCircle,
  FiCheckCircle,
  FiChevronDown,
  FiChevronRight,
  FiLock,
  FiUnlock,
  FiSearch
} from 'react-icons/fi';
import API_BASE_URL from './config/api';

const SecurityPermissionAssignment = () => {
  // State management
  const [roles, setRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [groupedPermissions, setGroupedPermissions] = useState({});
  const [filteredGroupedPermissions, setFilteredGroupedPermissions] = useState({});
  const [assignedPermissions, setAssignedPermissions] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [expandedModules, setExpandedModules] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  // Filter permissions based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredGroupedPermissions(groupedPermissions);
      return;
    }

    const filtered = {};
    const searchLower = searchTerm.toLowerCase();

    Object.entries(groupedPermissions).forEach(([moduleName, forms]) => {
      const filteredForms = {};
      let hasMatchingPermissions = false;

      Object.entries(forms).forEach(([formName, formPermissions]) => {
        const matchingPermissions = formPermissions.filter(permission => 
          permission.action_name.toLowerCase().includes(searchLower) ||
          permission.permission_code.toLowerCase().includes(searchLower) ||
          moduleName.toLowerCase().includes(searchLower) ||
          formName.toLowerCase().includes(searchLower)
        );

        if (matchingPermissions.length > 0) {
          filteredForms[formName] = matchingPermissions;
          hasMatchingPermissions = true;
        }
      });

      if (hasMatchingPermissions) {
        filtered[moduleName] = filteredForms;
      }
    });

    setFilteredGroupedPermissions(filtered);
    
    // Auto-expand modules that have matching permissions
    if (searchTerm.trim()) {
      setExpandedModules(new Set(Object.keys(filtered)));
    }
  }, [searchTerm, groupedPermissions]);

  // Fetch roles and permissions on component mount
  useEffect(() => {
    fetchRoles();
    fetchPermissions();
  }, []);

  // Fetch role permissions when selected role changes
  useEffect(() => {
    if (selectedRole) {
      fetchRolePermissions(selectedRole.role_id);
    }
  }, [selectedRole]);

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
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/role-permissions/roles-summary`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setRoles(data);
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to fetch roles');
      }
    } catch (err) {
      setError('Network error: Cannot connect to server');
      console.error('Error fetching roles:', err);
    }
  };

  // Fetch all permissions
  const fetchPermissions = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/role-permissions/permissions`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPermissions(data.permissions);
        setGroupedPermissions(data.groupedPermissions);
        
        // Expand all modules by default
        setExpandedModules(new Set(Object.keys(data.groupedPermissions)));
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to fetch permissions');
      }
    } catch (err) {
      setError('Network error: Cannot connect to server');
      console.error('Error fetching permissions:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch permissions for a specific role
  const fetchRolePermissions = async (roleId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/role-permissions/role/${roleId}/permissions`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const assigned = new Set(
          data.permissions
            .filter(p => p.assigned)
            .map(p => p.permission_id)
        );
        setAssignedPermissions(assigned);
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to fetch role permissions');
      }
    } catch (err) {
      setError('Network error: Cannot fetch role permissions');
      console.error('Error fetching role permissions:', err);
    }
  };

  // Handle role selection
  const handleRoleSelect = (role) => {
    setSelectedRole(role);
    setError('');
    setSuccess('');
  };

  // Handle permission toggle
  const handlePermissionToggle = (permissionId) => {
    const newAssigned = new Set(assignedPermissions);
    if (newAssigned.has(permissionId)) {
      newAssigned.delete(permissionId);
    } else {
      newAssigned.add(permissionId);
    }
    setAssignedPermissions(newAssigned);
  };

  // Handle module toggle (select/deselect all permissions in module)
  const handleModuleToggle = (moduleName) => {
    const modulePermissions = Object.values(groupedPermissions[moduleName] || {})
      .flat()
      .map(p => p.permission_id);
    
    const allAssigned = modulePermissions.every(id => assignedPermissions.has(id));
    const newAssigned = new Set(assignedPermissions);
    
    if (allAssigned) {
      // Remove all module permissions
      modulePermissions.forEach(id => newAssigned.delete(id));
    } else {
      // Add all module permissions
      modulePermissions.forEach(id => newAssigned.add(id));
    }
    
    setAssignedPermissions(newAssigned);
  };

  // Handle form toggle (select/deselect all permissions in form)
  const handleFormToggle = (moduleName, formName) => {
    const formPermissions = (groupedPermissions[moduleName]?.[formName] || [])
      .map(p => p.permission_id);
    
    const allAssigned = formPermissions.every(id => assignedPermissions.has(id));
    const newAssigned = new Set(assignedPermissions);
    
    if (allAssigned) {
      // Remove all form permissions
      formPermissions.forEach(id => newAssigned.delete(id));
    } else {
      // Add all form permissions
      formPermissions.forEach(id => newAssigned.add(id));
    }
    
    setAssignedPermissions(newAssigned);
  };

  // Toggle module expansion
  const toggleModuleExpansion = (moduleName) => {
    const newExpanded = new Set(expandedModules);
    if (newExpanded.has(moduleName)) {
      newExpanded.delete(moduleName);
    } else {
      newExpanded.add(moduleName);
    }
    setExpandedModules(newExpanded);
  };

  // Save permissions
  const handleSave = async () => {
    if (!selectedRole) {
      setError('Please select a role first');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/role-permissions/role/${selectedRole.role_id}/permissions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          permissionIds: Array.from(assignedPermissions)
        })
      });

      if (response.ok) {
        const result = await response.json();
        setSuccess(result.message || 'Permissions updated successfully!');
        fetchRoles(); // Refresh roles to update permission counts
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to update permissions');
      }
    } catch (err) {
      setError('Network error: Cannot save permissions');
      console.error('Error saving permissions:', err);
    } finally {
      setSaving(false);
    }
  };

  // Get module permission stats
  const getModuleStats = (moduleName) => {
    const modulePermissions = Object.values(filteredGroupedPermissions[moduleName] || {}).flat();
    const assignedCount = modulePermissions.filter(p => assignedPermissions.has(p.permission_id)).length;
    return { total: modulePermissions.length, assigned: assignedCount };
  };

  // Get form permission stats
  const getFormStats = (moduleName, formName) => {
    const formPermissions = filteredGroupedPermissions[moduleName]?.[formName] || [];
    const assignedCount = formPermissions.filter(p => assignedPermissions.has(p.permission_id)).length;
    return { total: formPermissions.length, assigned: assignedCount };
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
              <FiLock className="w-8 h-8 mr-3 text-red-600" />
              Permission Assignment
            </h1>
            <p className="text-gray-600 mt-2">Assign permissions to roles for access control</p>
          </div>
          <button
            onClick={handleSave}
            disabled={!selectedRole || saving}
            className="flex items-center space-x-2 px-6 py-3 bg-red-600 text-white font-semibold rounded-lg shadow-lg hover:bg-red-700 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <FiSave size={20} />
            )}
            <span>Save Permissions</span>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Roles List */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold flex items-center">
                <FiUsers className="w-5 h-5 mr-2 text-red-600" />
                Select Role
              </h2>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {roles.map((role) => (
                <div
                  key={role.role_id}
                  onClick={() => handleRoleSelect(role)}
                  className={`p-4 border-b cursor-pointer transition-colors ${
                    selectedRole?.role_id === role.role_id
                      ? 'bg-red-50 border-red-200'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900">{role.role_name}</div>
                      <div className="text-sm text-gray-500">
                        {role.permission_count} permissions assigned
                      </div>
                    </div>
                    <div className="flex items-center">
                      <FiShield 
                        size={16} 
                        className={selectedRole?.role_id === role.role_id ? 'text-red-600' : 'text-gray-400'} 
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Permissions List */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center">
                  <FiLock className="w-5 h-5 mr-2 text-red-600" />
                  Permissions
                  {selectedRole && (
                    <span className="ml-2 text-sm font-normal text-gray-500">
                      for {selectedRole.role_name}
                    </span>
                  )}
                </h2>
                {selectedRole && (
                  <div className="text-sm text-gray-500">
                    {assignedPermissions.size} of {permissions.length} permissions assigned
                  </div>
                )}
              </div>
            </div>

            {!selectedRole ? (
              <div className="p-8 text-center text-gray-500">
                <FiUnlock size={48} className="mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">Select a role to manage permissions</p>
                <p className="text-sm">Choose a role from the list to assign or revoke permissions</p>
              </div>
            ) : (
              <div>
                {/* Search Box */}
                <div className="p-4 border-b bg-gray-50">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search permissions by name, code, module, or form..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    />
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <FiSearch className="h-5 w-5 text-gray-400" />
                    </div>
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      >
                        <FiX className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                      </button>
                    )}
                  </div>
                  {searchTerm && (
                    <div className="mt-2 text-sm text-gray-600">
                      Showing permissions matching "{searchTerm}"
                      {Object.keys(filteredGroupedPermissions).length === 0 && (
                        <span className="text-red-600 ml-2">- No matches found</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Permissions List */}
                <div className="max-h-96 overflow-y-auto">
                {Object.entries(filteredGroupedPermissions).map(([moduleName, forms]) => {
                  const moduleStats = getModuleStats(moduleName);
                  const isExpanded = expandedModules.has(moduleName);
                  
                  return (
                    <div key={moduleName} className="border-b">
                      {/* Module Header */}
                      <div className="p-4 bg-gray-50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <button
                              onClick={() => toggleModuleExpansion(moduleName)}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              {isExpanded ? <FiChevronDown size={16} /> : <FiChevronRight size={16} />}
                            </button>
                            <h3 className="font-medium text-gray-900">{moduleName}</h3>
                            <span className="text-sm text-gray-500">
                              ({moduleStats.assigned}/{moduleStats.total})
                            </span>
                          </div>
                          <button
                            onClick={() => handleModuleToggle(moduleName)}
                            className={`px-3 py-1 text-xs rounded-full transition-colors ${
                              moduleStats.assigned === moduleStats.total
                                ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                            }`}
                          >
                            {moduleStats.assigned === moduleStats.total ? 'Deselect All' : 'Select All'}
                          </button>
                        </div>
                      </div>

                      {/* Forms and Permissions */}
                      {isExpanded && (
                        <div className="divide-y">
                          {Object.entries(forms).map(([formName, formPermissions]) => {
                            const formStats = getFormStats(moduleName, formName);
                            
                            return (
                              <div key={formName} className="p-4">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center space-x-2">
                                    <h4 className="font-medium text-gray-800">{formName}</h4>
                                    <span className="text-sm text-gray-500">
                                      ({formStats.assigned}/{formStats.total})
                                    </span>
                                  </div>
                                  <button
                                    onClick={() => handleFormToggle(moduleName, formName)}
                                    className={`px-2 py-1 text-xs rounded transition-colors ${
                                      formStats.assigned === formStats.total
                                        ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                  >
                                    {formStats.assigned === formStats.total ? 'Deselect' : 'Select All'}
                                  </button>
                                </div>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {formPermissions.map((permission) => (
                                    <label
                                      key={permission.permission_id}
                                      className="flex items-center space-x-3 p-2 rounded hover:bg-gray-50 cursor-pointer"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={assignedPermissions.has(permission.permission_id)}
                                        onChange={() => handlePermissionToggle(permission.permission_id)}
                                        className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                                      />
                                      <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-gray-900">
                                          {permission.action_name}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                          {permission.permission_code}
                                        </div>
                                      </div>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecurityPermissionAssignment;