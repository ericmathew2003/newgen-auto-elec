const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../db');

const router = express.Router();

// Middleware to authenticate JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your_secret_key', (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

// Get all permissions grouped by module and form
router.get('/permissions', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        permission_id,
        module_name,
        form_name,
        action_name,
        permission_code,
        is_active
      FROM sec_permissions 
      WHERE is_active = true
      ORDER BY module_name, form_name, action_name
    `);
    
    // Group permissions by module and form
    const groupedPermissions = {};
    result.rows.forEach(permission => {
      const { module_name, form_name } = permission;
      
      if (!groupedPermissions[module_name]) {
        groupedPermissions[module_name] = {};
      }
      
      if (!groupedPermissions[module_name][form_name]) {
        groupedPermissions[module_name][form_name] = [];
      }
      
      groupedPermissions[module_name][form_name].push(permission);
    });
    
    res.json({
      permissions: result.rows,
      groupedPermissions
    });
  } catch (err) {
    console.error('Error fetching permissions:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get permissions for a specific role
router.get('/role/:roleId/permissions', authenticateToken, async (req, res) => {
  try {
    const { roleId } = req.params;
    
    const result = await pool.query(`
      SELECT 
        p.permission_id,
        p.module_name,
        p.form_name,
        p.action_name,
        p.permission_code,
        CASE WHEN rp.role_id IS NOT NULL THEN true ELSE false END as assigned
      FROM sec_permissions p
      LEFT JOIN sec_role_permissions rp ON p.permission_id = rp.permission_id AND rp.role_id = $1
      WHERE p.is_active = true
      ORDER BY p.module_name, p.form_name, p.action_name
    `, [roleId]);
    
    // Group permissions by module and form
    const groupedPermissions = {};
    result.rows.forEach(permission => {
      const { module_name, form_name } = permission;
      
      if (!groupedPermissions[module_name]) {
        groupedPermissions[module_name] = {};
      }
      
      if (!groupedPermissions[module_name][form_name]) {
        groupedPermissions[module_name][form_name] = [];
      }
      
      groupedPermissions[module_name][form_name].push(permission);
    });
    
    res.json({
      permissions: result.rows,
      groupedPermissions
    });
  } catch (err) {
    console.error('Error fetching role permissions:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Assign permissions to a role
router.post('/role/:roleId/permissions', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { roleId } = req.params;
    const { permissionIds } = req.body;
    
    if (!Array.isArray(permissionIds)) {
      return res.status(400).json({ message: 'Permission IDs must be an array' });
    }
    
    // Check if role exists
    const roleCheck = await client.query(
      'SELECT role_id, role_name FROM sec_roles WHERE role_id = $1',
      [roleId]
    );
    
    if (roleCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Role not found' });
    }
    
    await client.query('BEGIN');
    
    // Remove all existing permissions for this role
    await client.query(
      'DELETE FROM sec_role_permissions WHERE role_id = $1',
      [roleId]
    );
    
    // Add new permissions
    if (permissionIds.length > 0) {
      const values = permissionIds.map((permissionId, index) => 
        `($1, $${index + 2})`
      ).join(', ');
      
      const query = `
        INSERT INTO sec_role_permissions (role_id, permission_id)
        VALUES ${values}
        ON CONFLICT (role_id, permission_id) DO NOTHING
      `;
      
      await client.query(query, [roleId, ...permissionIds]);
    }
    
    await client.query('COMMIT');
    
    res.json({
      message: `Permissions updated successfully for role "${roleCheck.rows[0].role_name}"`,
      assignedCount: permissionIds.length
    });
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error assigning permissions:', err);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    client.release();
  }
});

// Get all roles with their permission counts
router.get('/roles-summary', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        r.role_id,
        r.role_name,
        r.role_description,
        r.is_active,
        COUNT(rp.permission_id) as permission_count
      FROM sec_roles r
      LEFT JOIN sec_role_permissions rp ON r.role_id = rp.role_id
      WHERE r.is_active = true
      GROUP BY r.role_id, r.role_name, r.role_description, r.is_active
      ORDER BY r.role_name
    `);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching roles summary:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get permission usage statistics
router.get('/permissions/stats', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.permission_id,
        p.module_name,
        p.form_name,
        p.action_name,
        p.permission_code,
        COUNT(rp.role_id) as assigned_to_roles
      FROM sec_permissions p
      LEFT JOIN sec_role_permissions rp ON p.permission_id = rp.permission_id
      WHERE p.is_active = true
      GROUP BY p.permission_id, p.module_name, p.form_name, p.action_name, p.permission_code
      ORDER BY p.module_name, p.form_name, p.action_name
    `);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching permission stats:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Bulk assign permissions to multiple roles
router.post('/bulk-assign', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { assignments } = req.body; // Array of { roleId, permissionIds }
    
    if (!Array.isArray(assignments)) {
      return res.status(400).json({ message: 'Assignments must be an array' });
    }
    
    await client.query('BEGIN');
    
    let totalAssigned = 0;
    
    for (const assignment of assignments) {
      const { roleId, permissionIds } = assignment;
      
      if (!Array.isArray(permissionIds)) {
        continue;
      }
      
      // Remove existing permissions for this role
      await client.query(
        'DELETE FROM sec_role_permissions WHERE role_id = $1',
        [roleId]
      );
      
      // Add new permissions
      if (permissionIds.length > 0) {
        const values = permissionIds.map((permissionId, index) => 
          `($1, $${index + 2})`
        ).join(', ');
        
        const query = `
          INSERT INTO sec_role_permissions (role_id, permission_id)
          VALUES ${values}
          ON CONFLICT (role_id, permission_id) DO NOTHING
        `;
        
        await client.query(query, [roleId, ...permissionIds]);
        totalAssigned += permissionIds.length;
      }
    }
    
    await client.query('COMMIT');
    
    res.json({
      message: `Bulk permission assignment completed`,
      rolesUpdated: assignments.length,
      totalPermissionsAssigned: totalAssigned
    });
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error in bulk assignment:', err);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    client.release();
  }
});

module.exports = router;