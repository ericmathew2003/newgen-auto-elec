const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Get all transaction mappings
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { transaction_type } = req.query;
    
    let query = `
      SELECT 
        mapping_id,
        transaction_type,
        entry_sequence,
        account_nature,
        debit_credit,
        value_source,
        description_template,
        created_date,
        edited_date
      FROM con_transaction_mapping
    `;
    
    const params = [];
    
    if (transaction_type) {
      query += ` WHERE transaction_type = $1`;
      params.push(transaction_type);
    }
    
    query += ` ORDER BY transaction_type, entry_sequence`;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching transaction mappings:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get transaction mapping by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      SELECT 
        mapping_id,
        transaction_type,
        entry_sequence,
        account_nature,
        debit_credit,
        value_source,
        description_template,
        created_date,
        edited_date
      FROM con_transaction_mapping
      WHERE mapping_id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction mapping not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching transaction mapping:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new transaction mapping
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      transaction_type,
      entry_sequence,
      account_nature,
      debit_credit,
      value_source,
      description_template
    } = req.body;
    
    // Validation
    if (!transaction_type || !entry_sequence || !account_nature || !debit_credit || !value_source) {
      return res.status(400).json({ 
        error: 'Transaction type, entry sequence, account nature, debit/credit flag, and value source are required' 
      });
    }
    
    if (!['D', 'C'].includes(debit_credit)) {
      return res.status(400).json({ error: 'Debit/Credit flag must be D or C' });
    }
    
    // Check for duplicate sequence within same transaction type
    const duplicateCheck = await pool.query(
      'SELECT mapping_id FROM con_transaction_mapping WHERE transaction_type = $1 AND entry_sequence = $2',
      [transaction_type, entry_sequence]
    );
    
    if (duplicateCheck.rows.length > 0) {
      return res.status(400).json({ 
        error: `Entry sequence ${entry_sequence} already exists for transaction type ${transaction_type}` 
      });
    }
    
    const result = await pool.query(`
      INSERT INTO con_transaction_mapping (
        transaction_type, entry_sequence, account_nature, debit_credit, 
        value_source, description_template
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      transaction_type, entry_sequence, account_nature, debit_credit,
      value_source, description_template
    ]);
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating transaction mapping:', err);
    if (err.code === '23505') { // Unique constraint violation
      res.status(400).json({ error: 'Duplicate entry sequence for this transaction type' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Update transaction mapping
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      transaction_type,
      entry_sequence,
      account_nature,
      debit_credit,
      value_source,
      description_template
    } = req.body;
    
    // Validation
    if (!transaction_type || !entry_sequence || !account_nature || !debit_credit || !value_source) {
      return res.status(400).json({ 
        error: 'Transaction type, entry sequence, account nature, debit/credit flag, and value source are required' 
      });
    }
    
    if (!['D', 'C'].includes(debit_credit)) {
      return res.status(400).json({ error: 'Debit/Credit flag must be D or C' });
    }
    
    // Check for duplicate sequence within same transaction type (excluding current record)
    const duplicateCheck = await pool.query(
      'SELECT mapping_id FROM con_transaction_mapping WHERE transaction_type = $1 AND entry_sequence = $2 AND mapping_id != $3',
      [transaction_type, entry_sequence, id]
    );
    
    if (duplicateCheck.rows.length > 0) {
      return res.status(400).json({ 
        error: `Entry sequence ${entry_sequence} already exists for transaction type ${transaction_type}` 
      });
    }
    
    const result = await pool.query(`
      UPDATE con_transaction_mapping 
      SET 
        transaction_type = $1,
        entry_sequence = $2,
        account_nature = $3,
        debit_credit = $4,
        value_source = $5,
        description_template = $6,
        edited_date = now()
      WHERE mapping_id = $7
      RETURNING *
    `, [
      transaction_type, entry_sequence, account_nature, debit_credit,
      value_source, description_template, id
    ]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction mapping not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating transaction mapping:', err);
    if (err.code === '23505') { // Unique constraint violation
      res.status(400).json({ error: 'Duplicate entry sequence for this transaction type' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Delete transaction mapping
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'DELETE FROM con_transaction_mapping WHERE mapping_id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction mapping not found' });
    }
    
    res.json({ message: 'Transaction mapping deleted successfully' });
  } catch (err) {
    console.error('Error deleting transaction mapping:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get distinct transaction types
router.get('/meta/transaction-types', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT transaction_type 
      FROM con_transaction_mapping 
      ORDER BY transaction_type
    `);
    
    res.json(result.rows.map(row => row.transaction_type));
  } catch (err) {
    console.error('Error fetching transaction types:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get distinct account natures
router.get('/meta/account-natures', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT account_nature 
      FROM con_transaction_mapping 
      ORDER BY account_nature
    `);
    
    res.json(result.rows.map(row => row.account_nature));
  } catch (err) {
    console.error('Error fetching account natures:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get distinct value sources
router.get('/meta/value-sources', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT value_source 
      FROM con_transaction_mapping 
      ORDER BY value_source
    `);
    
    res.json(result.rows.map(row => row.value_source));
  } catch (err) {
    console.error('Error fetching value sources:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Test endpoint without authentication
router.get('/test', async (req, res) => {
  try {
    console.log('Test endpoint called - no auth required');
    res.json({ message: 'Test endpoint working', timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('Error in test endpoint:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get predefined value sources for dropdown
router.get('/value-sources', async (req, res) => {
  try {
    console.log('Value sources endpoint called');
    
    // Predefined value sources that can be used in transaction mappings
    const valueSources = [
      // Purchase Transaction Sources
      { value_code: 'PURCHASE_TAXABLE_AMOUNT', display_name: 'Purchase Taxable Amount', module_tag: 'PURCHASE' },
      { value_code: 'PURCHASE_CGST_AMOUNT', display_name: 'Purchase CGST Amount', module_tag: 'PURCHASE' },
      { value_code: 'PURCHASE_SGST_AMOUNT', display_name: 'Purchase SGST Amount', module_tag: 'PURCHASE' },
      { value_code: 'PURCHASE_IGST_AMOUNT', display_name: 'Purchase IGST Amount', module_tag: 'PURCHASE' },
      { value_code: 'PURCHASE_TOTAL_AMOUNT', display_name: 'Purchase Total Amount', module_tag: 'PURCHASE' },
      { value_code: 'PURCHASE_DISCOUNT_AMOUNT', display_name: 'Purchase Discount Amount', module_tag: 'PURCHASE' },
      { value_code: 'PURCHASE_FREIGHT_AMOUNT', display_name: 'Purchase Freight Amount', module_tag: 'PURCHASE' },
      
      // Sales Transaction Sources
      { value_code: 'SALES_TAXABLE_AMOUNT', display_name: 'Sales Taxable Amount', module_tag: 'SALES' },
      { value_code: 'SALES_CGST_AMOUNT', display_name: 'Sales CGST Amount', module_tag: 'SALES' },
      { value_code: 'SALES_SGST_AMOUNT', display_name: 'Sales SGST Amount', module_tag: 'SALES' },
      { value_code: 'SALES_IGST_AMOUNT', display_name: 'Sales IGST Amount', module_tag: 'SALES' },
      { value_code: 'SALES_TOTAL_AMOUNT', display_name: 'Sales Total Amount', module_tag: 'SALES' },
      { value_code: 'SALES_DISCOUNT_AMOUNT', display_name: 'Sales Discount Amount', module_tag: 'SALES' },
      
      // Journal Entry Sources
      { value_code: 'JOURNAL_AMOUNT', display_name: 'Journal Entry Amount', module_tag: 'JOURNAL' },
      { value_code: 'JOURNAL_DEBIT_AMOUNT', display_name: 'Journal Debit Amount', module_tag: 'JOURNAL' },
      { value_code: 'JOURNAL_CREDIT_AMOUNT', display_name: 'Journal Credit Amount', module_tag: 'JOURNAL' },
      
      // Payment Sources
      { value_code: 'PAYMENT_AMOUNT', display_name: 'Payment Amount', module_tag: 'PAYMENT' },
      { value_code: 'RECEIPT_AMOUNT', display_name: 'Receipt Amount', module_tag: 'RECEIPT' },
      
      // Inventory Sources
      { value_code: 'INVENTORY_VALUE', display_name: 'Inventory Value', module_tag: 'INVENTORY' },
      { value_code: 'COST_OF_GOODS_SOLD', display_name: 'Cost of Goods Sold', module_tag: 'INVENTORY' },
      
      // Other Common Sources
      { value_code: 'BANK_CHARGES', display_name: 'Bank Charges', module_tag: 'BANKING' },
      { value_code: 'INTEREST_AMOUNT', display_name: 'Interest Amount', module_tag: 'BANKING' },
      { value_code: 'ROUND_OFF_AMOUNT', display_name: 'Round Off Amount', module_tag: 'GENERAL' },
      { value_code: 'CUSTOM_AMOUNT', display_name: 'Custom Amount', module_tag: 'GENERAL' }
    ];

    console.log(`Returning ${valueSources.length} value sources`);
    
    // Filter by is_active if requested
    const { is_active } = req.query;
    if (is_active === 'true') {
      // All predefined sources are considered active
      res.json(valueSources);
    } else {
      res.json(valueSources);
    }
  } catch (err) {
    console.error('Error fetching predefined value sources:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Bulk operations - Get mappings for specific transaction type with preview
router.get('/preview/:transactionType', async (req, res) => {
  try {
    const { transactionType } = req.params;
    
    const result = await pool.query(`
      SELECT 
        mapping_id,
        entry_sequence,
        account_nature,
        debit_credit,
        value_source,
        description_template
      FROM con_transaction_mapping
      WHERE transaction_type = $1
      ORDER BY entry_sequence
    `, [transactionType]);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching transaction mapping preview:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;