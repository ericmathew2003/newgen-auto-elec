const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');

const router = express.Router();

// Login Route
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await pool.query('SELECT * FROM login WHERE username = $1', [username]);
    if (user.rows.length === 0) return res.status(401).json({ message: 'Invalid credentials' });

    const validPassword = await bcrypt.compare(password, user.rows[0].password);
    if (!validPassword) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: user.rows[0].id }, 'your_secret_key', { expiresIn: '1h' });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
