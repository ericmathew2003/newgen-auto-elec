const express = require('express');
const pool = require('../db');
const router = express.Router();

// Get all account natures
router.get('/', async (req, res) => {
  try {
    const { module_tag, is_active } = req.query;
    
    let query = `
      SELECT 
        nature_id,
        nature_code,
        display_name,
        module_tag,
        dr_cr_side,
        is_active,
        created_date,
        edited_date
      FROM acc_mas_nature
    `;
    
    const params = [];
    const conditions = [];
    
    // Add filter conditions
    if (module_tag) {
      conditions.push(`module_tag = $${params.length + 1}`);
      params.push(module_tag);
    }
    
    if (is_active !== undefined) {
      conditions.push(`is_active = $${params.length + 1}`);
      params.push(is_active === 'true');
    }
    
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    query += ` ORDER BY display_name`;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching account natures:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Get account nature by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      SELECT 
        nature_id,
        nature_code,
        display_name,
        module_tag,
        dr_cr_side,
        is_active,
        created_date,
        edited_date
      FROM acc_mas_nature
      WHERE nature_id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Account nature not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching account nature:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get account nature by code
router.get('/code/:code', async (req, res) => {
  try {
    const { code } = req.params;
    
    const result = await pool.query(`
      SELECT 
        nature_id,
        nature_code,
        display_name,
        module_tag,
        dr_cr_side,
        is_active,
        created_date,
        edited_date
      FROM acc_mas_nature
      WHERE nature_code = $1
    `, [code]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Account nature not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching account nature:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new account nature
router.post('/', async (req, res) => {
  try {
    const {
      nature_code,
      display_name,
      module_tag,
      dr_cr_side,
      is_active
    } = req.body;
    
    // Validation
    if (!nature_code || !display_name || !dr_cr_side) {
      return res.status(400).json({ 
        error: 'Nature code, display name, and debit/credit side are required' 
      });
    }
    
    if (!['D', 'C'].includes(dr_cr_side)) {
      return res.status(400).json({ error: 'Debit/Credit side must be D or C' });
    }
    
    // Check for duplicate nature code
    const duplicateCheck = await pool.query(
      'SELECT nature_id FROM acc_mas_nature WHERE nature_code = $1',
      [nature_code]
    );
    
    if (duplicateCheck.rows.length > 0) {
      return res.status(400).json({ 
        error: `Nature code ${nature_code} already exists` 
      });
    }
    
    const result = await pool.query(`
      INSERT INTO acc_mas_nature (
        nature_code, display_name, module_tag, dr_cr_side, is_active
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [
      nature_code.trim(),
      display_name.trim(),
      module_tag ? module_tag.trim() : null,
      dr_cr_side,
      is_active !== false
    ]);
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating account nature:', err);
    if (err.code === '23505') { // Unique constraint violation
      res.status(400).json({ error: 'Nature code already exists' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Update account nature
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nature_code,
      display_name,
      module_tag,
      dr_cr_side,
      is_active
    } = req.body;
    
    // Validation
    if (!nature_code || !display_name || !dr_cr_side) {
      return res.status(400).json({ 
        error: 'Nature code, display name, and debit/credit side are required' 
      });
    }
    
    if (!['D', 'C'].includes(dr_cr_side)) {
      return res.status(400).json({ error: 'Debit/Credit side must be D or C' });
    }
    
    // Check for duplicate nature code (excluding current record)
    const duplicateCheck = await pool.query(
      'SELECT nature_id FROM acc_mas_nature WHERE nature_code = $1 AND nature_id != $2',
      [nature_code, id]
    );
    
    if (duplicateCheck.rows.length > 0) {
      return res.status(400).json({ 
        error: `Nature code ${nature_code} already exists` 
      });
    }
    
    const result = await pool.query(`
      UPDATE acc_mas_nature 
      SET 
        nature_code = $1,
        display_name = $2,
        module_tag = $3,
        dr_cr_side = $4,
        is_active = $5,
        edited_date = now()
      WHERE nature_id = $6
      RETURNING *
    `, [
      nature_code.trim(),
      display_name.trim(),
      module_tag ? module_tag.trim() : null,
      dr_cr_side,
      is_active !== false,
      id
    ]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Account nature not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating account nature:', err);
    if (err.code === '23505') { // Unique constraint violation
      res.status(400).json({ error: 'Nature code already exists' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Delete account nature
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if nature is used in transaction mappings
    const usageCheck = await pool.query(
      'SELECT COUNT(*) as usage_count FROM con_transaction_mapping WHERE account_nature = (SELECT nature_code FROM acc_mas_nature WHERE nature_id = $1)',
      [id]
    );
    
    if (parseInt(usageCheck.rows[0].usage_count) > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete account nature that is used in transaction mappings' 
      });
    }
    
    const result = await pool.query(
      'DELETE FROM acc_mas_nature WHERE nature_id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Account nature not found' });
    }
    
    res.json({ message: 'Account nature deleted successfully' });
  } catch (err) {
    console.error('Error deleting account nature:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get distinct module tags
router.get('/meta/module-tags', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT module_tag 
      FROM acc_mas_nature 
      WHERE module_tag IS NOT NULL
      ORDER BY module_tag
    `);
    
    res.json(result.rows.map(row => row.module_tag));
  } catch (err) {
    console.error('Error fetching module tags:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;