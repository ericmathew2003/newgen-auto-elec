const express = require("express");
const router = express.Router();
const pool = require("../db");

// ➕ Add Party
router.post("/add", async (req, res) => {
  const { PartyType, PartyName, ContactNo, Address1, AccountID, GSTNum, Address2 } = req.body;

  if (!PartyType || !PartyName) {
    return res.status(400).json({ message: "PartyType and PartyName are required" });
  }

  try {
    // Try to insert without PartyID first (if it's auto-increment)
    let result;
    try {
      result = await pool.query(
        `INSERT INTO tblMasParty 
         (PartyType, PartyName, ContactNo, Address1, AccountID, GSTNum, Address2, created_date, edited_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())
         RETURNING PartyID, PartyType, PartyName`,
        [PartyType, PartyName, ContactNo, Address1, AccountID, GSTNum, Address2]
      );
    } catch (insertErr) {
      // If auto-increment fails, generate PartyID manually
      const maxIdResult = await pool.query("SELECT COALESCE(MAX(PartyID), 0) + 1 as nextid FROM tblMasParty");
      const nextPartyID = maxIdResult.rows[0].nextid;
      
      result = await pool.query(
        `INSERT INTO tblMasParty 
         (PartyID, PartyType, PartyName, ContactNo, Address1, AccountID, GSTNum, Address2, created_date, edited_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW())
         RETURNING PartyID, PartyType, PartyName`,
        [nextPartyID, PartyType, PartyName, ContactNo, Address1, AccountID, GSTNum, Address2]
      );
    }
    
    res.json({ 
      message: "✅ Party Added",
      party: result.rows[0]
    });
  } catch (err) {
    console.error("Insert error:", err.message);
    res.status(500).json({ message: "DB Error adding party" });
  }
});

// 📖 Get All Parties (with account information)
router.get("/all", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.PartyID, p.PartyCode, p.PartyType, p.PartyName, p.ContactNo, 
        p.Address1, p.AccountID, p.GSTNum, p.Address2, p.created_date, p.edited_date,
        a.account_name, a.account_code
      FROM tblMasParty p
      LEFT JOIN acc_mas_account a ON p.AccountID = a.account_id
      ORDER BY p.PartyID
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch error:", err.message);
    res.status(500).json({ message: "DB Error" });
  }
});

// ✏️ Edit Party
router.put("/edit/:id", async (req, res) => {
  const { id } = req.params;
  const { PartyCode, PartyType, PartyName, ContactNo, Address1, AccountID, GSTNum, Address2 } = req.body;

  try {
    const result = await pool.query(
      `UPDATE tblMasParty 
       SET PartyCode=$1, PartyType=$2, PartyName=$3, ContactNo=$4, Address1=$5, AccountID=$6, GSTNum=$7, Address2=$8, edited_date=NOW()
       WHERE PartyID=$9 
       RETURNING PartyID, PartyCode, PartyType, PartyName, ContactNo, Address1, AccountID, GSTNum, Address2, created_date, edited_date`,
      [PartyCode, PartyType, PartyName, ContactNo, Address1, AccountID, GSTNum, Address2, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Party not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Update error:", err.message);
    res.status(500).json({ error: "DB Error" });
  }
});

// ❌ Delete Party (with reference checking)
router.delete("/delete/:id", async (req, res) => {
  const { id } = req.params;
  try {
    // Check for references in related tables
    const referenceChecks = [
      { table: 'tbltrnpurchase', column: 'partyid', description: 'Purchase transactions' },
      { table: 'trn_invoice_master', column: 'party_id', description: 'Invoice records' },
      { table: 'acc_trn_invoice', column: 'party_id', description: 'Accounting invoices' },
      { table: 'acc_trn_journal_det', column: 'party_id', description: 'Journal entries' },
      { table: 'acc_trn_payment', column: 'party_id', description: 'Payment records' },
      { table: 'trn_purchase_return_master', column: 'party_id', description: 'Purchase returns' }
    ];

    const foundReferences = [];

    // Check each table for references
    for (const check of referenceChecks) {
      try {
        const result = await pool.query(
          `SELECT COUNT(*) as count FROM ${check.table} WHERE ${check.column} = $1`,
          [id]
        );
        
        const count = parseInt(result.rows[0].count);
        if (count > 0) {
          foundReferences.push({
            table: check.description,
            count: count
          });
        }
      } catch (tableErr) {
        // If table doesn't exist, skip it (don't fail the whole operation)
        console.log(`Table ${check.table} not found or accessible, skipping...`);
      }
    }

    // If references found, return error with details
    if (foundReferences.length > 0) {
      const totalReferences = foundReferences.reduce((sum, ref) => sum + ref.count, 0);
      
      return res.status(400).json({ 
        error: "Cannot delete party",
        message: `Cannot delete this party. It is currently used in ${totalReferences} transaction${totalReferences > 1 ? 's' : ''} across the system.`,
        references: foundReferences
      });
    }

    // If no references found, proceed with deletion
    const deleteResult = await pool.query("DELETE FROM tblMasParty WHERE PartyID=$1", [id]);
    
    if (deleteResult.rowCount === 0) {
      return res.status(404).json({ error: "Party not found" });
    }

    res.json({ message: "✅ Party deleted successfully" });
  } catch (err) {
    console.error("Delete error:", err.message);
    res.status(500).json({ error: "DB Error: " + err.message });
  }
});

module.exports = router;
