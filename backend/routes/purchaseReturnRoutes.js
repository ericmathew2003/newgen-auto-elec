const express = require("express");
const router = express.Router();
const pool = require("../db");

// Helper to normalize empty strings to null (for bigint/numeric/date)
const nn = (v) => (v === undefined || v === null || String(v).trim() === "" ? null : v);

// Get list of Purchase Returns
router.get("/", async (req, res) => {
  const { fromDate, toDate, partyId, fyearId } = req.query || {};
  const where = [];
  const params = [];
  if (fromDate) { params.push(fromDate); where.push(`m.tran_date >= $${params.length}`); }
  if (toDate)   { params.push(toDate);   where.push(`m.tran_date <= $${params.length}`); }
  if (partyId)  { params.push(partyId);  where.push(`m.party_id = $${params.length}`); }
  if (fyearId)  { params.push(fyearId);  where.push(`m.fyear_id = $${params.length}`); }
  const filter = where.length ? `WHERE ${where.join(" AND ")}` : "";

  try {
    const r = await pool.query(
      `SELECT m.pret_id, m.pret_id as purch_ret_id, m.purch_ret_no, m.tran_date,
              p.partyname,
              m.taxable_total, m.cgst_amount, m.sgst_amount, m.igst_amount, m.rounded_off, m.total_amount,
              m.is_posted
       FROM trn_purchase_return_master m
       LEFT JOIN tblmasparty p ON p.partyid = m.party_id
       ${filter}
       ORDER BY m.tran_date DESC`,
      params
    );
    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch purchase returns" });
  }
});

// Get next purchase return number
router.get("/next-number", async (req, res) => {
  try {
    const selectedFYearID = req.query.fyear_id;
    console.log("Backend: Generating next number for fyear_id:", selectedFYearID);
    
    const sql = selectedFYearID
      ? `SELECT COALESCE(MAX(purch_ret_no), 0) + 1 AS next_no FROM trn_purchase_return_master WHERE fyear_id = $1`
      : `SELECT COALESCE(MAX(purch_ret_no), 0) + 1 AS next_no FROM trn_purchase_return_master`;
    const params = selectedFYearID ? [selectedFYearID] : [];
    
    console.log("Backend: SQL query:", sql);
    console.log("Backend: Query params:", params);
    
    const result = await pool.query(sql, params);
    const next_no = result.rows[0]?.next_no || 1;
    
    console.log("Backend: Query result:", result.rows[0]);
    console.log("Backend: Returning next_no:", next_no);
    
    res.json({ next_no });
  } catch (err) {
    console.error("Backend: Error in next-number:", err);
    res.status(500).json({ error: "Failed to generate next purchase return number" });
  }
});

// Get single Purchase Return (Header + Details)
router.get("/:purchRetId", async (req, res) => {
  const { purchRetId } = req.params;
  if (!/^\d+$/.test(String(purchRetId))) {
    return res.status(400).json({ error: "Invalid purchase return id" });
  }
  try {
    // Header with linked party details
    const hdr = await pool.query(
      `SELECT m.*, p.partyname, p.address1, p.contactno, p.gstnum
       FROM trn_purchase_return_master m
       LEFT JOIN tblmasparty p ON p.partyid = m.party_id
       WHERE m.pret_id=$1`,
      [purchRetId]
    );
    // Details with item name and HSN code
    const det = await pool.query(
      `SELECT d.*, i.itemname, i.hsncode, i.unit
       FROM trn_purchase_return_detail d
       LEFT JOIN tblmasitem i ON i.itemcode = d.item_code
       WHERE d.pret_mas_id=$1
       ORDER BY d.srno`,
      [purchRetId]
    );
    res.json({ header: hdr.rows[0], details: det.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch purchase return" });
  }
});

// Create Purchase Return (Header + Items) with atomic number assignment
router.post("/", async (req, res) => {
  const { header = {}, items = [] } = req.body || {};
  const {
    fyear_id,
    purch_ret_no,
    tran_date,
    party_id,
    remark,
    taxable_total = 0,
    cgst_amount = 0,
    sgst_amount = 0,
    igst_amount = 0,
    rounded_off = 0,
    total_amount = 0,
    is_posted = false,
    deleted = false,
  } = header;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // If purch_ret_no is missing or marked as 'NEW', allocate the next number atomically
    let retNoToUse = purch_ret_no;
    console.log("Backend CREATE: Received purch_ret_no:", purch_ret_no);
    
    const needsAutoNumber = purch_ret_no === undefined || purch_ret_no === null || String(purch_ret_no).trim() === "" || String(purch_ret_no).toUpperCase() === "NEW";
    console.log("Backend CREATE: needsAutoNumber:", needsAutoNumber);
    
    if (needsAutoNumber) {
      await client.query("LOCK TABLE trn_purchase_return_master IN EXCLUSIVE MODE");
      const sql = fyear_id
        ? `SELECT COALESCE(MAX(purch_ret_no), 0) + 1 AS next_no FROM trn_purchase_return_master WHERE fyear_id = $1`
        : `SELECT COALESCE(MAX(purch_ret_no), 0) + 1 AS next_no FROM trn_purchase_return_master`;
      const params = fyear_id ? [fyear_id] : [];
      console.log("Backend CREATE: Auto-number SQL:", sql);
      console.log("Backend CREATE: Auto-number params:", params);
      
      const r = await client.query(sql, params);
      retNoToUse = r.rows[0]?.next_no || 1;
      console.log("Backend CREATE: Auto-generated number:", retNoToUse);
    }
    
    console.log("Backend CREATE: Final retNoToUse:", retNoToUse);

    const result = await client.query(
      `INSERT INTO trn_purchase_return_master
       (fyear_id, purch_ret_no, tran_date, party_id, remark,
        taxable_total, cgst_amount, sgst_amount, igst_amount, rounded_off, total_amount, is_posted, deleted)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING pret_id, purch_ret_no`,
      [
        nn(fyear_id),
        nn(retNoToUse),
        nn(tran_date),
        nn(party_id),
        nn(remark),
        nn(taxable_total),
        nn(cgst_amount),
        nn(sgst_amount),
        nn(igst_amount),
        nn(rounded_off),
        nn(total_amount),
        !!is_posted,
        !!deleted,
      ]
    );

    const pret_id = result.rows[0]?.pret_id;

    // Insert items
    for (const it of items) {
      await client.query(
        `INSERT INTO trn_purchase_return_detail
         (fyear_id, pret_mas_id, srno, item_code, qty, taxable_rate, taxable_amount,
          cgst_per, sgst_per, igst_per, cgst_amount, sgst_amount, igst_amount, 
          oh_amt, netrate, rounded_off, total_amount, supp_inv_no, supp_inv_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
        [
          nn(fyear_id),
          pret_id,
          nn(it.srno),
          nn(it.itemcode),
          nn(it.qty ?? 0),
          nn(it.rate ?? 0),
          nn(it.taxable_amount ?? 0),
          nn(it.cgst_per ?? 0),
          nn(it.sgst_per ?? 0),
          nn(it.igst_per ?? 0),
          nn(it.cgst_amount ?? 0),
          nn(it.sgst_amount ?? 0),
          nn(it.igst_amount ?? 0),
          nn(it.oh_amt ?? 0),
          nn(it.netrate ?? 0),
          nn(it.rounded_off ?? 0),
          nn(it.total_amount ?? 0),
          it.supp_inv_no ?? null,
          nn(it.supp_inv_date),
        ]
      );
    }

    await client.query("COMMIT");
    
    const savedReturnNo = result.rows[0]?.purch_ret_no;
    console.log("Backend CREATE: Saved return number:", savedReturnNo);
    
    const response = { 
      success: true, 
      pret_id, 
      purch_ret_id: pret_id, // Alias for frontend compatibility
      purch_ret_no: savedReturnNo 
    };
    
    console.log("Backend CREATE: Sending response:", response);
    res.json(response);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Failed to create purchase return" });
  } finally {
    client.release();
  }
});

// Update Purchase Return (Header Only)
router.put("/:purchRetId", async (req, res) => {
  const { purchRetId } = req.params;
  if (!/^\d+$/.test(String(purchRetId))) {
    return res.status(400).json({ error: "Invalid purchase return id" });
  }
  const {
    fyear_id,
    purch_ret_no,
    tran_date,
    party_id,
    remark,
    taxable_total = 0,
    cgst_amount = 0,
    sgst_amount = 0,
    igst_amount = 0,
    rounded_off = 0,
    total_amount = 0,
    is_posted = false,
    deleted = false,
  } = req.body || {};

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existing = await client.query(
      `SELECT is_posted FROM trn_purchase_return_master WHERE pret_id=$1 FOR UPDATE`,
      [purchRetId]
    );

    if (existing.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Purchase return not found" });
    }

    const wasPosted = !!existing.rows[0].is_posted;

    await client.query(
      `UPDATE trn_purchase_return_master
       SET fyear_id=$1, tran_date=$2, party_id=$3, remark=$4,
           taxable_total=$5, cgst_amount=$6, sgst_amount=$7, igst_amount=$8, rounded_off=$9, total_amount=$10, is_posted=$11, deleted=$12
       WHERE pret_id=$13`,
      [
        nn(fyear_id),
        nn(tran_date),
        nn(party_id),
        nn(remark),
        nn(taxable_total),
        nn(cgst_amount),
        nn(sgst_amount),
        nn(igst_amount),
        nn(rounded_off),
        nn(total_amount),
        !!is_posted,
        !!deleted,
        purchRetId,
      ]
    );

    const nowPosted = !!is_posted;

    if (!wasPosted && nowPosted) {
      await client.query(`CALL post_purchase_return($1)`, [purchRetId]);
    }

    await client.query("COMMIT");
    res.json({ success: true, posted: nowPosted });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Failed to update purchase return" });
  } finally {
    client.release();
  }
});

// Replace all detail rows for a purchase return
router.post("/:purchRetId/items/replace", async (req, res) => {
  const { purchRetId } = req.params;
  const { items = [], fyear_id } = req.body || {};
  
  if (!fyear_id) {
    return res.status(400).json({ error: "fyear_id is required" });
  }
  
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM trn_purchase_return_detail WHERE pret_mas_id=$1`, [purchRetId]);

    for (const it of items) {
      await client.query(
        `INSERT INTO trn_purchase_return_detail
         (fyear_id, pret_mas_id, srno, item_code, qty, taxable_rate, taxable_amount,
          cgst_per, sgst_per, igst_per, cgst_amount, sgst_amount, igst_amount, 
          oh_amt, netrate, rounded_off, total_amount, supp_inv_no, supp_inv_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
        [
          nn(fyear_id),
          purchRetId,
          nn(it.srno),
          nn(it.itemcode),
          nn(it.qty ?? 0),
          nn(it.rate ?? 0),
          nn(it.taxable_amount ?? 0),
          nn(it.cgst_per ?? 0),
          nn(it.sgst_per ?? 0),
          nn(it.igst_per ?? 0),
          nn(it.cgst_amount ?? 0),
          nn(it.sgst_amount ?? 0),
          nn(it.igst_amount ?? 0),
          nn(it.oh_amt ?? 0),
          nn(it.netrate ?? 0),
          nn(it.rounded_off ?? 0),
          nn(it.total_amount ?? 0),
          it.supp_inv_no ?? null,
          nn(it.supp_inv_date),
        ]
      );
    }

    await client.query("COMMIT");
    res.json({ success: true, count: items.length });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Failed to replace purchase return items" });
  } finally {
    client.release();
  }
});

// Delete purchase return (header + details)
router.delete("/:purchRetId", async (req, res) => {
  const { purchRetId } = req.params;
  if (!/^\d+$/.test(String(purchRetId))) {
    return res.status(400).json({ error: "Invalid purchase return id" });
  }
  try {
    await pool.query(`DELETE FROM trn_purchase_return_detail WHERE pret_mas_id=$1`, [purchRetId]);
    await pool.query(`DELETE FROM trn_purchase_return_master WHERE pret_id=$1`, [purchRetId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete purchase return" });
  }
});

module.exports = router;