const pool = require('../db');

/**
 * Middleware to check if user has required permission
 * @param {string} permissionCode - The permission code to check (e.g., 'ACCOUNTS_GROUP_MASTER_VIEW')
 */
const checkPermission = (permissionCode) => {
  return async (req, res, next) => {
    try {
      // Get user_id from JWT token (set by authenticateToken middleware)
      const userId = req.user?.user_id || req.userId;

      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      // Check if user has the required permission through their roles
      const result = await pool.query(`
        SELECT COUNT(*) as has_permission
        FROM sec_permissions p
        JOIN sec_role_permissions rp ON p.permission_id = rp.permission_id
        JOIN sec_user_roles ur ON rp.role_id = ur.role_id
        WHERE ur.user_id = $1 
          AND p.permission_code = $2
          AND p.is_active = true
      `, [userId, permissionCode]);

      if (result.rows[0].has_permission > 0) {
        // User has permission, proceed
        next();
      } else {
        return res.status(403).json({ 
          message: 'Access denied. You do not have permission to perform this action.',
          requiredPermission: permissionCode
        });
      }
    } catch (err) {
      console.error('Permission check error:', err);
      return res.status(500).json({ message: 'Error checking permissions' });
    }
  };
};

/**
 * Middleware to check if user has ANY of the required permissions
 * @param {string[]} permissionCodes - Array of permission codes
 */
const checkAnyPermission = (permissionCodes) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.user_id || req.userId;

      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      // Build placeholders for the IN clause
      const placeholders = permissionCodes.map((_, index) => `$${index + 2}`).join(', ');

      const result = await pool.query(`
        SELECT COUNT(*) as has_permission
        FROM sec_permissions p
        JOIN sec_role_permissions rp ON p.permission_id = rp.permission_id
        JOIN sec_user_roles ur ON rp.role_id = ur.role_id
        WHERE ur.user_id = $1 
          AND p.permission_code IN (${placeholders})
          AND p.is_active = true
      `, [userId, ...permissionCodes]);

      if (result.rows[0].has_permission > 0) {
        next();
      } else {
        return res.status(403).json({ 
          message: 'Access denied. You do not have permission to perform this action.',
          requiredPermissions: permissionCodes
        });
      }
    } catch (err) {
      console.error('Permission check error:', err);
      return res.status(500).json({ message: 'Error checking permissions' });
    }
  };
};

/**
 * Get all permissions for a user (useful for frontend)
 */
const getUserPermissions = async (userId) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT p.permission_code
      FROM sec_permissions p
      JOIN sec_role_permissions rp ON p.permission_id = rp.permission_id
      JOIN sec_user_roles ur ON rp.role_id = ur.role_id
      WHERE ur.user_id = $1 AND p.is_active = true
    `, [userId]);

    return result.rows.map(row => row.permission_code);
  } catch (err) {
    console.error('Error getting user permissions:', err);
    return [];
  }
};

module.exports = {
  checkPermission,
  checkAnyPermission,
  getUserPermissions
};