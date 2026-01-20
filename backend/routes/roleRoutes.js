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

// Get all roles
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        role_id,
        role_name,
        role_description,
        is_active,
        created_date,
        edited_date
      FROM sec_roles 
      ORDER BY created_date DESC
    `);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching roles:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get role by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      SELECT 
        role_id,
        role_name,
        role_description,
        is_active,
        created_date,
        edited_date
      FROM sec_roles 
      WHERE role_id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Role not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching role:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create new role
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { role_name, role_description, is_active } = req.body;
    
    // Validation
    if (!role_name || !role_name.trim()) {
      return res.status(400).json({ message: 'Role name is required' });
    }

    // Check if role name already exists
    const existingRole = await pool.query(
      'SELECT role_name FROM sec_roles WHERE role_name = $1',
      [role_name.trim()]
    );

    if (existingRole.rows.length > 0) {
      return res.status(400).json({ message: 'Role name already exists' });
    }

    // Create role
    const result = await pool.query(`
      INSERT INTO sec_roles (role_name, role_description, is_active)
      VALUES ($1, $2, $3)
      RETURNING role_id, role_name, role_description, is_active, created_date
    `, [
      role_name.trim(),
      role_description ? role_description.trim() : null,
      is_active !== undefined ? is_active : true
    ]);

    res.status(201).json({
      message: 'Role created successfully',
      role: result.rows[0]
    });

  } catch (err) {
    console.error('Error creating role:', err);
    if (err.code === '23505') { // Unique constraint violation
      res.status(400).json({ message: 'Role name already exists' });
    } else {
      res.status(500).json({ message: 'Internal server error' });
    }
  }
});

// Update role
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { role_name, role_description, is_active } = req.body;
    
    // Validation
    if (!role_name || !role_name.trim()) {
      return res.status(400).json({ message: 'Role name is required' });
    }

    // Check if role exists
    const existingRole = await pool.query(
      'SELECT role_id FROM sec_roles WHERE role_id = $1',
      [id]
    );

    if (existingRole.rows.length === 0) {
      return res.status(404).json({ message: 'Role not found' });
    }

    // Check if role name is taken by another role
    const roleNameCheck = await pool.query(
      'SELECT role_id FROM sec_roles WHERE role_name = $1 AND role_id != $2',
      [role_name.trim(), id]
    );

    if (roleNameCheck.rows.length > 0) {
      return res.status(400).json({ message: 'Role name already exists' });
    }

    // Update role
    const result = await pool.query(`
      UPDATE sec_roles 
      SET role_name = $1, role_description = $2, is_active = $3, edited_date = now()
      WHERE role_id = $4
      RETURNING role_id, role_name, role_description, is_active, edited_date
    `, [
      role_name.trim(),
      role_description ? role_description.trim() : null,
      is_active !== undefined ? is_active : true,
      id
    ]);

    res.json({
      message: 'Role updated successfully',
      role: result.rows[0]
    });

  } catch (err) {
    console.error('Error updating role:', err);
    if (err.code === '23505') { // Unique constraint violation
      res.status(400).json({ message: 'Role name already exists' });
    } else {
      res.status(500).json({ message: 'Internal server error' });
    }
  }
});

// Delete role
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if role exists
    const existingRole = await pool.query(
      'SELECT role_id, role_name FROM sec_roles WHERE role_id = $1',
      [id]
    );

    if (existingRole.rows.length === 0) {
      return res.status(404).json({ message: 'Role not found' });
    }

    // Check if role is being used by any users (if user_roles table exists)
    try {
      const roleUsage = await pool.query(
        'SELECT COUNT(*) as user_count FROM sec_user_roles WHERE role_id = $1',
        [id]
      );

      if (roleUsage.rows[0].user_count > 0) {
        return res.status(400).json({ 
          message: `Cannot delete role. It is assigned to ${roleUsage.rows[0].user_count} user(s)` 
        });
      }
    } catch (tableErr) {
      // If sec_user_roles table doesn't exist, continue with deletion
      console.log('sec_user_roles table not found, proceeding with role deletion');
    }

    // Delete role
    await pool.query('DELETE FROM sec_roles WHERE role_id = $1', [id]);

    res.json({ message: 'Role deleted successfully' });

  } catch (err) {
    console.error('Error deleting role:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;