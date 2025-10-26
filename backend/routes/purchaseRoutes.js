const express = require("express");
const router = express.Router();
const pool = require("../db");

/**
 * Create Purchase Invoice (Header Only)
 */
router.post("/", async (req, res) => {
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
router.put("/:tranId", async (req, res) => {
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
router.get("/summary", async (req, res) => {
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
router.get("/", async (req, res) => {
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
router.get("/:tranId", async (req, res) => {
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
router.get('/:tranId/costing', async (req, res) => {
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
router.put('/:tranId/costing', async (req, res) => {
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
router.post('/:tranId/costing/confirm', async (req, res) => {
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
router.post('/:tranId/items', async (req, res) => {
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

  console.log("Purchase Items POST - Request data:", {
    tranId, FYearID, Srno, ItemCode, Qty, Rate, InvAmount, OHAmt, NetRate, Rounded,
    CGSTAmount, SGSTAmout, IGSTAmount, GTotal, CGSTPer, SGSTPer, IGSTPer
  });

  try {
    // Ensure idempotency without relying on a DB unique constraint: delete then insert
    await pool.query(`DELETE FROM tbltrnpurchasedet WHERE tranmasid = $1 AND srno = $2`, [tranId, Srno]);

    await pool.query(
      `INSERT INTO tbltrnpurchasedet
       (fyearid, tranmasid, srno, itemcode, qty, rate, invamount, ohamt, netrate, rounded,
        cgst, sgst, igst, gtotal, cgstp, sgstp, igstp)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
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

    console.log("Purchase Items POST - Successfully inserted item");
    res.json({ success: true });
  } catch (err) {
    console.error("Purchase Items POST - Error:", err);
    console.error("Purchase Items POST - Error message:", err.message);
    console.error("Purchase Items POST - Error code:", err.code);
    res.status(500).json({ 
      error: 'Failed to save purchase item',
      details: err.message,
      code: err.code
    });
  }
});

/**
 * Delete a Purchase (Header + Details)
 */
router.delete("/:tranId", async (req, res) => {
  const { tranId } = req.params;
  try {
    await pool.query(`DELETE FROM tbltrnpurchasedet WHERE tranmasid = $1`, [tranId]);
    await pool.query(`DELETE FROM tblTrnPurchase WHERE TranID = $1`, [tranId]);
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

module.exports = router;  
