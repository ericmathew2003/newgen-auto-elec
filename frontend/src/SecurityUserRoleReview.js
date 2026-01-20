import React, { useState, useEffect } from 'react';
import { 
  FiUsers, 
  FiShield,
  FiCheck,
  FiX,
  FiSave,
  FiRefreshCw,
  FiAlertCircle,
  FiCheckCircle,
  FiUser,
  FiMail,
  FiClock,
  FiAward
} from 'react-icons/fi';
import API_BASE_URL from './config/api';

const SecurityUserRoleReview = () => {
  // State management
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [assignedRoles, setAssignedRoles] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState(null);

  // Fetch data on component mount
  useEffect(() => {
    fetchUsersWithRoles();
    fetchRoles();
    fetchStats();
  }, []);

  // Fetch user roles when selected user changes
  useEffect(() => {
    if (selectedUser) {
      fetchUserRoles(selectedUser.user_id);
    }
  }, [selectedUser]);

  // Auto-dismiss messages
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Fetch all users with their roles
  const fetchUsersWithRoles = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/user-roles/users-with-roles`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to fetch users');
      }
    } catch (err) {
      setError('Network error: Cannot connect to server');
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch all roles
  const fetchRoles = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/roles`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setRoles(data.filter(role => role.is_active));
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to fetch roles');
      }
    } catch (err) {
      setError('Network error: Cannot fetch roles');
      console.error('Error fetching roles:', err);
    }
  };

  // Fetch roles for a specific user
  const fetchUserRoles = async (userId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/user-roles/user/${userId}/roles`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const assigned = new Set(
          data
            .filter(r => r.assigned)
            .map(r => r.role_id)
        );
        setAssignedRoles(assigned);
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to fetch user roles');
      }
    } catch (err) {
      setError('Network error: Cannot fetch user roles');
      console.error('Error fetching user roles:', err);
    }
  };

  // Fetch statistics
  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/user-roles/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  // Handle user selection
  const handleUserSelect = (user) => {
    setSelectedUser(user);
    setError('');
    setSuccess('');
  };

  // Handle role toggle
  const handleRoleToggle = (roleId) => {
    const newAssigned = new Set(assignedRoles);
    if (newAssigned.has(roleId)) {
      newAssigned.delete(roleId);
    } else {
      newAssigned.add(roleId);
    }
    setAssignedRoles(newAssigned);
  };

  // Save role assignments
  const handleSave = async () => {
    if (!selectedUser) {
      setError('Please select a user first');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/user-roles/user/${selectedUser.user_id}/roles`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          roleIds: Array.from(assignedRoles)
        })
      });

      if (response.ok) {
        const result = await response.json();
        setSuccess(result.message || 'Roles updated successfully!');
        fetchUsersWithRoles(); // Refresh users list
        fetchStats(); // Refresh statistics
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to update roles');
      }
    } catch (err) {
      setError('Network error: Cannot save roles');
      console.error('Error saving roles:', err);
    } finally {
      setSaving(false);
    }
  };

  // Filter users based on search term
  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.full_name && user.full_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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
              <FiAward className="w-8 h-8 mr-3 text-red-600" />
              User Role Review
            </h1>
            <p className="text-gray-600 mt-2">Assign and review user role assignments</p>
          </div>
          <button
            onClick={handleSave}
            disabled={!selectedUser || saving}
            className="flex items-center space-x-2 px-6 py-3 bg-red-600 text-white font-semibold rounded-lg shadow-lg hover:bg-red-700 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <FiSave size={20} />
            )}
            <span>Save Roles</span>
          </button>
        </div>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total_users}</p>
              </div>
              <FiUsers className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Users with Roles</p>
                <p className="text-2xl font-bold text-gray-900">{stats.users_with_roles}</p>
              </div>
              <FiShield className="w-8 h-8 text-green-500" />
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Roles</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total_roles}</p>
              </div>
              <FiAward className="w-8 h-8 text-purple-500" />
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Assignments</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total_assignments}</p>
              </div>
              <FiCheck className="w-8 h-8 text-red-500" />
            </div>
          </div>
        </div>
      )}

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
        {/* Users List */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold flex items-center mb-3">
                <FiUsers className="w-5 h-5 mr-2 text-red-600" />
                Select User
              </h2>
              {/* Search */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
                <FiUsers className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
              </div>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {filteredUsers.map((user) => (
                <div
                  key={user.user_id}
                  onClick={() => handleUserSelect(user)}
                  className={`p-4 border-b cursor-pointer transition-colors ${
                    selectedUser?.user_id === user.user_id
                      ? 'bg-red-50 border-red-200'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">{user.username}</div>
                      {user.full_name && (
                        <div className="text-sm text-gray-500 truncate">{user.full_name}</div>
                      )}
                      <div className="flex items-center mt-2 space-x-1 flex-wrap">
                        {user.roles && user.roles.length > 0 ? (
                          user.roles.map((role) => (
                            <span
                              key={role.role_id}
                              className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded-full"
                            >
                              {role.role_name}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-gray-400 italic">No roles assigned</span>
                        )}
                      </div>
                    </div>
                    <div className="ml-2">
                      <FiUser 
                        size={16} 
                        className={selectedUser?.user_id === user.user_id ? 'text-red-600' : 'text-gray-400'} 
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Roles Assignment */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center">
                  <FiShield className="w-5 h-5 mr-2 text-red-600" />
                  Assign Roles
                  {selectedUser && (
                    <span className="ml-2 text-sm font-normal text-gray-500">
                      to {selectedUser.username}
                    </span>
                  )}
                </h2>
                {selectedUser && (
                  <div className="text-sm text-gray-500">
                    {assignedRoles.size} of {roles.length} roles assigned
                  </div>
                )}
              </div>
            </div>

            {!selectedUser ? (
              <div className="p-8 text-center text-gray-500">
                <FiAward size={48} className="mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">Select a user to assign roles</p>
                <p className="text-sm">Choose a user from the list to manage their role assignments</p>
              </div>
            ) : (
              <div className="p-6">
                {/* User Info */}
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                      <FiUser size={20} className="text-red-600" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{selectedUser.username}</div>
                      {selectedUser.full_name && (
                        <div className="text-sm text-gray-600">{selectedUser.full_name}</div>
                      )}
                      {selectedUser.email && (
                        <div className="flex items-center text-sm text-gray-500 mt-1">
                          <FiMail size={12} className="mr-1" />
                          {selectedUser.email}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Roles List */}
                <div className="space-y-3">
                  {roles.map((role) => (
                    <label
                      key={role.role_id}
                      className="flex items-start space-x-3 p-4 rounded-lg border hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={assignedRoles.has(role.role_id)}
                        onChange={() => handleRoleToggle(role.role_id)}
                        className="h-5 w-5 text-red-600 focus:ring-red-500 border-gray-300 rounded mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-gray-900">{role.role_name}</div>
                          {assignedRoles.has(role.role_id) && (
                            <FiCheck size={16} className="text-green-600" />
                          )}
                        </div>
                        {role.role_description && (
                          <div className="text-sm text-gray-500 mt-1">
                            {role.role_description}
                          </div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecurityUserRoleReview;