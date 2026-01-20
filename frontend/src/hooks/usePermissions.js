import { useAuth } from '../contexts/AuthContext';

/**
 * Custom hook to check user permissions
 */
export const usePermissions = () => {
  const { user } = useAuth();

  // Check if user is admin - admins have all permissions
  // Support multiple admin role names
  const isAdmin = user?.role === 'ADMIN' || 
                  user?.role === 'Super Admin' || 
                  user?.role === 'Administrator' ||
                  user?.roles?.some(r => 
                    r.role_name === 'ADMIN' || 
                    r.role_name === 'Super Admin' || 
                    r.role_name === 'Administrator'
                  );

  /**
   * Check if user has a specific permission
   * @param {string} permissionCode - The permission code to check
   * @returns {boolean}
   */
  const hasPermission = (permissionCode) => {
    // Admins have all permissions
    if (isAdmin) return true;
    
    if (!user || !user.permissions) {
      return false;
    }
    return user.permissions.includes(permissionCode);
  };

  /**
   * Check if user has ANY of the specified permissions
   * @param {string[]} permissionCodes - Array of permission codes
   * @returns {boolean}
   */
  const hasAnyPermission = (permissionCodes) => {
    // Admins have all permissions
    if (isAdmin) return true;
    
    if (!user || !user.permissions) {
      return false;
    }
    return permissionCodes.some(code => user.permissions.includes(code));
  };

  /**
   * Check if user has ALL of the specified permissions
   * @param {string[]} permissionCodes - Array of permission codes
   * @returns {boolean}
   */
  const hasAllPermissions = (permissionCodes) => {
    // Admins have all permissions
    if (isAdmin) return true;
    
    if (!user || !user.permissions) {
      return false;
    }
    return permissionCodes.every(code => user.permissions.includes(code));
  };

  /**
   * Check if user has a specific role
   * @param {string} roleName - The role name to check
   * @returns {boolean}
   */
  const hasRole = (roleName) => {
    if (!user || !user.roles) {
      return false;
    }
    return user.roles.includes(roleName);
  };

  /**
   * Check if user can view a module/form
   * @param {string} module - Module name (e.g., 'ACCOUNTS')
   * @param {string} form - Form name (e.g., 'GROUP_MASTER')
   * @returns {boolean}
   */
  const canView = (module, form) => {
    // Admins can view everything
    if (isAdmin) return true;
    
    const permissionCode = `${module}_${form}_VIEW`;
    return hasPermission(permissionCode);
  };

  /**
   * Check if user can create/add in a module/form
   * @param {string} module - Module name
   * @param {string} form - Form name
   * @returns {boolean}
   */
  const canCreate = (module, form) => {
    // Admins can create everything
    if (isAdmin) return true;
    
    // Try both CREATE and ADD for backwards compatibility
    const createPermission = `${module}_${form}_CREATE`;
    const addPermission = `${module}_${form}_ADD`;
    return hasPermission(createPermission) || hasPermission(addPermission);
  };

  /**
   * Check if user can edit in a module/form
   * @param {string} module - Module name
   * @param {string} form - Form name
   * @returns {boolean}
   */
  const canEdit = (module, form) => {
    // Admins can edit everything
    if (isAdmin) return true;
    
    const permissionCode = `${module}_${form}_EDIT`;
    return hasPermission(permissionCode);
  };

  /**
   * Check if user can delete in a module/form
   * @param {string} module - Module name
   * @param {string} form - Form name
   * @returns {boolean}
   */
  const canDelete = (module, form) => {
    // Admins can delete everything
    if (isAdmin) return true;
    
    const permissionCode = `${module}_${form}_DELETE`;
    return hasPermission(permissionCode);
  };

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    canView,
    canCreate,
    canEdit,
    canDelete,
    permissions: user?.permissions || [],
    roles: user?.roles || [],
    isAdmin
  };
};

export default usePermissions;