const express = require("express");
const router = express.Router();
const pool = require("../db");
const { authenticateToken } = require("../middleware/auth");
const { checkPermission } = require("../middleware/checkPermission");

// Get all COA accounts with group information
router.get("/all", authenticateToken, checkPermission('ACCOUNTS_COA_MASTER_VIEW'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        c.account_id,
        c.account_code,
        c.account_name,
        c.group_id,
        c.normal_balance,
        c.account_tag,
        c.account_nature,
        c.is_posting_allowed,
        c.is_reconciliation_required,
        c.is_active,
        c.created_date,
        c.edited_date,
        g.group_name,
        g.group_type
      FROM acc_mas_coa c
      LEFT JOIN acc_mas_group g ON c.group_id = g.group_id
      ORDER BY c.account_code ASC
    `);
    
    console.log(`COA API: Returning ${result.rows.length} accounts`);
    res.json(result.rows);
  } catch (err) {
    console.error("Error in /api/coa/all:", err.message);
    res.status(500).send("Server Error");
  }
});

// Get groups for dropdown (formatted for COA form)
router.get("/groups/list", authenticateToken, checkPermission('ACCOUNTS_COA_MASTER_VIEW'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        group_id,
        group_name,
        group_type,
        normal_balance,
        CONCAT(group_name, ' (', group_type, ' - ', normal_balance, ')') as display_name
      FROM acc_mas_group 
      WHERE group_id IS NOT NULL
      ORDER BY group_name ASC
    `);
    
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching groups for COA:", err.message);
    res.status(500).json({ error: "Server Error" });
  }
});

// Get account natures for dropdown (formatted for COA form)
router.get("/natures/list", authenticateToken, checkPermission('ACCOUNTS_COA_MASTER_VIEW'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        nature_id,
        nature_code,
        display_name,
        module_tag,
        dr_cr_side,
        CONCAT(display_name, ' (', nature_code, ')') as display_name_formatted
      FROM acc_mas_nature 
      WHERE is_active = true
      ORDER BY display_name ASC
    `);
    
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching account natures for COA:", err.message);
    res.status(500).json({ error: "Server Error" });
  }
});

// Validate account code uniqueness
router.get("/validate/code/:code", authenticateToken, checkPermission('ACCOUNTS_COA_MASTER_VIEW'), async (req, res) => {
  try {
    const { code } = req.params;
    const { excludeId } = req.query;
    
    let query = 'SELECT account_id FROM acc_mas_coa WHERE LOWER(account_code) = LOWER($1)';
    let params = [code];
    
    if (excludeId) {
      query += ' AND account_id != $2';
      params.push(excludeId);
    }
    
    const result = await pool.query(query, params);
    res.json({ exists: result.rows.length > 0 });
  } catch (err) {
    console.error("Error validating account code:", err.message);
    res.status(500).json({ error: "Server Error" });
  }
});

// Validate account name uniqueness
router.get("/validate/name/:name", authenticateToken, checkPermission('ACCOUNTS_COA_MASTER_VIEW'), async (req, res) => {
  try {
    const { name } = req.params;
    const { excludeId } = req.query;
    
    let query = 'SELECT account_id FROM acc_mas_coa WHERE LOWER(account_name) = LOWER($1)';
    let params = [name];
    
    if (excludeId) {
      query += ' AND account_id != $2';
      params.push(excludeId);
    }
    
    const result = await pool.query(query, params);
    res.json({ exists: result.rows.length > 0 });
  } catch (err) {
    console.error("Error validating account name:", err.message);
    res.status(500).json({ error: "Server Error" });
  }
});

// Add new COA account
router.post("/", authenticateToken, checkPermission('ACCOUNTS_COA_MASTER_ADD'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { 
      account_code, 
      account_name, 
      group_id, 
      account_tag,
      account_nature,
      is_posting_allowed, 
      is_reconciliation_required, 
      is_active 
    } = req.body;

    if (!account_code || !account_name || !group_id) {
      return res.status(400).json({ error: "Account Code, Name, and Group are required" });
    }

    // Get the normal balance from the group
    const groupResult = await client.query(
      'SELECT normal_balance FROM acc_mas_group WHERE group_id = $1',
      [group_id]
    );

    if (groupResult.rows.length === 0) {
      return res.status(400).json({ error: "Invalid group selected" });
    }

    const normal_balance = groupResult.rows[0].normal_balance;

    // Check for duplicate account code
    const existingCode = await client.query(
      'SELECT account_id FROM acc_mas_coa WHERE LOWER(account_code) = LOWER($1)',
      [account_code.trim()]
    );

    if (existingCode.rows.length > 0) {
      return res.status(400).json({ error: "Account code already exists" });
    }

    // Check for duplicate account name
    const existingName = await client.query(
      'SELECT account_id FROM acc_mas_coa WHERE LOWER(account_name) = LOWER($1)',
      [account_name.trim()]
    );

    if (existingName.rows.length > 0) {
      return res.status(400).json({ error: "Account name already exists" });
    }

    const result = await client.query(
      `INSERT INTO acc_mas_coa (
        account_code,
        account_name,
        group_id,
        normal_balance,
        account_tag,
        account_nature,
        is_posting_allowed,
        is_reconciliation_required,
        is_active,
        created_date, 
        edited_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()) 
      RETURNING account_id`,
      [
        account_code.trim(),
        account_name.trim(),
        group_id,
        normal_balance,
        account_tag ? account_tag.trim() : null,
        account_nature ? account_nature.trim() : null,
        is_posting_allowed !== false,
        is_reconciliation_required === true,
        is_active !== false
      ]
    );

    await client.query('COMMIT');
    res.json({ 
      message: "✅ Account created successfully", 
      account_id: result.rows[0].account_id 
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Error adding COA account:", err.message);
    res.status(500).json({ error: "Server Error" });
  } finally {
    client.release();
  }
});

// Get single COA account by ID
router.get("/:id", authenticateToken, checkPermission('ACCOUNTS_COA_MASTER_VIEW'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT 
        c.*,
        g.group_name,
        g.group_type
      FROM acc_mas_coa c
      LEFT JOIN acc_mas_group g ON c.group_id = g.group_id
      WHERE c.account_id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Account not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching COA account:", err.message);
    res.status(500).json({ error: "Server Error" });
  }
});

// Update COA account
router.put("/:id", authenticateToken, checkPermission('ACCOUNTS_COA_MASTER_EDIT'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { 
      account_code, 
      account_name, 
      group_id, 
      account_tag,
      account_nature,
      is_posting_allowed, 
      is_reconciliation_required, 
      is_active 
    } = req.body;

    if (!account_code || !account_name || !group_id) {
      return res.status(400).json({ error: "Account Code, Name, and Group are required" });
    }

    // Get the normal balance from the group
    const groupResult = await client.query(
      'SELECT normal_balance FROM acc_mas_group WHERE group_id = $1',
      [group_id]
    );

    if (groupResult.rows.length === 0) {
      return res.status(400).json({ error: "Invalid group selected" });
    }

    const normal_balance = groupResult.rows[0].normal_balance;

    // Check for duplicate account code (excluding current record)
    const existingCode = await client.query(
      'SELECT account_id FROM acc_mas_coa WHERE LOWER(account_code) = LOWER($1) AND account_id != $2',
      [account_code.trim(), id]
    );

    if (existingCode.rows.length > 0) {
      return res.status(400).json({ error: "Account code already exists" });
    }

    // Check for duplicate account name (excluding current record)
    const existingName = await client.query(
      'SELECT account_id FROM acc_mas_coa WHERE LOWER(account_name) = LOWER($1) AND account_id != $2',
      [account_name.trim(), id]
    );

    if (existingName.rows.length > 0) {
      return res.status(400).json({ error: "Account name already exists" });
    }

    const result = await client.query(
      `UPDATE acc_mas_coa 
       SET account_code = $1, 
           account_name = $2,
           group_id = $3,
           normal_balance = $4,
           account_tag = $5,
           account_nature = $6,
           is_posting_allowed = $7,
           is_reconciliation_required = $8,
           is_active = $9,
           edited_date = NOW() 
       WHERE account_id = $10
       RETURNING account_id`,
      [
        account_code.trim(),
        account_name.trim(),
        group_id,
        normal_balance,
        account_tag ? account_tag.trim() : null,
        account_nature ? account_nature.trim() : null,
        is_posting_allowed !== false,
        is_reconciliation_required === true,
        is_active !== false,
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Account not found" });
    }

    await client.query('COMMIT');
    res.json({ message: "✅ Account updated successfully" });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Error updating COA account:", err.message);
    res.status(500).json({ error: "Server Error" });
  } finally {
    client.release();
  }
});

// Delete COA account
router.delete("/:id", authenticateToken, checkPermission('ACCOUNTS_COA_MASTER_DELETE'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if account is being used in transactions (you can add this check later)
    // const usageCheck = await pool.query(
    //   'SELECT COUNT(*) as count FROM journal_entries WHERE account_id = $1',
    //   [id]
    // );

    // if (parseInt(usageCheck.rows[0].count) > 0) {
    //   return res.status(400).json({ 
    //     error: "Cannot delete account - it has transaction history" 
    //   });
    // }

    const result = await pool.query(
      "DELETE FROM acc_mas_coa WHERE account_id = $1 RETURNING account_id", 
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Account not found" });
    }

    res.json({ message: "🗑️ Account deleted successfully" });
  } catch (err) {
    console.error("Error deleting COA account:", err.message);
    res.status(500).json({ error: "Server Error" });
  }
});

module.exports = router;