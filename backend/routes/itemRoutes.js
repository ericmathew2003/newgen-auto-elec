const express = require("express");
const router = express.Router();
const pool = require("../db"); // <-- your PostgreSQL pool/connection file



// ✅ Get all items with related data
router.get("/all", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT ON (i.itemcode)
        i.*,
        g.groupname,
        m.makename,
        b.brandname
      FROM tblMasItem i
      LEFT JOIN tblMasGroup g ON i.groupid = g.groupid
      LEFT JOIN tblMasMake m ON i.makeid = m.makeid
      LEFT JOIN tblMasBrand b ON i.brandid = b.brandid
      ORDER BY i.itemcode ASC
    `);
    
    console.log(`Items API: Returning ${result.rows.length} items`);
    
    // Check for duplicates in the result
    const itemCodes = result.rows.map(item => item.itemcode);
    const uniqueItemCodes = [...new Set(itemCodes)];
    
    if (itemCodes.length !== uniqueItemCodes.length) {
      console.warn(`⚠️ Duplicate item codes detected in query result!`);
      console.warn(`Total rows: ${itemCodes.length}, Unique codes: ${uniqueItemCodes.length}`);
    }
    
    res.json(result.rows);
  } catch (err) {
    console.error("Error in /api/items/all:", err.message);
    res.status(500).send("Server Error");
  }
});

// ✅ Get dropdown data for Groups, Makes, and Brands
router.get("/dropdown-data", async (req, res) => {
  try {
    const [groups, makes, brands, parties] = await Promise.all([
      pool.query("SELECT groupid, groupname FROM tblMasGroup ORDER BY groupname ASC"),
      pool.query("SELECT makeid, makename FROM tblMasMake ORDER BY makename ASC"),
      pool.query("SELECT brandid, brandname FROM tblMasBrand ORDER BY brandname ASC"),
      pool.query("SELECT partyid, partyname FROM tblMasParty WHERE partytype = 2 ORDER BY partyname ASC")
    ]);

    res.json({
      groups: groups.rows,
      makes: makes.rows,
      brands: brands.rows,
      parties: parties.rows
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// ✅ Get next available ItemCode
router.get("/next-itemcode", async (req, res) => {
  try {
    const result = await pool.query('SELECT COALESCE(MAX(ItemCode), 0) + 1 as next_code FROM tblMasItem');
    res.json({ nextItemCode: result.rows[0].next_code });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// ✅ Add new item
router.post("/add", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const {
      GroupID,
      MakeID,
      BrandID,
      ItemName,
      Packing,
      SuppRef,
      Barcode,
      Cost,
      AvgCost,
      OpeningStock,
      CurStock,
      SPrice,
      MRP,
      Unit,
      Shelf,
      PartNo,
      Model,
      CGST,
      SGST,
      IGST,
      HSNCode,
      PartyID,
      IsExpence,
      Deleted,
      Billable
    } = req.body;

    // Auto-generate ItemCode by getting the next available number
    const maxItemCodeResult = await client.query('SELECT COALESCE(MAX(ItemCode), 0) + 1 as next_code FROM tblMasItem');
    const nextItemCode = maxItemCodeResult.rows[0].next_code;

    const result = await client.query(
      `INSERT INTO tblMasItem (
        ItemCode, GroupID, MakeID, BrandID, ItemName, Packing, SuppRef, Barcode, 
        Cost, AvgCost, opening_stock, CurStock, SPrice, MRP, Unit, Shelf, PartNo, Model,
        CGST, SGST, IGST, HSNCode, PartyID, IsExpence, Deleted, Billable
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,
        $9,$10,$11,$12,$13,$14,$15,$16,$17,$18,
        $19,$20,$21,$22,$23,$24,$25,$26
      ) RETURNING ItemCode`,
      [
        nextItemCode,
        GroupID,
        MakeID,
        BrandID,
        ItemName,
        Packing,
        SuppRef,
        Barcode,
        Cost,
        AvgCost,
        OpeningStock,
        CurStock,
        SPrice,
        MRP,
        Unit,
        Shelf,
        PartNo,
        Model,
        CGST,
        SGST,
        IGST,
        HSNCode,
        PartyID,
        IsExpence,
        Deleted,
        Billable
      ]
    );

    await client.query('COMMIT');
    res.json({ 
      message: "✅ Item added successfully", 
      itemCode: result.rows[0].itemcode 
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err.message);
    res.status(500).send("Server Error");
  } finally {
    client.release();
  }
});

// ✅ Edit/Update item
router.put("/edit/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const fields = req.body;

    // Map frontend field names to database field names
    const fieldMapping = {
      'OpeningStock': 'opening_stock'
    };

    // Convert field names to database column names
    const dbFields = {};
    Object.keys(fields).forEach(key => {
      const dbKey = fieldMapping[key] || key;
      dbFields[dbKey] = fields[key];
    });

    const setClause = Object.keys(dbFields)
      .map((key, idx) => `${key} = $${idx + 1}`)
      .join(", ");

    const values = Object.values(dbFields);

    if (!setClause) {
      return res.status(400).json({ message: "No fields to update" });
    }

    await pool.query(
      `UPDATE tblMasItem SET ${setClause}, edited_date = NOW() WHERE itemcode = $${values.length + 1}`,
      [...values, id]
    );

    res.json({ message: "✅ Item updated successfully" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// ✅ Delete item
router.delete("/delete/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM tblMasItem WHERE itemcode = $1", [id]);
    res.json({ message: "🗑️ Item deleted successfully" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// ✅ Get purchase history for an item (confirmed only)
router.get("/:itemCode/purchases", async (req, res) => {
  try {
    const { itemCode } = req.params;
    const result = await pool.query(`
      SELECT 
        pm.trdate as tran_date,
        p.partyname as supplier_name,
        pd.qty,
        pd.rate,
        pd.invamount as amount,
        pm.trno as invoice_no,
        pm.suppinvno as supplier_invoice,
        pm.tranid,
        pm.costconfirmed
      FROM tbltrnpurchasedet pd
      JOIN tbltrnpurchase pm ON pd.tranmasid = pm.tranid
      LEFT JOIN tblmasparty p ON pm.partyid = p.partyid
      WHERE pd.itemcode = $1 AND pm.costconfirmed = true
      ORDER BY pm.trdate DESC, pm.trno DESC
    `, [itemCode]);
    
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching purchase history:", err);
    res.status(500).json({ error: "Failed to fetch purchase history" });
  }
});

// ✅ Get sales history for an item (posted only)
router.get("/:itemCode/sales", async (req, res) => {
  try {
    const { itemCode } = req.params;
    const result = await pool.query(`
      SELECT 
        im.inv_date as tran_date,
        COALESCE(p.partyname, im.customer_name) as customer_name,
        id.qty,
        id.taxable_rate as rate,
        id.tot_amount as amount,
        im.inv_no as invoice_no,
        im.inv_master_id,
        im.is_posted
      FROM public.trn_invoice_detail id
      JOIN public.trn_invoice_master im ON id.inv_master_id = im.inv_master_id
      LEFT JOIN tblmasparty p ON im.party_id = p.partyid
      WHERE id.itemcode = $1 AND im.is_posted = true
      ORDER BY im.inv_date DESC, im.inv_no DESC
    `, [itemCode]);
    
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching sales history:", err);
    res.status(500).json({ error: "Failed to fetch sales history" });
  }
});

// ✅ Get item ledger (opening stock from tblmasitem + transactions from trn_stock_ledger)
router.get("/:itemCode/ledger", async (req, res) => {
  try {
    const { itemCode } = req.params;
    console.log(`Fetching ledger for item: ${itemCode}`);
    
    // Start with a very simple query to test basic functionality
    const result = [];
    
    try {
      // First, just check if the item exists
      const itemCheck = await pool.query(`
        SELECT itemcode, itemname, COALESCE(opening_stock, 0) as opening_stock 
        FROM tblmasitem 
        WHERE itemcode = $1
      `, [itemCode]);
      
      console.log(`Item check result:`, itemCheck.rows);
      
      if (itemCheck.rows.length === 0) {
        console.log(`Item ${itemCode} not found`);
        return res.json([]);
      }
      
      const openingStock = Number(itemCheck.rows[0].opening_stock || 0);
      console.log(`Opening stock: ${openingStock}`);
      
      // Add opening stock entry if > 0
      if (openingStock > 0) {
        result.push({
          tran_date: '1900-01-01',
          tran_type: 'OPEN',
          reference: 'Opening Balance',
          qty_in: openingStock,
          qty_out: 0,
          balance: openingStock
        });
      }
      
      // Try to get stock ledger entries - but handle if table doesn't exist
      try {
        const ledgerResult = await pool.query(`
          SELECT 
            tran_date,
            tran_type,
            inv_master_id,
            stock_ledger_id,
            qty
          FROM trn_stock_ledger
          WHERE itemcode = $1
          ORDER BY tran_date DESC
          LIMIT 10
        `, [itemCode]);
        
        console.log(`Stock ledger entries found: ${ledgerResult.rows.length}`);
        
        let runningBalance = openingStock;
        
        // Process ledger entries
        for (const entry of ledgerResult.rows.reverse()) {
          const qty = Number(entry.qty || 0);
          const qtyIn = qty > 0 ? qty : 0;
          const qtyOut = qty < 0 ? Math.abs(qty) : 0;
          
          runningBalance += qtyIn - qtyOut;
          
          result.push({
            tran_date: entry.tran_date,
            tran_type: entry.tran_type || 'TXN',
            reference: entry.inv_master_id ? `${entry.tran_type}-${entry.inv_master_id}` : `TXN-${entry.stock_ledger_id}`,
            qty_in: qtyIn,
            qty_out: qtyOut,
            balance: runningBalance
          });
        }
        
      } catch (ledgerError) {
        console.log(`Stock ledger table error (might not exist):`, ledgerError.message);
        // Continue without ledger entries - just return opening stock
      }
      
    } catch (itemError) {
      console.error(`Error checking item:`, itemError);
      throw itemError;
    }
    
    console.log(`Returning ${result.length} ledger entries`);
    res.json(result.reverse()); // Newest first
    
  } catch (err) {
    console.error("Error in ledger route:", err);
    res.status(500).json({ 
      error: "Failed to fetch item ledger", 
      details: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

module.exports = router;
