const express = require("express");
const router = express.Router();
const pool = require("../db");



// 📖 Get All Accounts from acc_mas_account table
router.get("/all", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT account_id, account_code, account_name, account_type_id, acc_parent_acc_id, 
             account_level, is_active, tag, created_date, edited_date
      FROM acc_mas_account 
      WHERE is_active = true 
      ORDER BY account_name
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch accounts error:", err.message);
    res.status(500).json({ message: "DB Error fetching accounts" });
  }
});

// 📖 Get Account by ID
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`
      SELECT account_id, account_code, account_name, account_type_id, acc_parent_acc_id, 
             account_level, is_active, tag, created_date, edited_date
      FROM acc_mas_account 
      WHERE account_id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Account not found" });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Fetch account error:", err.message);
    res.status(500).json({ message: "DB Error fetching account" });
  }
});

// ➕ Add Account
router.post("/add", async (req, res) => {
  const { 
    account_code, 
    account_name, 
    account_type_id, 
    acc_parent_acc_id, 
    account_level, 
    is_active = true, 
    tag 
  } = req.body;

  if (!account_name) {
    return res.status(400).json({ message: "Account name is required" });
  }

  try {
    const result = await pool.query(`
      INSERT INTO acc_mas_account 
      (account_code, account_name, account_type_id, acc_parent_acc_id, account_level, is_active, tag, created_date, edited_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING account_id, account_code, account_name, account_type_id, acc_parent_acc_id, account_level, is_active, tag, created_date, edited_date
    `, [account_code, account_name, account_type_id, acc_parent_acc_id, account_level, is_active, tag]);
    
    res.json({ 
      message: "✅ Account Added", 
      account: result.rows[0] 
    });
  } catch (err) {
    console.error("Insert account error:", err.message);
    res.status(500).json({ message: "DB Error adding account" });
  }
});

// ✏️ Edit Account
router.put("/edit/:id", async (req, res) => {
  const { id } = req.params;
  const { 
    account_code, 
    account_name, 
    account_type_id, 
    acc_parent_acc_id, 
    account_level, 
    is_active, 
    tag 
  } = req.body;

  try {
    const result = await pool.query(`
      UPDATE acc_mas_account 
      SET account_code = $1, account_name = $2, account_type_id = $3, 
          acc_parent_acc_id = $4, account_level = $5, is_active = $6, 
          tag = $7, edited_date = NOW()
      WHERE account_id = $8 
      RETURNING account_id, account_code, account_name, account_type_id, acc_parent_acc_id, account_level, is_active, tag, created_date, edited_date
    `, [account_code, account_name, account_type_id, acc_parent_acc_id, account_level, is_active, tag, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Account not found" });
    }

    res.json({
      message: "✅ Account Updated",
      account: result.rows[0]
    });
  } catch (err) {
    console.error("Update account error:", err.message);
    res.status(500).json({ error: "DB Error updating account" });
  }
});

// ❌ Delete Account (soft delete by setting is_active = false)
router.delete("/delete/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`
      UPDATE acc_mas_account 
      SET is_active = false, edited_date = NOW() 
      WHERE account_id = $1
      RETURNING account_id, account_name
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Account not found" });
    }
    
    res.json({ 
      message: "✅ Account deactivated successfully",
      account: result.rows[0]
    });
  } catch (err) {
    console.error("Delete account error:", err.message);
    res.status(500).json({ error: "DB Error deactivating account" });
  }
});

// 🔄 Activate Account
router.put("/activate/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`
      UPDATE acc_mas_account 
      SET is_active = true, edited_date = NOW() 
      WHERE account_id = $1
      RETURNING account_id, account_name, is_active
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Account not found" });
    }
    
    res.json({ 
      message: "✅ Account activated successfully",
      account: result.rows[0]
    });
  } catch (err) {
    console.error("Activate account error:", err.message);
    res.status(500).json({ error: "DB Error activating account" });
  }
});

module.exports = router;