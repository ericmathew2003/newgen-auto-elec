const express = require("express");
const router = express.Router();
const pool = require("../db");
const { authenticateToken } = require("../middleware/auth");
const { checkPermission } = require("../middleware/checkPermission");

// Get all account groups
router.get("/all", authenticateToken, checkPermission('ACCOUNTS_GROUP_MASTER_VIEW'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        group_id,
        group_name,
        group_type,
        normal_balance,
        parent_group_id,
        created_date,
        edited_date
      FROM acc_mas_group 
      ORDER BY group_name ASC
    `);
    
    console.log(`Account Groups API: Returning ${result.rows.length} account groups`);
    res.json(result.rows);
  } catch (err) {
    console.error("Error in /api/account-groups/all:", err.message);
    res.status(500).send("Server Error");
  }
});

// Add new account group
router.post("/add", authenticateToken, checkPermission('ACCOUNTS_GROUP_MASTER_ADD'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { 
      group_name, 
      group_type, 
      normal_balance, 
      parent_group_id 
    } = req.body;

    if (!group_name || !group_name.trim()) {
      return res.status(400).json({ message: "Account Group Name is required" });
    }

    // Check for duplicate name
    const existingGroup = await client.query(
      'SELECT group_id FROM acc_mas_group WHERE LOWER(group_name) = LOWER($1)',
      [group_name.trim()]
    );

    if (existingGroup.rows.length > 0) {
      return res.status(400).json({ message: "Account Group Name already exists" });
    }

    const result = await client.query(
      `INSERT INTO acc_mas_group (
        group_name,
        group_type,
        normal_balance,
        parent_group_id,
        created_date, 
        edited_date
      ) VALUES ($1, $2, $3, $4, NOW(), NOW()) 
      RETURNING group_id`,
      [
        group_name.trim(),
        group_type || null,
        normal_balance || null,
        parent_group_id || null
      ]
    );

    await client.query('COMMIT');
    res.json({ 
      message: "✅ Account Group added successfully", 
      group_id: result.rows[0].group_id 
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Error adding account group:", err.message);
    res.status(500).json({ message: "Server Error" });
  } finally {
    client.release();
  }
});

// Edit/Update account group
router.put("/edit/:id", authenticateToken, checkPermission('ACCOUNTS_GROUP_MASTER_EDIT'), async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      group_name, 
      group_type, 
      normal_balance, 
      parent_group_id 
    } = req.body;

    if (!group_name || !group_name.trim()) {
      return res.status(400).json({ message: "Account Group Name is required" });
    }

    // Check for duplicate name (excluding current record)
    const existingGroup = await pool.query(
      'SELECT group_id FROM acc_mas_group WHERE LOWER(group_name) = LOWER($1) AND group_id != $2',
      [group_name.trim(), id]
    );

    if (existingGroup.rows.length > 0) {
      return res.status(400).json({ message: "Account Group Name already exists" });
    }

    const result = await pool.query(
      `UPDATE acc_mas_group 
       SET group_name = $1, 
           group_type = $2,
           normal_balance = $3,
           parent_group_id = $4,
           edited_date = NOW() 
       WHERE group_id = $5
       RETURNING group_id`,
      [
        group_name.trim(), 
        group_type || null,
        normal_balance || null,
        parent_group_id || null,
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Account Group not found" });
    }

    res.json({ message: "✅ Account Group updated successfully" });
  } catch (err) {
    console.error("Error updating account group:", err.message);
    res.status(500).json({ message: "Server Error" });
  }
});

// Delete account group
router.delete("/delete/:id", authenticateToken, checkPermission('ACCOUNTS_GROUP_MASTER_DELETE'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if account group is being used in account master
    const usageCheck = await pool.query(
      'SELECT COUNT(*) as count FROM acc_mas_account WHERE account_type_id = $1',
      [id]
    );

    if (parseInt(usageCheck.rows[0].count) > 0) {
      return res.status(400).json({ 
        message: "Cannot delete Account Group - it is being used by accounts" 
      });
    }

    // Check if account group has child groups
    const childCheck = await pool.query(
      'SELECT COUNT(*) as count FROM acc_mas_group WHERE parent_group_id = $1',
      [id]
    );

    if (parseInt(childCheck.rows[0].count) > 0) {
      return res.status(400).json({ 
        message: "Cannot delete Account Group - it has child groups" 
      });
    }

    const result = await pool.query(
      "DELETE FROM acc_mas_group WHERE group_id = $1 RETURNING group_id", 
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Account Group not found" });
    }

    res.json({ message: "🗑️ Account Group deleted successfully" });
  } catch (err) {
    console.error("Error deleting account group:", err.message);
    res.status(500).json({ message: "Server Error" });
  }
});

// Get all parent groups (no exclusion) - MUST come before /:id route
router.get("/parents", authenticateToken, checkPermission('ACCOUNTS_GROUP_MASTER_VIEW'), async (req, res) => {
  try {
    const query = `
      SELECT 
        group_id,
        group_name,
        group_type,
        normal_balance
      FROM acc_mas_group 
      ORDER BY group_name ASC
    `;
    
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching parent groups:", err.message);
    res.status(500).json({ message: "Server Error" });
  }
});

// Get parent groups for dropdown (exclude current group to prevent circular reference)
router.get("/parents/:excludeId", authenticateToken, checkPermission('ACCOUNTS_GROUP_MASTER_VIEW'), async (req, res) => {
  try {
    const { excludeId } = req.params;
    let query = `
      SELECT 
        group_id,
        group_name,
        group_type,
        normal_balance
      FROM acc_mas_group 
    `;
    let params = [];
    
    if (excludeId && excludeId !== 'all') {
      query += ' WHERE group_id != $1';
      params = [excludeId];
    }
    
    query += ' ORDER BY group_name ASC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching parent groups:", err.message);
    res.status(500).json({ message: "Server Error" });
  }
});

// Get account group by ID - MUST come after specific routes
router.get("/:id", authenticateToken, checkPermission('ACCOUNTS_GROUP_MASTER_VIEW'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM acc_mas_group WHERE group_id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Account Group not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching account group:", err.message);
    res.status(500).json({ message: "Server Error" });
  }
});

module.exports = router;