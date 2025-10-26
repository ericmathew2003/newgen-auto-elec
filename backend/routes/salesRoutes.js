const express = require("express");
const router = express.Router();
const pool = require("../db");

/**
 * SALES ROUTES aligned to new schema:
 * Tables:
 *  - public.trn_invoice_master (PK: inv_master_id identity)
 *  - public.trn_invoice_detail (PK: inv_detail_id identity, FK: inv_master_id)
 */

// Helper to normalize empty strings to null (for bigint/numeric/date)
const nn = (v) => (v === undefined || v === null || String(v).trim() === "" ? null : v);

// Create Sales Invoice (Header Only) with atomic invoice number assignment
router.post("/", async (req, res) => {
  const {
    fyear_id,
    inv_no,
    inv_date,
    ref_no,
    party_id,
    customer_name,
    account_id,
    taxable_tot = 0,
    dis_perc = 0,
    dis_amount = 0,
    misc_per_add = 0,
    misc_amount_add = 0,
    tot_avg_cost = 0,
    tot_amount = 0,
    cgst_amount = 0,
    sgst_amount = 0,
    igst_amount = 0,
    description = "",
    is_posted = false,
    is_deleted = false,
  } = req.body || {};

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // If inv_no is missing or marked as 'NEW', allocate the next number atomically
    let invNoToUse = inv_no;
    const needsAutoNumber = inv_no === undefined || inv_no === null || String(inv_no).trim() === "" || String(inv_no).toUpperCase() === "NEW";
    if (needsAutoNumber) {
      await client.query("LOCK TABLE public.trn_invoice_master IN EXCLUSIVE MODE");
      const sql = fyear_id
        ? `SELECT COALESCE(MAX(inv_no), 0) + 1 AS next_no FROM public.trn_invoice_master WHERE fyear_id = $1`
        : `SELECT COALESCE(MAX(inv_no), 0) + 1 AS next_no FROM public.trn_invoice_master`;
      const params = fyear_id ? [fyear_id] : [];
      const r = await client.query(sql, params);
      invNoToUse = r.rows[0]?.next_no || 1;
    }

    const result = await client.query(
      `INSERT INTO public.trn_invoice_master
       (fyear_id, inv_no, inv_date, ref_no, party_id, customer_name, account_id,
        taxable_tot, dis_perc, dis_amount, misc_per_add, misc_amount_add, tot_avg_cost, tot_amount, rounded_off,
        cgst_amount, sgst_amount, igst_amount, description, is_posted, is_deleted)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
       RETURNING inv_master_id, inv_no`,
      [
        nn(fyear_id),
        nn(invNoToUse),
        nn(inv_date),
        nn(ref_no),
        nn(party_id),
        customer_name ?? null,
        nn(account_id),
        nn(taxable_tot),
        nn(dis_perc),
        nn(dis_amount),
        nn(misc_per_add),
        nn(misc_amount_add),
        nn(tot_avg_cost),
        nn(tot_amount),
        nn(req.body?.rounded_off ?? 0),
        nn(cgst_amount),
        nn(sgst_amount),
        nn(igst_amount),
        description ?? "",
        !!is_posted,
        !!is_deleted,
      ]
    );

    await client.query("COMMIT");
    res.json({ success: true, inv_master_id: result.rows[0]?.inv_master_id, inv_no: result.rows[0]?.inv_no });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Failed to create sales invoice" });
  } finally {
    client.release();
  }
});

// Update Sales Invoice (Header Only)
router.put("/:invMasterId", async (req, res) => {
  const { invMasterId } = req.params;
  if (!/^\d+$/.test(String(invMasterId))) {
    return res.status(400).json({ error: "Invalid invoice id" });
  }
  const {
    fyear_id,
    inv_no,
    inv_date,
    ref_no,
    party_id,
    customer_name,
    account_id,
    taxable_tot = 0,
    dis_perc = 0,
    dis_amount = 0,
    misc_per_add = 0,
    misc_amount_add = 0,
    tot_avg_cost = 0,
    tot_amount = 0,
    cgst_amount = 0,
    sgst_amount = 0,
    igst_amount = 0,
    description = "",
    is_posted = false,
    is_deleted = false,
  } = req.body || {};

  try {
    await pool.query(
      `UPDATE public.trn_invoice_master
       SET fyear_id=$1, inv_no=$2, inv_date=$3, ref_no=$4, party_id=$5, customer_name=$6,
           account_id=$7, taxable_tot=$8, dis_perc=$9, dis_amount=$10, misc_per_add=$11, misc_amount_add=$12,
           tot_avg_cost=$13, tot_amount=$14, rounded_off=$15, cgst_amount=$16, sgst_amount=$17, igst_amount=$18,
           description=$19, is_posted=$20, is_deleted=$21
       WHERE inv_master_id=$22`,
      [
        nn(fyear_id),
        nn(inv_no),
        nn(inv_date),
        nn(ref_no),
        nn(party_id),
        customer_name ?? null,
        nn(account_id),
        nn(taxable_tot),
        nn(dis_perc),
        nn(dis_amount),
        nn(misc_per_add),
        nn(misc_amount_add),
        nn(tot_avg_cost),
        nn(tot_amount),
        nn(req.body?.rounded_off ?? 0),
        nn(cgst_amount),
        nn(sgst_amount),
        nn(igst_amount),
        description ?? "",
        !!is_posted,
        !!is_deleted,
        invMasterId,
      ]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update sales invoice" });
  }
});

// Get next invoice number atomically (per Financial Year)
router.get("/next-invno", async (req, res) => {
  const { fyearId } = req.query || {};
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Use a lock to reflect the number that will be used if an insert happens now
    await client.query("LOCK TABLE public.trn_invoice_master IN EXCLUSIVE MODE");
    const sql = fyearId
      ? `SELECT COALESCE(MAX(inv_no), 0) + 1 AS next_no FROM public.trn_invoice_master WHERE fyear_id = $1`
      : `SELECT COALESCE(MAX(inv_no), 0) + 1 AS next_no FROM public.trn_invoice_master`;
    const params = fyearId ? [fyearId] : [];
    const r = await client.query(sql, params);
    await client.query("COMMIT");
    res.json({ next_inv_no: String(r.rows[0]?.next_no || 1) });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Failed to compute next invoice number" });
  } finally {
    client.release();
  }
});

// Test endpoint to verify API is working
router.get("/report-test", async (req, res) => {
  try {
    res.json({
      message: "Report API is working",
      timestamp: new Date().toISOString(),
      query: req.query
    });
  } catch (err) {
    res.status(500).json({ error: "Test failed", details: err.message });
  }
});

// Get Sales Summary Data for Sales Summary Report
router.get("/summary", async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;

    console.log("Sales summary endpoint called with:", { fromDate, toDate });

    if (!fromDate || !toDate) {
      console.log("Missing dates - fromDate:", fromDate, "toDate:", toDate);
      return res.status(400).json({ error: "fromDate and toDate are required" });
    }

    const query = `
      SELECT 
        m.inv_master_id,
        m.inv_no,
        m.inv_date,
        COALESCE(p.partyname, m.customer_name) as customer_name,
        m.taxable_tot,
        m.cgst_amount,
        m.sgst_amount,
        m.igst_amount,
        m.rounded_off,
        m.tot_amount,
        m.is_posted
      FROM public.trn_invoice_master m
      LEFT JOIN public.tblmasparty p ON p.partyid = m.party_id
      WHERE m.inv_date >= $1 AND m.inv_date <= $2
        AND m.is_deleted = false
      ORDER BY m.inv_date, m.inv_no
    `;

    console.log("Executing sales summary query with params:", [fromDate, toDate]);

    try {
      const result = await pool.query(query, [fromDate, toDate]);
      console.log("Sales summary query executed successfully, result count:", result.rows.length);
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
    console.error("Error fetching sales summary:", err.message);
    console.error("Full error:", err);
    res.status(500).json({
      error: "Server Error",
      details: err.message,
      query_params: { fromDate, toDate }
    });
  }
});

// Get Sales Report Data for GST Invoice Report
router.get("/report", async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;

    console.log("Report endpoint called with:", { fromDate, toDate });
    console.log("fromDate type:", typeof fromDate, "value:", fromDate);
    console.log("toDate type:", typeof toDate, "value:", toDate);

    if (!fromDate || !toDate) {
      console.log("Missing dates - fromDate:", fromDate, "toDate:", toDate);
      return res.status(400).json({ error: "fromDate and toDate are required" });
    }

    const query = `
      SELECT 
        m.inv_no as invoice_no,
        m.inv_date as invoice_date,
        COALESCE(p.partyname, m.customer_name) as customer_name,
        i.hsncode as hsn_code,
        i.itemname as item_name,
        d.qty,
        d.rate,
        d.taxable_rate as taxable_amount,
        d.cgst_per,
        d.cgst_amount,
        d.sgst_per,
        d.sgst_amount,
        d.igst_per,
        d.igst_amount,
        d.tot_amount as total_amount
      FROM public.trn_invoice_master m
      LEFT JOIN public.trn_invoice_detail d ON m.inv_master_id = d.inv_master_id
      LEFT JOIN public.tblmasitem i ON d.itemcode = i.itemcode
      LEFT JOIN public.tblmasparty p ON p.partyid = m.party_id
      WHERE m.inv_date >= $1 AND m.inv_date <= $2
        AND m.is_deleted = false
      ORDER BY m.inv_date, m.inv_no, d.srno
    `;

    console.log("Executing query with params:", [fromDate, toDate]);
    console.log("Query:", query);

    try {
      const result = await pool.query(query, [fromDate, toDate]);
      console.log("Query executed successfully, result count:", result.rows.length);
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
    console.error("Error fetching sales report:", err.message);
    console.error("Full error:", err);
    res.status(500).json({
      error: "Server Error",
      details: err.message,
      query_params: { fromDate, toDate }
    });
  }
});

// Get list of Sales
router.get("/", async (req, res) => {
  const { fromDate, toDate, partyId, fyearId } = req.query || {};
  const where = [];
  const params = [];
  if (fromDate) { params.push(fromDate); where.push(`m.inv_date >= $${params.length}`); }
  if (toDate) { params.push(toDate); where.push(`m.inv_date <= $${params.length}`); }
  if (partyId) { params.push(partyId); where.push(`m.party_id = $${params.length}`); }
  if (fyearId) { params.push(fyearId); where.push(`m.fyear_id = $${params.length}`); }
  const filter = where.length ? `WHERE ${where.join(" AND ")}` : "";

  try {
    const r = await pool.query(
      `SELECT m.inv_master_id, m.inv_no, m.inv_date,
              COALESCE(p.partyname, m.customer_name) AS customer_name,
              m.taxable_tot, m.cgst_amount, m.sgst_amount, m.igst_amount, m.tot_amount, m.rounded_off,
              m.is_posted
       FROM public.trn_invoice_master m
       LEFT JOIN public.tblmasparty p ON p.partyid = m.party_id
       ${filter}
       ORDER BY m.inv_date DESC`,
      params
    );
    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch sales" });
  }
});

// Test endpoint to verify API is working
router.get("/report-test", async (req, res) => {
  try {
    res.json({
      message: "Report API is working",
      timestamp: new Date().toISOString(),
      query: req.query
    });
  } catch (err) {
    res.status(500).json({ error: "Test failed", details: err.message });
  }
});

// Get single Sale (Header + Details)
router.get("/:invMasterId", async (req, res) => {
  const { invMasterId } = req.params;
  if (!/^\d+$/.test(String(invMasterId))) {
    return res.status(400).json({ error: "Invalid invoice id" });
  }
  try {
    // Header with linked party details
    const hdr = await pool.query(
      `SELECT m.*, p.partyname, p.address1, p.contactno, p.gstnum
       FROM public.trn_invoice_master m
       LEFT JOIN public.tblmasparty p ON p.partyid = m.party_id
       WHERE m.inv_master_id=$1`,
      [invMasterId]
    );
    // Details with item name and HSN code
    const det = await pool.query(
      `SELECT d.*, i.itemname, i.hsncode
       FROM public.trn_invoice_detail d
       LEFT JOIN public.tblmasitem i ON i.itemcode = d.itemcode
       WHERE d.inv_master_id=$1
       ORDER BY d.srno`,
      [invMasterId]
    );
    res.json({ header: hdr.rows[0], details: det.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch sales invoice" });
  }
});

// Replace all detail rows for a sale
// Body: { items: [{ fyear_id, srno, itemcode, unit, qty, avg_cost, taxable_rate, cgst_per, sgst_per, igst_per,
//                   cgst_amount, sgst_amount, igst_amount, rate, dis_per, dis_amount, tot_amount, description, is_deleted }] }
router.post("/:invMasterId/items/replace", async (req, res) => {
  const { invMasterId } = req.params;
  const { items = [] } = req.body || {};
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM public.trn_invoice_detail WHERE inv_master_id=$1`, [invMasterId]);

    for (const it of items) {
      await client.query(
        `INSERT INTO public.trn_invoice_detail
         (fyear_id, inv_master_id, srno, itemcode, unit, qty, avg_cost, taxable_rate,
          cgst_per, sgst_per, igst_per, cgst_amount, sgst_amount, igst_amount,
          rate, dis_per, dis_amount, tot_amount, description, is_deleted)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
        [
          nn(it.fyear_id),
          invMasterId,
          nn(it.srno),
          nn(it.itemcode),
          it.unit ?? null,
          nn(it.qty ?? 0),
          nn(it.avg_cost ?? 0),
          nn(it.taxable_rate ?? 0),
          nn(it.cgst_per ?? 0),
          nn(it.sgst_per ?? 0),
          nn(it.igst_per ?? 0),
          nn(it.cgst_amount ?? 0),
          nn(it.sgst_amount ?? 0),
          nn(it.igst_amount ?? 0),
          nn(it.rate ?? 0),
          nn(it.dis_per ?? 0),
          nn(it.dis_amount ?? 0),
          nn(it.tot_amount ?? 0),
          it.description ?? "",
          !!it.is_deleted,
        ]
      );
    }

    const sumRes = await client.query(`SELECT COALESCE(SUM(avg_cost),0) AS tot FROM public.trn_invoice_detail WHERE inv_master_id=$1`, [invMasterId]);
    await client.query(`UPDATE public.trn_invoice_master SET tot_avg_cost=$2 WHERE inv_master_id=$1`, [invMasterId, sumRes.rows[0]?.tot ?? 0]);
    await client.query("COMMIT");
    res.json({ success: true, count: items.length });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Failed to replace sales items" });
  } finally {
    client.release();
  }
});

// Delete sales invoice (header + details)
router.delete("/:invMasterId", async (req, res) => {
  const { invMasterId } = req.params;
  if (!/^\d+$/.test(String(invMasterId))) {
    return res.status(400).json({ error: "Invalid invoice id" });
  }
  try {
    await pool.query(`DELETE FROM public.trn_invoice_detail WHERE inv_master_id=$1`, [invMasterId]);
    await pool.query(`DELETE FROM public.trn_invoice_master WHERE inv_master_id=$1`, [invMasterId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete sales invoice" });
  }
});

// Mark sales invoice as posted (locked) + create accounting and stock ledger entries atomically
router.post("/:invMasterId/post", async (req, res) => {
  const { invMasterId } = req.params;
  const client = await pool.connect();
  const num = (v) => parseFloat(v ?? 0) || 0; // safe numeric coercion
  try {
    await client.query("BEGIN");

    // Fetch invoice master
    const hdrRes = await client.query(
      `SELECT inv_master_id, fyear_id, inv_no, inv_date, party_id, customer_name, account_id,
              taxable_tot, cgst_amount, sgst_amount, igst_amount, tot_amount, rounded_off, is_posted
         FROM public.trn_invoice_master WHERE inv_master_id=$1`,
      [invMasterId]
    );
    const m = hdrRes.rows[0];
    if (!m) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Invoice not found" });
    }

    // Prevent duplicates: already posted
    if (m.is_posted) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Invoice already posted" });
    }

    const totAmount = num(m.tot_amount);
    const roundOff = num(m.rounded_off);
    const taxableTot = num(m.taxable_tot);
    const cgstAmt = num(m.cgst_amount);
    const sgstAmt = num(m.sgst_amount);
    const igstAmt = num(m.igst_amount);
    const finalTotal = totAmount + roundOff; // final invoice amount

    // Note: acc_trn_invoice and journal table updates removed as requested

    // Note: Journal entries and ledger entries removed as requested

    // Stock ledger (per item detail; negative quantity for sales)
    const detRes = await client.query(
      `SELECT inv_detail_id, itemcode, unit, qty, fyear_id FROM public.trn_invoice_detail WHERE inv_master_id=$1 ORDER BY srno`,
      [invMasterId]
    );
    for (const d of detRes.rows) {
      const qty = num(d.qty);
      const qtyNeg = -1 * qty;
      // Insert stock ledger with negative quantity for sale
      await client.query(
        `INSERT INTO public.trn_stock_ledger
           (fyear_id, inv_master_id, inv_detail_id, itemcode, tran_type, tran_date, unit, qty)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [m.fyear_id ?? d.fyear_id ?? null, invMasterId, d.inv_detail_id, d.itemcode, 'Sale', m.inv_date, d.unit, qtyNeg]
      );
      // Decrease current stock in item master
      await client.query(
        `UPDATE public.tblmasitem
           SET curstock = COALESCE(curstock, 0) - $1
         WHERE itemcode = $2`,
        [qty, d.itemcode]
      );
    }

    // Mark as posted
    await client.query(`UPDATE public.trn_invoice_master SET is_posted = TRUE WHERE inv_master_id = $1`, [invMasterId]);

    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Failed to post sales invoice" });
  } finally {
    client.release();
  }
});



/**
 * Fix auto-increment sequence for inv_master_id column
 */
router.post('/fix/sequence', async (req, res) => {
  try {
    console.log('Fixing auto-increment sequence for inv_master_id...');

    // Get the current maximum inv_master_id value
    const maxResult = await pool.query('SELECT COALESCE(MAX(inv_master_id), 0) as max_id FROM trn_invoice_master');
    const maxId = maxResult.rows[0].max_id;
    console.log('Current max inv_master_id:', maxId);

    // Get the sequence name for the inv_master_id column
    const seqResult = await pool.query(`
      SELECT pg_get_serial_sequence('trn_invoice_master', 'inv_master_id') as sequence_name
    `);
    const sequenceName = seqResult.rows[0].sequence_name;
    console.log('Sequence name:', sequenceName);

    if (sequenceName) {
      // Reset the sequence to start from max_id + 1
      const nextVal = maxId + 1;
      await pool.query(`SELECT setval('${sequenceName}', $1, false)`, [nextVal]);
      console.log(`Sequence reset to start from: ${nextVal}`);

      // Test the sequence by getting the next value
      const testResult = await pool.query(`SELECT nextval('${sequenceName}') as next_val`);
      const nextValue = testResult.rows[0].next_val;
      console.log('Next sequence value will be:', nextValue);

      res.json({
        success: true,
        message: 'Sales invoice auto-increment sequence fixed successfully',
        max_existing_id: maxId,
        sequence_name: sequenceName,
        next_id_will_be: nextValue,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Could not find sequence for inv_master_id column'
      });
    }

  } catch (err) {
    console.error('Sales sequence fix error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fix sales sequence',
      details: err.message,
      code: err.code
    });
  }
});

module.exports = router;