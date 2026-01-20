const express = require("express");
const router = express.Router();
const pool = require("../db");
const { authenticateToken } = require("../middleware/auth");
const { checkPermission } = require("../middleware/checkPermission");

/**
 * Create Purchase Invoice (Header Only)
 */
router.post("/", authenticateToken, checkPermission('INVENTORY_PURCHASE_ADD'), async (req, res) => {
  const {
    FYearID, TrNo, TrDate, SuppInvNo, SuppInvDt, PartyID,
    Remark, InvAmt, TptCharge, LabCharge, MiscCharge, PackCharge,
    Rounded, CGST, SGST, IGST, CostSheetPrepared, GRNPosted, Costconfirmed
  } = req.body;

  try {
    const maxIdResult = await pool.query('SELECT COALESCE(MAX(tranid), 0) + 1 as next_id FROM tbltrnpurchase');
    const nextTranID = maxIdResult.rows[0].next_id;

    const result = await pool.query(
      `INSERT INTO tbltrnpurchase
       (tranid, fyearid, trno, trdate, suppinvno, suppinvdt, partyid, remark,
        invamt, tptcharge, labcharge, misccharge, packcharge, rounded,
        cgst, sgst, igst, costsheetprepared, grnposted, costconfirmed)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
       RETURNING tranid`,
      [nextTranID, FYearID, TrNo, TrDate, SuppInvNo, SuppInvDt, PartyID, Remark,
       InvAmt, TptCharge, LabCharge, MiscCharge, PackCharge, Rounded,
       CGST, SGST, IGST, CostSheetPrepared, GRNPosted, Costconfirmed]
    );

    res.json({ success: true, TranID: result.rows[0].tranid });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create purchase" });
  }
});

/**
 * Update Purchase Invoice (Header Only)
 */
router.put("/:tranId", authenticateToken, checkPermission('INVENTORY_PURCHASE_EDIT'), async (req, res) => {
  const { tranId } = req.params;
  const {
    FYearID, TrNo, TrDate, SuppInvNo, SuppInvDt, PartyID,
    Remark, InvAmt, TptCharge, LabCharge, MiscCharge, PackCharge,
    Rounded, CGST, SGST, IGST, CostSheetPrepared, GRNPosted, Costconfirmed
  } = req.body;

  try {
    await pool.query(
      `UPDATE tbltrnpurchase
       SET fyearid = $1, trno = $2, trdate = $3, suppinvno = $4, suppinvdt = $5, 
           partyid = $6, remark = $7, invamt = $8, tptcharge = $9, labcharge = $10, 
           misccharge = $11, packcharge = $12, rounded = $13, cgst = $14, sgst = $15, 
           igst = $16, costsheetprepared = $17, grnposted = $18, costconfirmed = $19
       WHERE tranid = $20`,
      [FYearID, TrNo, TrDate, SuppInvNo, SuppInvDt, PartyID, Remark,
       InvAmt, TptCharge, LabCharge, MiscCharge, PackCharge, Rounded,
       CGST, SGST, IGST, CostSheetPrepared, GRNPosted, Costconfirmed, tranId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update purchase" });
  }
});

/**
 * Get Purchase Summary Data for Purchase Summary Report
 */
router.get("/summary", authenticateToken, checkPermission('INVENTORY_PURCHASE_VIEW'), async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    
    console.log("Purchase summary endpoint called with:", { fromDate, toDate });
    
    if (!fromDate || !toDate) {
      console.log("Missing dates - fromDate:", fromDate, "toDate:", toDate);
      return res.status(400).json({ error: "fromDate and toDate are required" });
    }

    const query = `
      SELECT 
        p.TranID,
        p.TrNo as inv_no,
        p.TrDate as inv_date,
        party.PartyName as supplier_name,
        p.InvAmt as taxable_tot,
        p.CGST as cgst_amount,
        p.SGST as sgst_amount,
        p.IGST as igst_amount,
        p.Rounded as rounded_off,
        (COALESCE(p.InvAmt, 0) + COALESCE(p.CGST, 0) + COALESCE(p.SGST, 0) + COALESCE(p.IGST, 0) + COALESCE(p.Rounded, 0)) as tot_amount,
        CASE 
          WHEN p.Costconfirmed = true THEN true
          ELSE false
        END as is_posted
      FROM tblTrnPurchase p
      LEFT JOIN tblMasParty party ON p.PartyID = party.PartyID
      WHERE p.TrDate >= $1 AND p.TrDate <= $2
        AND COALESCE(p.is_cancelled, false) = false
      ORDER BY p.TrDate, p.TrNo
    `;

    console.log("Executing purchase summary query with params:", [fromDate, toDate]);
    
    try {
      const result = await pool.query(query, [fromDate, toDate]);
      console.log("Purchase summary query executed successfully, result count:", result.rows.length);
      res.json(result.rows);
    } catch (queryError) {
      console.error("Database query error:", queryError);
      return res.status(400).json({ 
        error: "Database query failed", 
        details: queryError.message,
        query: query,
        params: [fromDate, toDate]
      });
    }
  } catch (err) {
    console.error("Error fetching purchase summary:", err.message);
    console.error("Full error:", err);
    res.status(500).json({ 
      error: "Server Error", 
      details: err.message,
      query_params: { fromDate, toDate }
    });
  }
});

/**
 * Get All Purchases (List View)
 */
router.get("/", authenticateToken, checkPermission('INVENTORY_PURCHASE_VIEW'), async (req, res) => {
  const { fromDate, toDate, supplierId, fyearid } = req.query;
  let where = [];
  let params = [];

  if (fromDate) {
    params.push(fromDate);
    where.push(`p.TrDate >= $${params.length}`);
  }
  if (toDate) {
    params.push(toDate);
    where.push(`p.TrDate <= $${params.length}`);
  }
  if (supplierId) {
    params.push(supplierId);
    where.push(`p.PartyID = $${params.length}`);
  }
  // Critical: Filter by financial year for data isolation
  if (fyearid) {
    params.push(fyearid);
    where.push(`p.FYearID = $${params.length}`);
  }

  const filter = where.length ? `WHERE ${where.join(" AND ")}` : "";

  try {
    const result = await pool.query(
      `SELECT p.TranID, p.TrNo, p.TrDate, p.SuppInvNo, p.SuppInvDt,
              party.PartyName, p.InvAmt, p.CGST, p.SGST, p.IGST,
              p.CostSheetPrepared, p.GRNPosted, p.Costconfirmed, p.is_cancelled
       FROM tblTrnPurchase p
       JOIN tblMasParty party ON p.PartyID = party.PartyID
       ${filter}
       ORDER BY p.TrDate DESC`,
      params
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch purchases" });
  }
});

/**
 * Get Single Purchase (Header + Details)
 */
router.get("/:tranId", authenticateToken, checkPermission('INVENTORY_PURCHASE_VIEW'), async (req, res) => {
  const { tranId } = req.params;

  try {
    const header = await pool.query(
      `SELECT * FROM tblTrnPurchase WHERE TranID = $1`, [tranId]
    );

    const details = await pool.query(
      `SELECT * FROM tbltrnpurchasedet WHERE tranmasid = $1 ORDER BY srno`,
      [tranId]
    );

    res.json({
      header: header.rows[0],
      details: details.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch purchase" });
  }
});

/**
 * Costing: get rows for a purchase
 */
router.get('/:tranId/costing', authenticateToken, checkPermission('INVENTORY_PURCHASE_VIEW'), async (req, res) => {
  const { tranId } = req.params;
  try {
    const r = await pool.query(
      `SELECT costtrid, pruchmasid, ohtype, amount
       FROM tbltrnpurchasecosting WHERE pruchmasid = $1 ORDER BY costtrid`,
      [tranId]
    );
    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch costing rows' });
  }
});

/**
 * Costing: replace rows and update header charges + set prepared flag
 * Body: { rows: [{OHType, Amount}] }
 */
router.put('/:tranId/costing', authenticateToken, checkPermission('INVENTORY_PURCHASE_EDIT'), async (req, res) => {
  const { tranId } = req.params;
  const { rows = [] } = req.body || {};
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM tbltrnpurchasecosting WHERE pruchmasid = $1`, [tranId]);

    let tpt = 0, lab = 0, misc = 0;
    for (const r of rows) {
      const { OHType = '', Amount = 0 } = r || {};
      await client.query(
        `INSERT INTO tbltrnpurchasecosting (pruchmasid, ohtype, amount)
         VALUES ($1,$2,$3)`,
        [tranId, OHType, Amount]
      );
      const t = String(OHType || '').toLowerCase();
      if (t.startsWith('trans') || t.includes('freight') || t.includes('tpt')) tpt += Number(Amount) || 0;
      else if (t.startsWith('lab')) lab += Number(Amount) || 0;
      else misc += Number(Amount) || 0;
    }

    const prepared = rows.some(r => Number(r?.Amount) > 0);
    await client.query(
      `UPDATE tbltrnpurchase SET tptcharge = $1, labcharge = $2, misccharge = $3, costsheetprepared = $4 WHERE tranid = $5`,
      [tpt, lab, misc, prepared, tranId]
    );

    await client.query('COMMIT');
    res.json({ success: true, TptCharge: tpt, LabCharge: lab, MiscCharge: misc, CostSheetPrepared: prepared });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to save costing' });
  } finally {
    client.release();
  }
});

/**
 * Confirm costing and persist computed item overheads
 * Body: { items: [{ Srno, OHAmt, NetRate, GTotal? }] }
 */
router.post('/:tranId/costing/confirm', authenticateToken, checkPermission('INVENTORY_PURCHASE_EDIT'), async (req, res) => {
  const { tranId } = req.params;
  const { items = [] } = req.body || {};
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1) Update detail overheads and net rate if provided in request
    for (const it of items) {
      const { Srno, OHAmt = 0, NetRate = 0, GTotal = null } = it || {};
      if (Srno == null) continue;
      await client.query(
        `UPDATE tbltrnpurchasedet SET ohamt = $1, netrate = $2${GTotal != null ? ', gtotal = $3' : ''}
         WHERE tranmasid = $4 AND srno = $5`,
        GTotal != null ? [OHAmt, NetRate, GTotal, tranId, Srno] : [OHAmt, NetRate, tranId, Srno]
      );
    }

    // 2) Determine whether a cost sheet is prepared for this purchase
    const hdr = await client.query(
      `SELECT CostSheetPrepared FROM tblTrnPurchase WHERE TranID = $1`,
      [tranId]
    );
    const prepared = !!(hdr.rows?.[0]?.costsheetprepared);

    // 3) Fetch purchase details to compute item master updates
    const det = await client.query(
      `SELECT itemcode, qty, rate, netrate FROM tbltrnpurchasedet WHERE tranmasid = $1`,
      [tranId]
    );

    for (const row of det.rows || []) {
      const itemcode = row.itemcode;
      if (!itemcode) continue;
      const qty = Number(row.qty) || 0;
      // Effective rate: use NetRate if cost sheet prepared, else use Rate
      const effRate = prepared ? (Number(row.netrate) || Number(row.rate) || 0) : (Number(row.rate) || 0);

      // Lock the item row to avoid race conditions and read current stock/avg cost
      const ir = await client.query(
        `SELECT Cost, AvgCost, CurStock FROM tblMasItem WHERE ItemCode = $1 FOR UPDATE`,
        [itemcode]
      );
      if (ir.rows.length === 0) continue; // skip if item master missing

      const curStock = Number(ir.rows[0].curstock) || 0;
      const curAvg = Number(ir.rows[0].avgcost) || 0;

      // Weighted average cost computation
      const beforeValue = curStock * curAvg; // stock value before this purchase
      const purchaseValue = qty * effRate;   // value of current purchase
      const totalStock = curStock + qty;     // stock after this purchase

      // Avoid divide-by-zero: if totalStock==0, fall back to effective rate
      const newAvg = totalStock > 0 ? (beforeValue + purchaseValue) / totalStock : effRate;
      const newCost = effRate;
      const newCurStock = totalStock;

      await client.query(
        `UPDATE tblMasItem SET Cost = $1, AvgCost = $2, CurStock = $3 WHERE ItemCode = $4`,
        [newCost, newAvg, newCurStock, itemcode]
      );
    }

    // 4) Create stock ledger entries for inventory tracking
    const purchaseHeader = await client.query(
      `SELECT FYearID, TrDate FROM tblTrnPurchase WHERE TranID = $1`,
      [tranId]
    );
    
    if (purchaseHeader.rows.length > 0) {
      const { fyearid, trdate } = purchaseHeader.rows[0];
      
      // Get purchase details with item info for stock ledger
      const detailsForLedger = await client.query(
        `SELECT d.itemcode, d.qty, i.unit 
         FROM tbltrnpurchasedet d
         LEFT JOIN tblmasitem i ON d.itemcode = i.itemcode
         WHERE d.tranmasid = $1`,
        [tranId]
      );

      for (const row of detailsForLedger.rows || []) {
        const { itemcode, qty, unit } = row;
        if (!itemcode || !qty || qty <= 0) continue;

        // Insert stock ledger entry for purchase (IN transaction)
        // Note: stock_ledger_id is auto-generated (identity column)
        await client.query(
          `INSERT INTO trn_stock_ledger 
           (fyear_id, inv_master_id, itemcode, tran_type, tran_date, unit, qty)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [fyearid, tranId, itemcode, 'PUR', trdate, unit || '', qty]
        );
      }
    }

    // 5) Mark the purchase as cost confirmed
    await client.query(
      `UPDATE tblTrnPurchase SET Costconfirmed = true WHERE TranID = $1`,
      [tranId]
    );

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to confirm costing' });
  } finally {
    client.release();
  }
});

/**
 * Insert or update a single line item for a purchase
 * Body fields expected from frontend:
 * { FYearID, Srno, ItemCode, Qty, Rate, InvAmount, OHAmt, NetRate, Rounded,
 *   CGSTAmount, SGSTAmout, IGSTAmount, GTotal, CGSTPer, SGSTPer, IGSTPer }
 */
router.post('/:tranId/items', authenticateToken, checkPermission('INVENTORY_PURCHASE_ADD'), async (req, res) => {
  const { tranId } = req.params;
  const {
    FYearID,
    Srno,
    ItemCode,
    Qty,
    Rate,
    InvAmount,
    OHAmt,
    NetRate,
    Rounded,
    CGSTAmount,
    SGSTAmout, // keep spelling consistent with frontend
    IGSTAmount,
    GTotal,
    CGSTPer,
    SGSTPer,
    IGSTPer
  } = req.body || {};



  try {
    // First, check if the table exists and has the correct structure
    const tableCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'tbltrnpurchasedet'
      ORDER BY ordinal_position
    `);
    

    
    if (tableCheck.rows.length === 0) {
      throw new Error("Table 'tbltrnpurchasedet' does not exist. Please run the database migration script.");
    }
    
    const requiredColumns = ['fyearid', 'tranmasid', 'srno', 'itemcode', 'qty', 'rate', 'invamount', 'ohamt', 'netrate', 'rounded', 'cgst', 'sgst', 'igst', 'gtotal', 'cgstp', 'sgstp', 'igstp'];
    const existingColumns = tableCheck.rows.map(r => r.column_name);
    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
    
    if (missingColumns.length > 0) {
      throw new Error(`Table 'tbltrnpurchasedet' is missing required columns: ${missingColumns.join(', ')}`);
    }

    // Ensure idempotency without relying on a DB unique constraint: delete then insert
    const deleteResult = await pool.query(`DELETE FROM tbltrnpurchasedet WHERE tranmasid = $1 AND srno = $2`, [tranId, Srno]);


    
    const insertResult = await pool.query(
      `INSERT INTO tbltrnpurchasedet
       (fyearid, tranmasid, srno, itemcode, qty, rate, invamount, ohamt, netrate, rounded,
        cgst, sgst, igst, gtotal, cgstp, sgstp, igstp)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING trid`,
      [
        FYearID,
        tranId,
        Srno,
        ItemCode,
        Qty,
        Rate,
        InvAmount,
        OHAmt,
        NetRate,
        Rounded,
        CGSTAmount,
        SGSTAmout,
        IGSTAmount,
        GTotal,
        CGSTPer,
        SGSTPer,
        IGSTPer
      ]
    );
    

    res.json({ success: true });
  } catch (err) {
    console.error("Purchase Items POST - Error:", err);
    console.error("Purchase Items POST - Error message:", err.message);
    console.error("Purchase Items POST - Error code:", err.code);
    console.error("Purchase Items POST - Error detail:", err.detail);
    console.error("Purchase Items POST - Error hint:", err.hint);
    
    // Provide more specific error messages
    let userMessage = 'Failed to save purchase item';
    if (err.message.includes('does not exist')) {
      userMessage = 'Database table missing. Please contact administrator.';
    } else if (err.message.includes('missing required columns')) {
      userMessage = 'Database structure outdated. Please contact administrator.';
    } else if (err.code === '42P01') {
      userMessage = 'Database table does not exist. Please run database migration.';
    } else if (err.code === '42703') {
      userMessage = 'Database column missing. Please update database structure.';
    }
    
    res.status(500).json({ 
      error: userMessage,
      technical_details: err.message,
      code: err.code,
      hint: err.hint
    });
  }
});

/**
 * Delete a Purchase (Header + Details)
 */
router.delete("/:tranId", authenticateToken, checkPermission('INVENTORY_PURCHASE_DELETE'), async (req, res) => {
  const { tranId } = req.params;
  try {
    await pool.query(`DELETE FROM tbltrnpurchasedet WHERE tranmasid = $1`, [tranId]);
    await pool.query(`DELETE FROM tbltrnpurchase WHERE tranid = $1`, [tranId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete purchase" });
  }
});

/**
 * Check duplicate supplier invoice number for a supplier
 * Query params: partyId, suppInvNo, excludeTranId (optional)
 * Returns: { exists: boolean, match?: { TranID, TrNo, TrDate, SuppInvNo } }
 */
router.get('/check-suppinv', async (req, res) => {
  const { partyId, suppInvNo, excludeTranId } = req.query || {};
  if (!suppInvNo || !partyId) {
    return res.json({ exists: false });
  }
  try {
    const params = [partyId, suppInvNo];
    let sql = `SELECT TranID, TrNo, TrDate, SuppInvNo
               FROM tblTrnPurchase
               WHERE PartyID = $1 AND LOWER(SuppInvNo) = LOWER($2)`;
    if (excludeTranId) {
      params.push(excludeTranId);
      sql += ` AND TranID <> $${params.length}`;
    }
    sql += ' LIMIT 1';
    const r = await pool.query(sql, params);
    if (r.rows.length > 0) {
      return res.json({ exists: true, match: r.rows[0] });
    }
    return res.json({ exists: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to check duplicate supplier invoice' });
  }
});

/**
 * Cancel a posted (but not confirmed) purchase: set flags and mark is_cancelled = true
 */
router.post('/:tranId/cancel', async (req, res) => {
  const { tranId } = req.params;
  try {
    // Cannot cancel confirmed purchases
    const r = await pool.query(`SELECT Costconfirmed FROM tblTrnPurchase WHERE TranID = $1`, [tranId]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Purchase not found' });
    if (r.rows[0].costconfirmed) return res.status(400).json({ error: 'Confirmed purchase cannot be cancelled' });

    await pool.query(
      `UPDATE tblTrnPurchase
       SET GRNPosted = false, CostSheetPrepared = false, is_cancelled = true
       WHERE TranID = $1`,
      [tranId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to cancel purchase' });
  }
});

/**
 * Set a cancelled purchase back to draft: clear is_cancelled and flags
 */
router.post('/:tranId/set-draft', async (req, res) => {
  const { tranId } = req.params;
  try {
    await pool.query(
      `UPDATE tblTrnPurchase
       SET GRNPosted = false, CostSheetPrepared = false, is_cancelled = false
       WHERE TranID = $1`,
      [tranId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to set purchase to draft' });
  }
});

/**
 * Get items purchased from a specific supplier with invoice numbers and quantities
 * Query params: partyId (required)
 * Returns: Array of items with their purchase details
 */
router.get('/supplier/:partyId/items', async (req, res) => {
  const { partyId } = req.params;
  
  if (!partyId) {
    return res.status(400).json({ error: 'Supplier ID is required' });
  }

  try {
    const result = await pool.query(
      `SELECT DISTINCT ON (pd.itemcode)
        pd.itemcode,
        i.itemname,
        i.unit,
        i.cost,
        i.cgst,
        i.sgst,
        i.igst,
        p.suppinvno,
        p.suppinvdt,
        pd.qty,
        p.tranid,
        p.trdate
       FROM tbltrnpurchasedet pd
       INNER JOIN tbltrnpurchase p ON pd.tranmasid = p.tranid
       INNER JOIN tblmasitem i ON pd.itemcode = i.itemcode
       WHERE p.partyid = $1
         AND p.is_cancelled IS NOT TRUE
       ORDER BY pd.itemcode, p.trdate DESC`,
      [partyId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch supplier items' });
  }
});

/**
 * Database migration route - fixes existing table structure
 */
router.post('/migrate/fix-tables', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    console.log('Starting database migration to fix table structure...');
    
    // Check if trid column is auto-incrementing
    const columnInfo = await client.query(`
      SELECT column_default, is_identity 
      FROM information_schema.columns 
      WHERE table_name = 'tbltrnpurchasedet' AND column_name = 'trid'
    `);
    
    console.log('Current trid column info:', columnInfo.rows[0]);
    
    if (columnInfo.rows.length > 0 && columnInfo.rows[0].is_identity !== 'YES') {
      console.log('Fixing trid column to be auto-incrementing...');
      
      // Drop and recreate the table with correct structure
      // First backup any existing data
      const backupData = await client.query('SELECT * FROM tbltrnpurchasedet');
      console.log(`Backing up ${backupData.rows.length} existing records`);
      
      // Drop the table
      await client.query('DROP TABLE IF EXISTS public.tbltrnpurchasedet CASCADE');
      
      // Recreate with correct structure
      await client.query(`
        CREATE TABLE public.tbltrnpurchasedet (
          fyearid smallint NOT NULL,
          trid bigint GENERATED ALWAYS AS IDENTITY,
          tranmasid bigint NOT NULL,
          srno bigint,
          itemcode bigint NOT NULL,
          qty numeric(12,2),
          rate numeric(12,2),
          invamount numeric(12,2),
          ohamt numeric(12,2),
          netrate numeric(12,2),
          rounded numeric(4,2),
          cgst numeric(12,2),
          sgst numeric(12,2),
          igst numeric(12,2),
          gtotal numeric(12,2),
          cgstp numeric(5,2),
          sgstp numeric(5,2),
          igstp numeric(5,2),
          created_date timestamp without time zone DEFAULT now() NOT NULL,
          edited_date timestamp without time zone DEFAULT now() NOT NULL,
          PRIMARY KEY (trid)
        )
      `);
      
      // Restore data (excluding trid since it will be auto-generated)
      for (const row of backupData.rows) {
        await client.query(`
          INSERT INTO tbltrnpurchasedet 
          (fyearid, tranmasid, srno, itemcode, qty, rate, invamount, ohamt, netrate, rounded, cgst, sgst, igst, gtotal, cgstp, sgstp, igstp)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
        `, [
          row.fyearid, row.tranmasid, row.srno, row.itemcode, row.qty, row.rate, 
          row.invamount, row.ohamt, row.netrate, row.rounded, row.cgst, row.sgst, 
          row.igst, row.gtotal, row.cgstp, row.sgstp, row.igstp
        ]);
      }
      
      console.log(`Restored ${backupData.rows.length} records with auto-incrementing trid`);
    }
    
    // Fix tbltrnpurchasecosting table if needed
    const costingColumnInfo = await client.query(`
      SELECT column_default, is_identity 
      FROM information_schema.columns 
      WHERE table_name = 'tbltrnpurchasecosting' AND column_name = 'costtrid'
    `);
    
    if (costingColumnInfo.rows.length === 0) {
      // Create the costing table if it doesn't exist
      await client.query(`
        CREATE TABLE IF NOT EXISTS public.tbltrnpurchasecosting (
          costtrid bigint GENERATED ALWAYS AS IDENTITY,
          pruchmasid bigint NOT NULL,
          ohtype character varying(100) NOT NULL,
          amount numeric(12,2) NOT NULL,
          referenceno character varying(50),
          ohdate date,
          remark character varying(200),
          created_date timestamp without time zone DEFAULT now() NOT NULL,
          edited_date timestamp without time zone DEFAULT now() NOT NULL,
          PRIMARY KEY (costtrid)
        )
      `);
    }
    
    // Create indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tbltrnpurchasedet_tranmasid ON public.tbltrnpurchasedet(tranmasid)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tbltrnpurchasedet_itemcode ON public.tbltrnpurchasedet(itemcode)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tbltrnpurchasecosting_pruchmasid ON public.tbltrnpurchasecosting(pruchmasid)`);
    
    await client.query('COMMIT');
    
    console.log('Database migration completed successfully');
    
    res.json({
      success: true,
      message: 'Database table structure fixed successfully',
      details: 'trid column is now auto-incrementing',
      timestamp: new Date().toISOString()
    });
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Database migration error:', err);
    res.status(500).json({
      success: false,
      error: 'Database migration failed',
      details: err.message,
      code: err.code
    });
  } finally {
    client.release();
  }
});

/**
 * Fix auto-increment sequence for trid column
 */
router.post('/fix/sequence', async (req, res) => {
  try {
    console.log('Fixing auto-increment sequence for trid...');
    
    // Get the current maximum trid value
    const maxResult = await pool.query('SELECT COALESCE(MAX(trid), 0) as max_trid FROM tbltrnpurchasedet');
    const maxTrid = maxResult.rows[0].max_trid;
    console.log('Current max trid:', maxTrid);
    
    // Get the sequence name for the trid column
    const seqResult = await pool.query(`
      SELECT pg_get_serial_sequence('tbltrnpurchasedet', 'trid') as sequence_name
    `);
    const sequenceName = seqResult.rows[0].sequence_name;
    console.log('Sequence name:', sequenceName);
    
    if (sequenceName) {
      // Reset the sequence to start from max_trid + 1
      const nextVal = maxTrid + 1;
      await pool.query(`SELECT setval('${sequenceName}', $1, false)`, [nextVal]);
      console.log(`Sequence reset to start from: ${nextVal}`);
      
      // Test the sequence by getting the next value
      const testResult = await pool.query(`SELECT nextval('${sequenceName}') as next_val`);
      const nextValue = testResult.rows[0].next_val;
      console.log('Next sequence value will be:', nextValue);
      
      res.json({
        success: true,
        message: 'Auto-increment sequence fixed successfully',
        max_existing_trid: maxTrid,
        sequence_name: sequenceName,
        next_trid_will_be: nextValue,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Could not find sequence for trid column'
      });
    }
    
  } catch (err) {
    console.error('Sequence fix error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fix sequence',
      details: err.message,
      code: err.code
    });
  }
});

/**
 * Simple test route to try inserting a purchase item
 */
router.post('/test/insert-item', async (req, res) => {
  try {
    console.log('Testing purchase item insert...');
    
    // Try to insert a test record
    const result = await pool.query(
      `INSERT INTO tbltrnpurchasedet
       (fyearid, tranmasid, srno, itemcode, qty, rate, invamount, ohamt, netrate, rounded,
        cgst, sgst, igst, gtotal, cgstp, sgstp, igstp)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING trid`,
      [1, 999999, 1, 1001, 1.00, 100.00, 100.00, 0.00, 100.00, 0.00, 9.00, 9.00, 0.00, 118.00, 9.00, 9.00, 0.00]
    );
    
    const newTrid = result.rows[0]?.trid;
    console.log('Insert successful, new trid:', newTrid);
    
    // Clean up - delete the test record
    await pool.query(`DELETE FROM tbltrnpurchasedet WHERE trid = $1`, [newTrid]);
    console.log('Test record cleaned up');
    
    res.json({
      success: true,
      message: 'Insert test successful',
      new_trid: newTrid,
      timestamp: new Date().toISOString()
    });
    
  } catch (err) {
    console.error('Insert test error:', err);
    res.status(500).json({
      success: false,
      error: 'Insert test failed',
      details: err.message,
      code: err.code,
      hint: err.hint
    });
  }
});

/**
 * Test route to check database table structure
 */
router.get('/test/db-structure', async (req, res) => {
  try {
    // Test if tables exist and have correct structure
    const tests = [];
    
    // Test 1: Check if tbltrnpurchasedet table exists
    try {
      const result1 = await pool.query(`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'tbltrnpurchasedet' 
        ORDER BY ordinal_position
      `);
      tests.push({
        test: 'tbltrnpurchasedet table structure',
        success: true,
        columns: result1.rows
      });
    } catch (err) {
      tests.push({
        test: 'tbltrnpurchasedet table structure',
        success: false,
        error: err.message
      });
    }
    
    // Test 2: Check if tbltrnpurchasecosting table exists
    try {
      const result2 = await pool.query(`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'tbltrnpurchasecosting' 
        ORDER BY ordinal_position
      `);
      tests.push({
        test: 'tbltrnpurchasecosting table structure',
        success: true,
        columns: result2.rows
      });
    } catch (err) {
      tests.push({
        test: 'tbltrnpurchasecosting table structure',
        success: false,
        error: err.message
      });
    }
    
    // Test 3: Try a simple insert/delete to tbltrnpurchasedet
    try {
      await pool.query(`
        INSERT INTO tbltrnpurchasedet 
        (fyearid, tranmasid, srno, itemcode, qty, rate, invamount, ohamt, netrate, rounded, cgst, sgst, igst, gtotal, cgstp, sgstp, igstp)
        VALUES (1, 999999, 1, 1001, 1.00, 100.00, 100.00, 0.00, 100.00, 0.00, 9.00, 9.00, 0.00, 118.00, 9.00, 9.00, 0.00)
      `);
      
      await pool.query(`DELETE FROM tbltrnpurchasedet WHERE tranmasid = 999999 AND srno = 1`);
      
      tests.push({
        test: 'tbltrnpurchasedet insert/delete',
        success: true,
        message: 'Insert and delete operations successful'
      });
    } catch (err) {
      tests.push({
        test: 'tbltrnpurchasedet insert/delete',
        success: false,
        error: err.message,
        code: err.code
      });
    }
    
    res.json({
      message: 'Database structure test completed',
      tests: tests,
      timestamp: new Date().toISOString()
    });
    
  } catch (err) {
    console.error('Database test error:', err);
    res.status(500).json({
      error: 'Database test failed',
      details: err.message
    });
  }
});

module.exports = router;  
