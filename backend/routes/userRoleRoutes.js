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

// Get all users with their assigned roles
router.get('/users-with-roles', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.user_id,
        u.username,
        u.full_name,
        u.email,
        u.is_active,
        COALESCE(
          json_agg(
            json_build_object(
              'role_id', r.role_id,
              'role_name', r.role_name,
              'role_description', r.role_description
            ) ORDER BY r.role_name
          ) FILTER (WHERE r.role_id IS NOT NULL),
          '[]'
        ) as roles
      FROM sec_users u
      LEFT JOIN sec_user_roles ur ON u.user_id = ur.user_id
      LEFT JOIN sec_roles r ON ur.role_id = r.role_id AND r.is_active = true
      WHERE u.is_active = true
      GROUP BY u.user_id, u.username, u.full_name, u.email, u.is_active
      ORDER BY u.username
    `);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching users with roles:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get roles for a specific user
router.get('/user/:userId/roles', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const result = await pool.query(`
      SELECT 
        r.role_id,
        r.role_name,
        r.role_description,
        r.is_active,
        CASE WHEN ur.user_id IS NOT NULL THEN true ELSE false END as assigned
      FROM sec_roles r
      LEFT JOIN sec_user_roles ur ON r.role_id = ur.role_id AND ur.user_id = $1
      WHERE r.is_active = true
      ORDER BY r.role_name
    `, [userId]);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching user roles:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Assign roles to a user
router.post('/user/:userId/roles', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { userId } = req.params;
    const { roleIds } = req.body;
    
    if (!Array.isArray(roleIds)) {
      return res.status(400).json({ message: 'Role IDs must be an array' });
    }
    
    // Check if user exists
    const userCheck = await client.query(
      'SELECT user_id, username FROM sec_users WHERE user_id = $1',
      [userId]
    );
    
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    await client.query('BEGIN');
    
    // Remove all existing roles for this user
    await client.query(
      'DELETE FROM sec_user_roles WHERE user_id = $1',
      [userId]
    );
    
    // Add new roles
    if (roleIds.length > 0) {
      const values = roleIds.map((roleId, index) => 
        `($1, $${index + 2})`
      ).join(', ');
      
      const query = `
        INSERT INTO sec_user_roles (user_id, role_id)
        VALUES ${values}
        ON CONFLICT (user_id, role_id) DO NOTHING
      `;
      
      await client.query(query, [userId, ...roleIds]);
    }
    
    await client.query('COMMIT');
    
    res.json({
      message: `Roles updated successfully for user "${userCheck.rows[0].username}"`,
      assignedCount: roleIds.length
    });
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error assigning roles:', err);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    client.release();
  }
});

// Get user role assignment statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(DISTINCT u.user_id) as total_users,
        COUNT(DISTINCT ur.user_id) as users_with_roles,
        COUNT(DISTINCT r.role_id) as total_roles,
        COUNT(ur.user_id) as total_assignments
      FROM sec_users u
      LEFT JOIN sec_user_roles ur ON u.user_id = ur.user_id
      LEFT JOIN sec_roles r ON ur.role_id = r.role_id
      WHERE u.is_active = true
    `);
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get role assignment history for a user
router.get('/user/:userId/history', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const result = await pool.query(`
      SELECT 
        ur.role_id,
        r.role_name
      FROM sec_user_roles ur
      JOIN sec_roles r ON ur.role_id = r.role_id
      WHERE ur.user_id = $1
      ORDER BY r.role_name
    `, [userId]);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching role history:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get users by role
router.get('/role/:roleId/users', authenticateToken, async (req, res) => {
  try {
    const { roleId } = req.params;
    
    const result = await pool.query(`
      SELECT 
        u.user_id,
        u.username,
        u.full_name,
        u.email
      FROM sec_users u
      JOIN sec_user_roles ur ON u.user_id = ur.user_id
      WHERE ur.role_id = $1 AND u.is_active = true
      ORDER BY u.username
    `, [roleId]);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching users by role:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;