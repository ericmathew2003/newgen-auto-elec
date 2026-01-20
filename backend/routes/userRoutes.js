const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
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

// Get all users
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        user_id,
        username,
        full_name,
        email,
        is_active,
        created_date,
        edited_date
      FROM sec_users 
      ORDER BY created_date DESC
    `);

    // Fetch roles for each user
    const usersWithRoles = await Promise.all(
      result.rows.map(async (user) => {
        const rolesResult = await pool.query(`
          SELECT r.role_id, r.role_name
          FROM sec_roles r
          JOIN sec_user_roles ur ON r.role_id = ur.role_id
          WHERE ur.user_id = $1 AND r.is_active = true
          ORDER BY r.role_name
        `, [user.user_id]);
        
        return {
          ...user,
          roles: rolesResult.rows
        };
      })
    );

    res.json(usersWithRoles);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get user by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT 
        user_id,
        username,
        full_name,
        email,
        is_active,
        created_date,
        edited_date
      FROM sec_users 
      WHERE user_id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create new user
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { username, full_name, email, user_password, password, is_active, role_ids } = req.body;
    
    // Accept either user_password or password field
    const userPassword = user_password || password;

    // Validation
    if (!username || !userPassword) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    if (userPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    // Check if username already exists
    const existingUser = await pool.query(
      'SELECT username FROM sec_users WHERE username = $1',
      [username.trim()]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    // Check if email already exists (if provided)
    if (email && email.trim()) {
      const existingEmail = await pool.query(
        'SELECT email FROM sec_users WHERE email = $1',
        [email.trim()]
      );

      if (existingEmail.rows.length > 0) {
        return res.status(400).json({ message: 'Email already exists' });
      }
    }

    // Create user with encrypted password
    const hashedPassword = await bcrypt.hash(userPassword, 10);

    const result = await pool.query(`
      INSERT INTO sec_users (username, full_name, email, user_password, is_active)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING user_id, username, full_name, email, is_active, created_date
    `, [
      username.trim(),
      full_name ? full_name.trim() : null,
      email ? email.trim() : null,
      hashedPassword,
      is_active !== undefined ? is_active : true
    ]);

    const newUserId = result.rows[0].user_id;

    // Assign roles if provided
    if (role_ids && Array.isArray(role_ids) && role_ids.length > 0) {
      for (const roleId of role_ids) {
        await pool.query(`
          INSERT INTO sec_user_roles (user_id, role_id)
          VALUES ($1, $2)
          ON CONFLICT (user_id, role_id) DO NOTHING
        `, [newUserId, roleId]);
      }
    }

    res.status(201).json({
      message: 'User created successfully',
      user: result.rows[0]
    });

  } catch (err) {
    console.error('Error creating user:', err);
    if (err.code === '23505') { // Unique constraint violation
      res.status(400).json({ message: 'Username or email already exists' });
    } else {
      res.status(500).json({ message: 'Internal server error' });
    }
  }
});

// Update user
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { username, full_name, email, user_password, password, is_active, role_ids } = req.body;
    
    // Accept either user_password or password field
    const userPassword = user_password || password;

    // Validation
    if (!username) {
      return res.status(400).json({ message: 'Username is required' });
    }

    if (userPassword && userPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    // Check if user exists
    const existingUser = await pool.query(
      'SELECT user_id FROM sec_users WHERE user_id = $1',
      [id]
    );

    if (existingUser.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if username is taken by another user
    const usernameCheck = await pool.query(
      'SELECT user_id FROM sec_users WHERE username = $1 AND user_id != $2',
      [username.trim(), id]
    );

    if (usernameCheck.rows.length > 0) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    // Check if email is taken by another user (if provided)
    if (email && email.trim()) {
      const emailCheck = await pool.query(
        'SELECT user_id FROM sec_users WHERE email = $1 AND user_id != $2',
        [email.trim(), id]
      );

      if (emailCheck.rows.length > 0) {
        return res.status(400).json({ message: 'Email already exists' });
      }
    }

    // Update user
    let query, params;

    if (userPassword) {
      // Hash the new password
      const hashedPassword = await bcrypt.hash(userPassword, 10);

      // Update with new password
      query = `
        UPDATE sec_users 
        SET username = $1, full_name = $2, email = $3, 
            user_password = $4, 
            is_active = $5, edited_date = now()
        WHERE user_id = $6
        RETURNING user_id, username, full_name, email, is_active, edited_date
      `;
      params = [
        username.trim(),
        full_name ? full_name.trim() : null,
        email ? email.trim() : null,
        hashedPassword,
        is_active !== undefined ? is_active : true,
        id
      ];
    } else {
      // Update without changing password
      query = `
        UPDATE sec_users 
        SET username = $1, full_name = $2, email = $3, 
            is_active = $4, edited_date = now()
        WHERE user_id = $5
        RETURNING user_id, username, full_name, email, is_active, edited_date
      `;
      params = [
        username.trim(),
        full_name ? full_name.trim() : null,
        email ? email.trim() : null,
        is_active !== undefined ? is_active : true,
        id
      ];
    }

    const result = await pool.query(query, params);

    // Update roles if provided
    if (role_ids !== undefined && Array.isArray(role_ids)) {
      // Delete existing role assignments
      await pool.query('DELETE FROM sec_user_roles WHERE user_id = $1', [id]);
      
      // Insert new role assignments
      if (role_ids.length > 0) {
        for (const roleId of role_ids) {
          await pool.query(`
            INSERT INTO sec_user_roles (user_id, role_id)
            VALUES ($1, $2)
            ON CONFLICT (user_id, role_id) DO NOTHING
          `, [id, roleId]);
        }
      }
    }

    res.json({
      message: 'User updated successfully',
      user: result.rows[0]
    });

  } catch (err) {
    console.error('Error updating user:', err);
    if (err.code === '23505') { // Unique constraint violation
      res.status(400).json({ message: 'Username or email already exists' });
    } else {
      res.status(500).json({ message: 'Internal server error' });
    }
  }
});

// Delete user
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent deleting own account
    if (req.user.user_id == id) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    // Check if user exists
    const existingUser = await pool.query(
      'SELECT user_id, username FROM sec_users WHERE user_id = $1',
      [id]
    );

    if (existingUser.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Delete user
    await pool.query('DELETE FROM sec_users WHERE user_id = $1', [id]);

    res.json({ message: 'User deleted successfully' });

  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Change password (for current user)
router.put('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters long' });
    }

    // Get current user's password
    const userResult = await pool.query(
      'SELECT user_password FROM sec_users WHERE user_id = $1',
      [req.user.user_id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify current password
    const passwordMatch = await bcrypt.compare(currentPassword, userResult.rows[0].user_password);

    if (!passwordMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Hash and update new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await pool.query(
      'UPDATE sec_users SET user_password = $1, edited_date = now() WHERE user_id = $2',
      [hashedPassword, req.user.user_id]
    );

    res.json({ message: 'Password changed successfully' });

  } catch (err) {
    console.error('Error changing password:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get user permissions (for RBAC)
router.get('/permissions/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await pool.query(`
      SELECT DISTINCT 
        p.permission_id,
        p.module_name,
        p.form_name,
        p.action_name,
        p.permission_code
      FROM sec_permissions p
      JOIN sec_role_permissions rp ON p.permission_id = rp.permission_id
      JOIN sec_user_roles ur ON rp.role_id = ur.role_id
      WHERE ur.user_id = $1 AND p.is_active = true
      ORDER BY p.module_name, p.form_name, p.action_name
    `, [userId]);

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching user permissions:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;