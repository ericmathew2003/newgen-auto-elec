const express = require("express");
const router = express.Router();
const pool = require("../db"); // <-- your PostgreSQL pool/connection file



// ✅ Get all items with related data
router.get("/all", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
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
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
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
    
    // Get opening stock for the item
    const openingStockResult = await pool.query(`
      SELECT COALESCE(opening_stock, 0) as opening_stock 
      FROM tblMasItem 
      WHERE itemcode = $1
    `, [itemCode]);
    
    const openingStock = openingStockResult.rows[0]?.opening_stock || 0;
    
    // Get all transactions from stock ledger table and calculate running balance
    // Based on actual trn_stock_ledger structure: qty (single column), tran_type, tran_date, inv_master_id
    const result = await pool.query(`
      WITH transactions AS (
        -- Opening Stock Entry from tblmasitem (if exists)
        SELECT 
          '1900-01-01'::date as tran_date,
          'OPEN' as tran_type,
          'Opening Balance' as reference,
          $2::numeric as qty_in,
          0::numeric as qty_out,
          '1900-01-01'::date as sort_date,
          0 as sort_order
        WHERE $2 > 0
        
        UNION ALL
        
        -- Actual stock ledger entries from trn_stock_ledger
        SELECT 
          tran_date,
          COALESCE(tran_type, 'TXN') as tran_type,
          CASE 
            WHEN inv_master_id IS NOT NULL THEN CONCAT(tran_type, '-', inv_master_id)
            ELSE CONCAT('TXN-', stock_ledger_id)
          END as reference,
          CASE WHEN qty > 0 THEN qty ELSE 0 END as qty_in,
          CASE WHEN qty < 0 THEN ABS(qty) ELSE 0 END as qty_out,
          tran_date as sort_date,
          1 as sort_order
        FROM trn_stock_ledger
        WHERE itemcode = $1
      )
      SELECT 
        tran_date,
        tran_type,
        reference,
        qty_in,
        qty_out,
        SUM(qty_in - qty_out) OVER (ORDER BY sort_date ASC, sort_order ASC) as balance
      FROM transactions
      ORDER BY sort_date DESC, sort_order DESC
    `, [itemCode, openingStock]);
    
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching item ledger:", err);
    res.status(500).json({ error: "Failed to fetch item ledger", details: err.message });
  }
});

module.exports = router;
