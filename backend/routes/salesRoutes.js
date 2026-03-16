const express = require("express");
const router = express.Router();
const pool = require("../db");
const { checkPeriodStatus, checkPeriodStatusForUpdate } = require("../middleware/checkPeriodStatus");

/**
 * SALES ROUTES aligned to new schema:
 * Tables:
 *  - public.trn_invoice_master (PK: inv_master_id identity)
 *  - public.trn_invoice_detail (PK: inv_detail_id identity, FK: inv_master_id)
 */

// Helper to normalize empty strings to null (for bigint/numeric/date)
const nn = (v) => (v === undefined || v === null || String(v).trim() === "" ? null : v);

// Create Sales Invoice (Header Only) with atomic invoice number assignment
router.post("/", checkPeriodStatus, async (req, res) => {
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
    is_confirmed = false,
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
        cgst_amount, sgst_amount, igst_amount, description, is_posted, is_confirmed, is_deleted)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
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
        !!is_confirmed,
        !!is_deleted,
      ]
    );

    await client.query("COMMIT");
    res.json({ success: true, inv_master_id: result.rows[0]?.inv_master_id, inv_no: result.rows[0]?.inv_no });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Failed to create sales invoice" });
  } finally {
    client.release();
  }
});

// Update Sales Invoice (Header Only)
router.put("/:invMasterId", checkPeriodStatusForUpdate, async (req, res) => {
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
    is_confirmed = false,
    is_deleted = false,
  } = req.body || {};

  try {
    await pool.query(
      `UPDATE public.trn_invoice_master
       SET fyear_id=$1, inv_no=$2, inv_date=$3, ref_no=$4, party_id=$5, customer_name=$6,
           account_id=$7, taxable_tot=$8, dis_perc=$9, dis_amount=$10, misc_per_add=$11, misc_amount_add=$12,
           tot_avg_cost=$13, tot_amount=$14, rounded_off=$15, cgst_amount=$16, sgst_amount=$17, igst_amount=$18,
           description=$19, is_posted=$20, is_confirmed=$21, is_deleted=$22
       WHERE inv_master_id=$23`,
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
        !!is_confirmed,
        !!is_deleted,
        invMasterId,
      ]
    );
    res.json({ success: true });
  } catch (err) {
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

    if (!fromDate || !toDate) {
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
        m.is_posted,
        m.is_confirmed
      FROM public.trn_invoice_master m
      LEFT JOIN public.tblmasparty p ON p.partyid = m.party_id
      WHERE m.inv_date >= $1 AND m.inv_date <= $2
        AND m.is_deleted = false
      ORDER BY m.inv_date, m.inv_no
    `;

    try {
      const result = await pool.query(query, [fromDate, toDate]);
      res.json(result.rows);
    } catch (queryError) {
      return res.status(400).json({
        error: "Database query failed",
        details: queryError.message,
        query: query,
        params: [fromDate, toDate]
      });
    }
  } catch (err) {
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

    if (!fromDate || !toDate) {
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
              m.is_posted, m.is_confirmed, m.is_paid
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

// Replace all detail rows for a sale with automatic consolidation of duplicate items
// Body: { items: [{ fyear_id, srno, itemcode, unit, qty, avg_cost, taxable_rate, cgst_per, sgst_per, igst_per,
//                   cgst_amount, sgst_amount, igst_amount, rate, dis_per, dis_amount, tot_amount, description, is_deleted }] }
router.post("/:invMasterId/items/replace", async (req, res) => {
  const { invMasterId } = req.params;
  const { items = [] } = req.body || {};
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM public.trn_invoice_detail WHERE inv_master_id=$1`, [invMasterId]);

    // ========================================
    // CONSOLIDATE DUPLICATE ITEMS
    // ========================================
    const consolidatedItems = {};
    
    for (const it of items) {
      // Skip deleted items
      if (it.is_deleted) continue;
      
      // Create unique key based on itemcode and rate
      const key = `${it.itemcode}_${it.rate || 0}`;
      
      if (consolidatedItems[key]) {
        // Item with same itemcode and rate exists - consolidate
        const existing = consolidatedItems[key];
        
        // Add quantities
        existing.qty = (parseFloat(existing.qty) || 0) + (parseFloat(it.qty) || 0);
        
        // Recalculate amounts based on consolidated quantity
        const totalQty = existing.qty;
        const rate = parseFloat(existing.rate) || 0;
        
        // Calculate taxable amount
        existing.taxable_rate = totalQty * rate;
        
        // Calculate tax amounts (assuming same tax rates)
        const cgstPer = parseFloat(existing.cgst_per) || 0;
        const sgstPer = parseFloat(existing.sgst_per) || 0;
        const igstPer = parseFloat(existing.igst_per) || 0;
        
        existing.cgst_amount = (existing.taxable_rate * cgstPer) / 100;
        existing.sgst_amount = (existing.taxable_rate * sgstPer) / 100;
        existing.igst_amount = (existing.taxable_rate * igstPer) / 100;
        
        // Calculate total amount
        existing.tot_amount = existing.taxable_rate + existing.cgst_amount + existing.sgst_amount + existing.igst_amount;
        
        // Update average cost (weighted average)
        const existingCost = parseFloat(existing.avg_cost) || 0;
        const newCost = parseFloat(it.avg_cost) || 0;
        const existingQtyBefore = (parseFloat(existing.qty) || 0) - (parseFloat(it.qty) || 0);
        const newQty = parseFloat(it.qty) || 0;
        
        if (totalQty > 0) {
          existing.avg_cost = ((existingCost * existingQtyBefore) + (newCost * newQty)) / totalQty;
        }
        
        console.log(`📦 Consolidated item ${it.itemcode} at rate ${rate}: qty ${existingQtyBefore} + ${newQty} = ${totalQty}`);
        
      } else {
        // New item - add to consolidated list
        consolidatedItems[key] = { ...it };
        console.log(`➕ Added new item ${it.itemcode} at rate ${it.rate}: qty ${it.qty}`);
      }
    }

    // Convert consolidated items back to array and assign new serial numbers
    const finalItems = Object.values(consolidatedItems);
    
    console.log(`📊 Consolidation complete: ${items.length} original items → ${finalItems.length} consolidated items`);

    // Insert consolidated items
    for (let i = 0; i < finalItems.length; i++) {
      const it = finalItems[i];
      
      await client.query(
        `INSERT INTO public.trn_invoice_detail
         (fyear_id, inv_master_id, srno, itemcode, unit, qty, avg_cost, taxable_rate,
          cgst_per, sgst_per, igst_per, cgst_amount, sgst_amount, igst_amount,
          rate, dis_per, dis_amount, tot_amount, description, is_deleted)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
        [
          nn(it.fyear_id),
          invMasterId,
          i + 1, // New sequential serial number
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

    const sumRes = await client.query(`SELECT COALESCE(SUM(avg_cost * qty),0) AS tot FROM public.trn_invoice_detail WHERE inv_master_id=$1`, [invMasterId]);
    await client.query(`UPDATE public.trn_invoice_master SET tot_avg_cost=$2 WHERE inv_master_id=$1`, [invMasterId, sumRes.rows[0]?.tot ?? 0]);
    await client.query("COMMIT");
    
    res.json({ 
      success: true, 
      originalCount: items.length,
      consolidatedCount: finalItems.length,
      message: `Successfully consolidated ${items.length} items into ${finalItems.length} lines`
    });
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

// Confirm sales invoice (set is_confirmed = true)
// Confirm sales invoice - Updates inventory and creates stock ledger entries
router.post("/:invMasterId/confirm", checkPeriodStatus, async (req, res) => {
  const { invMasterId } = req.params;
  
  if (!/^\d+$/.test(String(invMasterId))) {
    return res.status(400).json({ error: "Invalid invoice id" });
  }

  const client = await pool.connect();
  const num = (v) => parseFloat(v ?? 0) || 0;
  
  try {
    await client.query("BEGIN");

    // Check if invoice exists and is not already confirmed or posted
    const checkResult = await client.query(
      `SELECT inv_master_id, fyear_id, inv_date, is_confirmed, is_posted 
       FROM public.trn_invoice_master WHERE inv_master_id = $1`,
      [invMasterId]
    );

    if (checkResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Invoice not found" });
    }

    const invoice = checkResult.rows[0];
    if (invoice.is_confirmed) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Invoice already confirmed" });
    }

    if (invoice.is_posted) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Invoice already posted" });
    }

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
        [invoice.fyear_id ?? d.fyear_id ?? null, invMasterId, d.inv_detail_id, d.itemcode, 'Sale', invoice.inv_date, d.unit, qtyNeg]
      );
      
      // Decrease current stock in item master
      await client.query(
        `UPDATE public.tblmasitem
           SET curstock = COALESCE(curstock, 0) - $1
         WHERE itemcode = $2`,
        [qty, d.itemcode]
      );
    }

    // Mark as confirmed
    await client.query(
      `UPDATE public.trn_invoice_master SET is_confirmed = TRUE WHERE inv_master_id = $1`,
      [invMasterId]
    );

    await client.query("COMMIT");
    res.json({ success: true, message: "Invoice confirmed and inventory updated successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error confirming invoice:", err);
    res.status(500).json({ error: "Failed to confirm invoice" });
  } finally {
    client.release();
  }
});

// Mark sales invoice as posted (locked) + create accounting and stock ledger entries atomically
router.post("/:invMasterId/post", checkPeriodStatus, async (req, res) => {
  const { invMasterId } = req.params;
  const client = await pool.connect();
  const num = (v) => parseFloat(v ?? 0) || 0; // safe numeric coercion
  try {
    await client.query("BEGIN");

    // Fetch invoice master
    const hdrRes = await client.query(
      `SELECT m.inv_master_id, m.fyear_id, m.inv_no, m.inv_date, m.party_id, m.customer_name, m.account_id,
              m.taxable_tot, m.cgst_amount, m.sgst_amount, m.igst_amount, m.tot_amount, m.rounded_off, 
              m.is_posted, m.is_confirmed,
              COALESCE(m.customer_name, p.partyname, 'Unknown Customer') as display_customer_name
         FROM public.trn_invoice_master m
         LEFT JOIN tblmasparty p ON m.party_id = p.partyid
         WHERE m.inv_master_id=$1`,
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

    // Check if invoice is confirmed before posting
    if (!m.is_confirmed) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Invoice must be confirmed before posting" });
    }

    const totAmount = num(m.tot_amount);
    const roundOff = num(m.rounded_off);
    const taxableTot = num(m.taxable_tot);
    const cgstAmt = num(m.cgst_amount);
    const sgstAmt = num(m.sgst_amount);
    const igstAmt = num(m.igst_amount);
    const finalTotal = totAmount + roundOff; // final invoice amount

    // ========================================
    // DYNAMIC JOURNAL GENERATION USING EVENT-BASED APPROACH
    // ========================================
    
    // Get all mappings for Sales-related events (SALES_REV and COGS)
    const mappingsRes = await client.query(`
      SELECT 
        mapping_id, transaction_type, event_code, entry_sequence,
        account_nature, debit_credit, value_source, description_template, is_dynamic_dc
      FROM con_transaction_mapping 
      WHERE (UPPER(TRIM(transaction_type)) = 'SALES' OR UPPER(TRIM(transaction_type)) = 'SALES INVOICE')
         AND (TRIM(event_code) IN ('SALES_REV', 'COGS') 
              OR UPPER(TRIM(event_code)) = 'SALES' 
              OR UPPER(TRIM(event_code)) = 'SALE')
      ORDER BY event_code, entry_sequence
    `);

    console.log(`Query found ${mappingsRes.rows.length} mappings for sales-related events`);
    if (mappingsRes.rows.length > 0) {
      console.log('Found mappings by event code:');
      const groupedMappings = {};
      mappingsRes.rows.forEach(m => {
        if (!groupedMappings[m.event_code]) groupedMappings[m.event_code] = [];
        groupedMappings[m.event_code].push(`${m.account_nature} (${m.debit_credit})`);
      });
      Object.keys(groupedMappings).forEach(eventCode => {
        console.log(`  ${eventCode}: ${groupedMappings[eventCode].join(', ')}`);
      });
      
      // Check specifically for COGS mappings
      const cogsMappings = mappingsRes.rows.filter(m => m.event_code === 'COGS');
      console.log(`COGS mappings found: ${cogsMappings.length}`);
      if (cogsMappings.length === 0) {
        console.log('❌ WARNING: No COGS mappings found! COGS journal entries will be skipped.');
        console.log('Check that COGS mappings exist with event_code = "COGS"');
      }
    }

    if (mappingsRes.rows.length > 0) {
      console.log(`Found ${mappingsRes.rows.length} journal mappings for Sales event`);
      console.log('All mappings found:');
      mappingsRes.rows.forEach((mapping, index) => {
        console.log(`  ${index + 1}. Event: ${mapping.event_code}, Nature: ${mapping.account_nature}, Dr/Cr: ${mapping.debit_credit}, Source: ${mapping.value_source}`);
      });
      
      // Prepare transaction data for value source mapping
      // First, calculate COGS from invoice master (tot_avg_cost is already calculated)
      let cogsAmount = 0;
      try {
        const cogsRes = await client.query(`
          SELECT COALESCE(tot_avg_cost, 0) as total_cogs
          FROM public.trn_invoice_master
          WHERE inv_master_id = $1
        `, [invMasterId]);
        
        cogsAmount = parseFloat(cogsRes.rows[0]?.total_cogs || 0);
        console.log(`Calculated COGS amount from master table: ${cogsAmount}`);
      } catch (cogsError) {
        console.log('Error calculating COGS:', cogsError.message);
        cogsAmount = 0;
      }

      const transactionData = {
        SALES_TOTAL_AMOUNT: finalTotal,
        SALES_TAXABLE_AMOUNT: taxableTot,
        SALES_CGST_AMOUNT: cgstAmt,
        SALES_SGST_AMOUNT: sgstAmt,
        SALES_IGST_AMOUNT: igstAmt,
        SALES_DISCOUNT_AMOUNT: 0, // Add if needed
        ROUND_OFF_AMOUNT: roundOff,
        COST_OF_GOODS_SOLD: cogsAmount, // Keep for backward compatibility
        SALES_COGS_AMOUNT: cogsAmount    // This is what the mappings use!
      };

      console.log('Transaction data for journal generation:', transactionData);

      try {
        // Group mappings by event_code to create separate journal entries
        const eventGroups = {};
        mappingsRes.rows.forEach(mapping => {
          if (!eventGroups[mapping.event_code]) {
            eventGroups[mapping.event_code] = [];
          }
          eventGroups[mapping.event_code].push(mapping);
        });

        console.log(`Found ${Object.keys(eventGroups).length} event codes:`, Object.keys(eventGroups));

        // Create separate journal entries for each event code
        for (const [eventCode, mappings] of Object.entries(eventGroups)) {
          console.log(`\n=== Creating journal for event: ${eventCode} ===`);
          console.log(`Event has ${mappings.length} mappings`);
          
          // Check if this is COGS event and if COGS amount is 0
          if (eventCode === 'COGS' && cogsAmount === 0) {
            console.log('⚠️  Skipping COGS journal creation because COGS amount is 0');
            console.log('   Items may not have avg_cost values set');
            continue; // Skip this event
          }
          
          // Debug: Log transaction data for this event
          console.log('Available transaction data:');
          Object.entries(transactionData).forEach(([key, value]) => {
            console.log(`  ${key}: ${value}`);
          });
          
          // Create journal master entry for this event
          const journalMasterRes = await client.query(`
            INSERT INTO public.acc_journal_master 
            (journal_date, finyearid, journal_serial, source_document_type, source_document_ref, 
             source_document_id, total_debit, total_credit, narration, created_date)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
            RETURNING journal_mas_id
          `, [
            m.inv_date,
            m.fyear_id || 1,
            `SALES-${m.inv_no}-${eventCode}`, // Include event code in serial
            'SALES_INVOICE',
            `INV-${m.inv_no}-${eventCode}`,
            invMasterId,
            0, // Will be updated after calculating totals
            0,
            `Sales Invoice ${m.inv_no} - ${m.display_customer_name}`
          ]);

          const journalMasId = journalMasterRes.rows[0].journal_mas_id;
          console.log(`Created journal master with ID: ${journalMasId} for event: ${eventCode}`);
          
          let eventDebits = 0, eventCredits = 0;

          // Generate journal detail entries for this event
          console.log(`\nProcessing ${mappings.length} mappings for event ${eventCode}:`);
          for (const mapping of mappings) {
            const amount = transactionData[mapping.value_source] || 0;
            
            console.log(`\n--- Processing mapping ${mapping.entry_sequence} ---`);
            console.log(`Account Nature: ${mapping.account_nature}`);
            console.log(`Debit/Credit: ${mapping.debit_credit}`);
            console.log(`Value Source: ${mapping.value_source}`);
            console.log(`Amount from transaction data: ${amount}`);
            console.log(`Is Dynamic D/C: ${mapping.is_dynamic_dc}`);
            
            // Skip only if amount is exactly 0 (allow negative amounts for rounding, etc.)
            if (amount !== 0) {
              
              // Determine actual debit/credit based on is_dynamic_dc flag
              let actualDebitCredit = mapping.debit_credit;
              let absoluteAmount = Math.abs(amount);
              
              if (mapping.is_dynamic_dc) {
                // For dynamic entries, flip D/C based on sign
                // Positive amount: use configured D/C
                // Negative amount: flip D/C
                if (amount < 0) {
                  actualDebitCredit = mapping.debit_credit === 'D' ? 'C' : 'D';
                }
                console.log(`Dynamic D/C: Original=${mapping.debit_credit}, Amount=${amount}, Actual=${actualDebitCredit}`);
              }
              
              // Get account ID from account nature (flexible matching)
              // First try exact match, then try pattern matching for transaction-specific natures
              let accountRes = await client.query(`
                SELECT account_id, account_code, account_name, account_nature 
                FROM public.acc_mas_coa 
                WHERE TRIM(UPPER(account_nature)) = TRIM(UPPER($1)) AND is_active = true
                LIMIT 1
              `, [mapping.account_nature]);

              // If exact match fails, try pattern matching (e.g., 'Sales Invoice ("STOCK_ON_HAND")')
              if (accountRes.rows.length === 0) {
                accountRes = await client.query(`
                  SELECT account_id, account_code, account_name, account_nature 
                  FROM public.acc_mas_coa 
                  WHERE account_nature ILIKE '%' || $1 || '%' AND is_active = true
                  LIMIT 1
                `, [mapping.account_nature]);
              }

              let accountId = null;
              if (accountRes.rows.length > 0) {
                accountId = accountRes.rows[0].account_id;
                console.log(`Found account ID ${accountId} (${accountRes.rows[0].account_code} - ${accountRes.rows[0].account_name}) for nature: ${mapping.account_nature}`);
              } else {
                console.log(`❌ WARNING: No account found for nature: ${mapping.account_nature}`);
                console.log(`   Skipping this entry - please ensure an account exists in Chart of Accounts`);
                console.log(`   with account_nature = "${mapping.account_nature}" and is_active = true`);
                continue;
              }

              // Generate description from template
              let description = mapping.description_template || `${mapping.account_nature} - Invoice ${m.inv_no}`;
              description = description
                .replace('{{customer_name}}', m.customer_name || 'Unknown Customer')
                .replace('{{invoice_no}}', m.inv_no || '')
                .replace('{{invoice_date}}', m.inv_date || '');

              console.log(`✅ Creating journal detail entry:`);
              console.log(`   Account: ${accountRes.rows[0].account_name} (${accountRes.rows[0].account_code})`);
              console.log(`   ${actualDebitCredit === 'D' ? 'Debit' : 'Credit'}: ${absoluteAmount}`);
              console.log(`   Description: ${description}`);

              // Only set party_id on the AR/AP account line (the customer's receivable account)
              // COGS, inventory, and revenue lines should NOT have party_id set
              const linePartyId = (accountId === m.account_id) ? m.party_id : null;

              // Insert journal detail entry using absolute amount and actual debit/credit
              await client.query(`
                INSERT INTO public.acc_journal_detail 
                (journal_mas_id, account_id, party_id, debit_amount, credit_amount, description, created_date)
                VALUES ($1, $2, $3, $4, $5, $6, NOW())
              `, [
                journalMasId,
                accountId,
                linePartyId,
                actualDebitCredit === 'D' ? absoluteAmount : 0,
                actualDebitCredit === 'C' ? absoluteAmount : 0,
                description
              ]);

              // Track totals for this event using absolute amount
              if (actualDebitCredit === 'D') {
                eventDebits += absoluteAmount;
              } else {
                eventCredits += absoluteAmount;
              }
            } else {
              console.log(`❌ SKIPPING mapping ${mapping.account_nature} (${mapping.debit_credit})`);
              console.log(`   Reason: Amount is ${amount} (value_source: ${mapping.value_source})`);
              console.log(`   This is why the journal entry is not being created!`);
              
              // Additional debugging for zero amounts
              if (amount === 0) {
                console.log(`   🔍 Debug: ${mapping.value_source} = 0 in transaction data`);
                if (mapping.value_source === 'COST_OF_GOODS_SOLD') {
                  console.log(`   💡 COGS is 0 - check if invoice items have avg_cost values`);
                }
              }
            }
          }

          // Update journal master with correct totals for this event
          await client.query(`
            UPDATE public.acc_journal_master 
            SET total_debit = $1, total_credit = $2
            WHERE journal_mas_id = $3
          `, [eventDebits, eventCredits, journalMasId]);
          
          console.log(`Journal entries created for event ${eventCode}. Debits: ${eventDebits}, Credits: ${eventCredits}`);
        }
        
        console.log(`\n=== All journal entries created successfully ===`);
        console.log(`Total events processed: ${Object.keys(eventGroups).length}`);
        
      } catch (journalError) {
        console.error('Error creating journal entries:', journalError);
        throw journalError; // Re-throw to trigger rollback
      }
    } else {
      console.log('No journal mappings found for sales-related events - skipping journal creation');
      console.log('Available event codes in database:');
      
      // Show what event codes actually exist
      const allEventsRes = await client.query(`
        SELECT DISTINCT event_code, COUNT(*) as count 
        FROM con_transaction_mapping 
        GROUP BY event_code 
        ORDER BY event_code
      `);
      
      allEventsRes.rows.forEach(row => {
        console.log(`  "${row.event_code}" (${row.count} mappings)`);
      });
    }

    // NOTE: Stock ledger and inventory updates are handled in /confirm endpoint
    // This endpoint only handles accounting entries

    // Mark as posted
    console.log(`Marking invoice ${invMasterId} as posted...`);
    await client.query(`UPDATE public.trn_invoice_master SET is_posted = TRUE WHERE inv_master_id = $1`, [invMasterId]);
    
    // Populate acc_trn_invoice table for accounts receivable tracking
    console.log(`Populating acc_trn_invoice table for invoice ${invMasterId}...`);
    try {
      await client.query(`
        INSERT INTO public.acc_trn_invoice (
          fyear_id, party_id, tran_type, inv_master_id, tran_date, 
          party_inv_no, party_inv_date, tran_amount, paid_amount, 
          balance_amount, status, inv_reference, is_posted
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        m.fyear_id || 1,           // fyear_id
        m.party_id,                // party_id (customer)
        'SAL',                     // tran_type (Sales)
        invMasterId,               // inv_master_id
        m.inv_date,                // tran_date
        m.inv_no,                  // party_inv_no (our invoice number)
        m.inv_date,                // party_inv_date (same as invoice date)
        finalTotal,                // tran_amount (total invoice amount)
        0,                         // paid_amount (initially 0)
        finalTotal,                // balance_amount (initially full amount)
        0,                         // status (0 = Open, 1 = Partial, 2 = Paid)
        `INV-${m.inv_no}`,         // inv_reference
        true                       // is_posted
      ]);
      console.log(`Successfully added invoice ${m.inv_no} to acc_trn_invoice table`);
    } catch (accTrnError) {
      console.error('Error populating acc_trn_invoice table:', accTrnError);
      // Don't throw error - this shouldn't stop the posting process
    }
    
    // Verify the update worked
    const verifyResult = await client.query(`SELECT is_posted, is_confirmed FROM public.trn_invoice_master WHERE inv_master_id = $1`, [invMasterId]);
    console.log(`After update - Invoice ${invMasterId} status:`, verifyResult.rows[0]);

    await client.query("COMMIT");
    res.json({ 
      success: true, 
      message: "Sales invoice posted successfully with dynamic journal entries",
      journal_entries_created: mappingsRes.rows.length,
      invoice_status: verifyResult.rows[0]
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error posting sales invoice:", err);
    res.status(500).json({ error: "Failed to post sales invoice", details: err.message });
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