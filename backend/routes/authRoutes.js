const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');

const router = express.Router();

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(403).json({ message: 'No token provided' });

  jwt.verify(token, process.env.JWT_SECRET || 'your_secret_key', (err, decoded) => {
    if (err) return res.status(401).json({ message: 'Unauthorized' });
    req.userId = decoded.user_id;
    req.username = decoded.username;
    next();
  });
};

// Login Route - Using sec_users table
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    // Get user from sec_users table
    const user = await pool.query(
      'SELECT user_id, username, full_name, email, user_password, is_active FROM sec_users WHERE username = $1', 
      [username]
    );
    
    if (user.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const userData = user.rows[0];

    // Check if user is active
    if (!userData.is_active) {
      return res.status(401).json({ message: 'User account is inactive' });
    }

    // Verify password using bcrypt
    const validPassword = await bcrypt.compare(password, userData.user_password);
    if (!validPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Get user roles
    const rolesResult = await pool.query(`
      SELECT r.role_id, r.role_name 
      FROM sec_roles r
      JOIN sec_user_roles ur ON r.role_id = ur.role_id
      WHERE ur.user_id = $1 AND r.is_active = true
    `, [userData.user_id]);

    const roles = rolesResult.rows.map(r => r.role_name);
    const roleIds = rolesResult.rows.map(r => r.role_id);

    // Get user permissions
    const permissionsResult = await pool.query(`
      SELECT DISTINCT p.permission_code, p.module_name, p.form_name, p.action_name
      FROM sec_permissions p
      JOIN sec_role_permissions rp ON p.permission_id = rp.permission_id
      JOIN sec_user_roles ur ON rp.role_id = ur.role_id
      WHERE ur.user_id = $1 AND p.is_active = true
      ORDER BY p.module_name, p.form_name, p.action_name
    `, [userData.user_id]);

    const permissions = permissionsResult.rows.map(p => p.permission_code);

    // Create JWT token
    const token = jwt.sign(
      { 
        user_id: userData.user_id,
        username: userData.username,
        roles: roles,
        permissions: permissions
      }, 
      process.env.JWT_SECRET || 'your_secret_key', 
      { expiresIn: '8h' }
    );
    
    res.json({ 
      token,
      user: {
        user_id: userData.user_id,
        username: userData.username,
        full_name: userData.full_name,
        email: userData.email,
        role: roles[0] || null, // Primary role for backwards compatibility
        roles: roles,
        roleIds: roleIds,
        permissions: permissions
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get current user info
router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await pool.query(
      'SELECT user_id, username, full_name, email, is_active FROM sec_users WHERE user_id = $1',
      [req.userId]
    );
    
    if (user.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get user roles
    const rolesResult = await pool.query(`
      SELECT r.role_id, r.role_name, r.role_description
      FROM sec_roles r
      JOIN sec_user_roles ur ON r.role_id = ur.role_id
      WHERE ur.user_id = $1 AND r.is_active = true
    `, [req.userId]);
    
    // Get user permissions (from all their roles)
    const permissionsResult = await pool.query(`
      SELECT DISTINCT p.permission_code
      FROM sec_permissions p
      JOIN sec_role_permissions rp ON p.permission_id = rp.permission_id
      JOIN sec_user_roles ur ON rp.role_id = ur.role_id
      WHERE ur.user_id = $1 AND p.is_active = true
    `, [req.userId]);
    
    res.json({ 
      user: {
        ...user.rows[0],
        role: rolesResult.rows[0]?.role_name || null, // Primary role for backwards compatibility
        roles: rolesResult.rows,
        permissions: permissionsResult.rows.map(row => row.permission_code)
      }
    });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Change password
router.post('/change-password', verifyToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  
  try {
    // Get current user
    const user = await pool.query(
      'SELECT user_password FROM sec_users WHERE user_id = $1',
      [req.userId]
    );
    
    if (user.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Verify current password
    const validPassword = await bcrypt.compare(currentPassword, user.rows[0].user_password);
    if (!validPassword) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password
    await pool.query(
      'UPDATE sec_users SET user_password = $1, edited_date = now() WHERE user_id = $2',
      [hashedPassword, req.userId]
    );
    
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Logout (client-side token removal, but we can log it)
router.post('/logout', verifyToken, async (req, res) => {
  try {
    // You can add logout logging here if needed
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
module.exports.verifyToken = verifyToken;
