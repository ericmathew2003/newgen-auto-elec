const express = require('express');
const router = express.Router();
const pool = require('../db');

// Get all value sources from database (no authentication required, like account natures)
router.get('/', async (req, res) => {
  try {
    console.log('Value sources endpoint called - fetching from database');
    
    const { module_tag, is_active } = req.query;
    
    // Build query with filters
    let query = 'SELECT value_code, display_name, module_tag, description, is_active FROM con_acc_value_source WHERE 1=1';
    const params = [];
    
    if (module_tag) {
      params.push(module_tag);
      query += ' AND module_tag = $' + params.length;
    }
    
    if (is_active === 'true') {
      query += ' AND is_active = true';
    }
    
    query += ' ORDER BY module_tag, display_name';
    
    const result = await pool.query(query, params);
    
    console.log(`Returning ${result.rows.length} value sources from database`);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching value sources:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Get value source by code
router.get('/code/:code', async (req, res) => {
  try {
    const { code } = req.params;
    
    const result = await pool.query(
      'SELECT value_code, display_name, module_tag, description, is_active FROM con_acc_value_source WHERE value_code = $1',
      [code]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Value source not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching value source:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Get distinct module tags
router.get('/meta/module-tags', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT DISTINCT module_tag FROM con_acc_value_source WHERE is_active = true ORDER BY module_tag'
    );
    
    const moduleTags = result.rows.map(row => row.module_tag);
    res.json(moduleTags);
  } catch (err) {
    console.error('Error fetching module tags:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

module.exports = router;
