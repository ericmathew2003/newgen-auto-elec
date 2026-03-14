const express = require("express");
const router = express.Router();
const pool = require("../db");
const { checkPeriodStatus, checkPeriodStatusForUpdate } = require("../middleware/checkPeriodStatus");

// Helper to normalize empty strings to null
const nn = (v) => (v === undefined || v === null || String(v).trim() === "" ? null : v);

// Helper to convert to number
const num = (v) => parseFloat(v ?? 0) || 0;

// Get list of Sales Returns
router.get("/", async (req, res) => {
  const { fromDate, toDate, partyId, fyearId } = req.query || {};
  const where = [];
  const params = [];
  if (fromDate) { params.push(fromDate); where.push(`m.sales_ret_date >= $${params.length}`); }
  if (toDate)   { params.push(toDate);   where.push(`m.sales_ret_date <= $${params.length}`); }
  if (partyId)  { params.push(partyId);  where.push(`m.party_id = $${params.length}`); }
  if (fyearId)  { params.push(fyearId);  where.push(`m.fyear_id = $${params.length}`); }
  const filter = where.length ? `WHERE ${where.join(" AND ")}` : "";

  try {
    const r = await pool.query(
      `SELECT m.sales_ret_id, m.sales_ret_no, m.sales_ret_date,
              p.partyname,
              m.taxable_amount, m.cgst_amount, m.sgst_amount, m.igst_amount, 
              m.rounded_off, m.total_amount,
              m.is_confirmed, m.is_posted, m.is_cancelled
       FROM inv_trn_sales_return_master m
       LEFT JOIN tblmasparty p ON p.partyid = m.party_id
       ${filter}
       ORDER BY m.sales_ret_date DESC`,
      params
    );
    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch sales returns" });
  }
});

// Get next sales return number
router.get("/next-number", async (req, res) => {
  try {
    const selectedFYearID = req.query.fyear_id;
    console.log("Backend: Generating next sales return number for fyear_id:", selectedFYearID);
    
    const sql = selectedFYearID
      ? `SELECT COALESCE(MAX(sales_ret_no), 0) + 1 AS next_no FROM inv_trn_sales_return_master WHERE fyear_id = $1`
      : `SELECT COALESCE(MAX(sales_ret_no), 0) + 1 AS next_no FROM inv_trn_sales_return_master`;
    const params = selectedFYearID ? [selectedFYearID] : [];
    
    const result = await pool.query(sql, params);
    const next_no = result.rows[0]?.next_no || 1;
    
    console.log("Backend: Returning next_no:", next_no);
    res.json({ next_no });
  } catch (err) {
    console.error("Backend: Error in next-number:", err);
    res.status(500).json({ error: "Failed to generate next sales return number" });
  }
});

// Get sold items for a customer (items that can be returned)
router.get("/sold-items/:partyId", async (req, res) => {
  const { partyId } = req.params;
  
  try {
    // Get items sold to this customer that haven't been fully returned
    const query = `
      SELECT 
        d.inv_detail_id as sales_inv_detail_id,
        d.inv_master_id as sales_inv_master_id,
        m.inv_no as invoice_no,
        m.inv_date as invoice_date,
        d.itemcode,
        i.itemname,
        i.hsncode,
        i.unit,
        d.qty as sold_qty,
        d.rate as sold_rate,
        COALESCE(d.avg_cost / NULLIF(d.qty, 0), i.avgcost, 0) as item_cost,
        d.taxable_rate,
        d.cgst_per,
        d.sgst_per,
        d.igst_per,
        d.cgst_amount,
        d.sgst_amount,
        d.igst_amount,
        d.tot_amount,
        COALESCE(
          (SELECT SUM(sr.return_qty) 
           FROM inv_trn_sales_return_detail sr
           WHERE sr.sales_inv_detail_id = d.inv_detail_id
           AND sr.item_id = d.itemcode),
          0
        ) as already_returned_qty,
        (d.qty - COALESCE(
          (SELECT SUM(sr.return_qty) 
           FROM inv_trn_sales_return_detail sr
           WHERE sr.sales_inv_detail_id = d.inv_detail_id
           AND sr.item_id = d.itemcode),
          0
        )) as available_return_qty
      FROM trn_invoice_detail d
      JOIN trn_invoice_master m ON m.inv_master_id = d.inv_master_id
      LEFT JOIN tblmasitem i ON i.itemcode = d.itemcode
      WHERE m.party_id = $1
        AND m.is_posted = true
        AND m.is_deleted = false
        AND d.qty > COALESCE(
          (SELECT SUM(sr.return_qty) 
           FROM inv_trn_sales_return_detail sr
           WHERE sr.sales_inv_detail_id = d.inv_detail_id
           AND sr.item_id = d.itemcode),
          0
        )
      ORDER BY m.inv_date DESC, m.inv_no DESC
    `;
    
    const result = await pool.query(query, [partyId]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch sold items" });
  }
});

// Get single Sales Return (Header + Details)
router.get("/:salesRetId", async (req, res) => {
  const { salesRetId } = req.params;
  if (!/^\d+$/.test(String(salesRetId))) {
    return res.status(400).json({ error: "Invalid sales return id" });
  }
  
  try {
    // Header with party details
    const hdr = await pool.query(
      `SELECT m.*, p.partyname, p.address1, p.contactno, p.gstnum
       FROM inv_trn_sales_return_master m
       LEFT JOIN tblmasparty p ON p.partyid = m.party_id
       WHERE m.sales_ret_id = $1`,
      [salesRetId]
    );
    
    // Details with item and original invoice info
    const det = await pool.query(
      `SELECT 
        d.*,
        i.itemname,
        i.hsncode,
        i.unit,
        inv.inv_no as original_invoice_no,
        inv.inv_date as original_invoice_date
       FROM inv_trn_sales_return_detail d
       LEFT JOIN tblmasitem i ON i.itemcode = d.item_id
       LEFT JOIN trn_invoice_master inv ON inv.inv_master_id = d.sales_inv_master_id
       WHERE d.sales_ret_id = $1
       ORDER BY d.sales_ret_det_id`,
      [salesRetId]
    );
    
    res.json({ header: hdr.rows[0], details: det.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch sales return" });
  }
});

// Create Sales Return (Header + Items)
router.post("/", checkPeriodStatus, async (req, res) => {
  const { header = {}, items = [] } = req.body || {};
  
  // Log received data for debugging
  console.log('Creating sales return with items:', items.map(it => ({
    item_id: it.item_id,
    return_qty: it.return_qty,
    item_cost: it.item_cost
  })));
  
  const {
    fyear_id,
    sales_ret_no,
    sales_ret_date,
    party_id,
    reason,
    taxable_amount = 0,
    cgst_amount = 0,
    sgst_amount = 0,
    igst_amount = 0,
    rounded_off = 0,
    total_amount = 0,
    is_confirmed = false,
    is_posted = false,
    is_cancelled = false,
  } = header;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Auto-generate return number if needed
    let retNoToUse = sales_ret_no;
    const needsAutoNumber = !sales_ret_no || String(sales_ret_no).trim() === "" || String(sales_ret_no).toUpperCase() === "NEW";
    
    if (needsAutoNumber) {
      await client.query("LOCK TABLE inv_trn_sales_return_master IN EXCLUSIVE MODE");
      const sql = fyear_id
        ? `SELECT COALESCE(MAX(sales_ret_no), 0) + 1 AS next_no FROM inv_trn_sales_return_master WHERE fyear_id = $1`
        : `SELECT COALESCE(MAX(sales_ret_no), 0) + 1 AS next_no FROM inv_trn_sales_return_master`;
      const params = fyear_id ? [fyear_id] : [];
      const r = await client.query(sql, params);
      retNoToUse = r.rows[0]?.next_no || 1;
    }

    // Calculate total cost from items
    const totalCost = items.reduce((sum, it) => sum + (num(it.return_qty || 0) * num(it.item_cost || 0)), 0);

    // Insert master
    const result = await client.query(
      `INSERT INTO inv_trn_sales_return_master
       (fyear_id, sales_ret_no, sales_ret_date, party_id, reason,
        taxable_amount, cgst_amount, sgst_amount, igst_amount, rounded_off, total_amount, total_cost,
        is_confirmed, is_posted, is_cancelled)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING sales_ret_id, sales_ret_no`,
      [
        nn(fyear_id),
        nn(retNoToUse),
        nn(sales_ret_date),
        nn(party_id),
        nn(reason),
        nn(taxable_amount),
        nn(cgst_amount),
        nn(sgst_amount),
        nn(igst_amount),
        nn(rounded_off),
        nn(total_amount),
        nn(totalCost),
        !!is_confirmed,
        !!is_posted,
        !!is_cancelled,
      ]
    );

    const sales_ret_id = result.rows[0]?.sales_ret_id;

    // Insert items
    for (const it of items) {
      await client.query(
        `INSERT INTO inv_trn_sales_return_detail
         (sales_ret_id, sales_inv_master_id, sales_inv_detail_id, item_id,
          sold_qty, sold_rate, return_qty, return_rate, return_amount, item_cost,
          cgst_per, sgst_per, igst_per, cgst_amount, sgst_amount, igst_amount, reason)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
        [
          sales_ret_id,
          nn(it.sales_inv_master_id),
          nn(it.sales_inv_detail_id),
          nn(it.item_id),
          nn(it.sold_qty ?? 0),
          nn(it.sold_rate ?? 0),
          nn(it.return_qty ?? 0),
          nn(it.return_rate ?? 0),
          nn(it.return_amount ?? 0),
          nn(it.item_cost ?? 0),
          nn(it.cgst_per ?? 0),
          nn(it.sgst_per ?? 0),
          nn(it.igst_per ?? 0),
          nn(it.cgst_amount ?? 0),
          nn(it.sgst_amount ?? 0),
          nn(it.igst_amount ?? 0),
          it.reason ?? null,
        ]
      );
    }

    await client.query("COMMIT");
    res.json({ 
      success: true, 
      sales_ret_id, 
      sales_ret_no: result.rows[0]?.sales_ret_no 
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Failed to create sales return", details: err.message });
  } finally {
    client.release();
  }
});

// Update Sales Return (Header Only)
router.put("/:salesRetId", checkPeriodStatusForUpdate, async (req, res) => {
  const { salesRetId } = req.params;
  if (!/^\d+$/.test(String(salesRetId))) {
    return res.status(400).json({ error: "Invalid sales return id" });
  }
  
  const {
    fyear_id,
    sales_ret_date,
    party_id,
    reason,
    taxable_amount = 0,
    cgst_amount = 0,
    sgst_amount = 0,
    igst_amount = 0,
    rounded_off = 0,
    total_amount = 0,
    is_confirmed = false,
    is_posted = false,
    is_cancelled = false,
  } = req.body || {};

  try {
    // Calculate total cost from items
    const totalCost = items.reduce((sum, it) => sum + (num(it.return_qty || 0) * num(it.item_cost || 0)), 0);

    await pool.query(
      `UPDATE inv_trn_sales_return_master
       SET fyear_id=$1, sales_ret_date=$2, party_id=$3, reason=$4,
           taxable_amount=$5, cgst_amount=$6, sgst_amount=$7, igst_amount=$8,
           rounded_off=$9, total_amount=$10, total_cost=$11, is_confirmed=$12, is_posted=$13, is_cancelled=$14,
           edited_date=NOW()
       WHERE sales_ret_id=$15`,
      [
        nn(fyear_id),
        nn(sales_ret_date),
        nn(party_id),
        nn(reason),
        nn(taxable_amount),
        nn(cgst_amount),
        nn(sgst_amount),
        nn(igst_amount),
        nn(rounded_off),
        nn(total_amount),
        nn(totalCost),
        !!is_confirmed,
        !!is_posted,
        !!is_cancelled,
        salesRetId,
      ]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update sales return" });
  }
});

// Replace all detail rows for a sales return
router.post("/:salesRetId/items/replace", async (req, res) => {
  const { salesRetId } = req.params;
  const { items = [] } = req.body || {};
  
  // Log received data for debugging
  console.log('Replacing items for sales return:', salesRetId);
  console.log('Items received:', items.map(it => ({
    item_id: it.item_id,
    return_qty: it.return_qty,
    item_cost: it.item_cost
  })));
  
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM inv_trn_sales_return_detail WHERE sales_ret_id=$1`, [salesRetId]);

    // Calculate total cost
    let totalCost = 0;

    for (const it of items) {
      totalCost += num(it.return_qty || 0) * num(it.item_cost || 0);
      
      await client.query(
        `INSERT INTO inv_trn_sales_return_detail
         (sales_ret_id, sales_inv_master_id, sales_inv_detail_id, item_id,
          sold_qty, sold_rate, return_qty, return_rate, return_amount, item_cost,
          cgst_per, sgst_per, igst_per, cgst_amount, sgst_amount, igst_amount, reason)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
        [
          salesRetId,
          nn(it.sales_inv_master_id),
          nn(it.sales_inv_detail_id),
          nn(it.item_id),
          nn(it.sold_qty ?? 0),
          nn(it.sold_rate ?? 0),
          nn(it.return_qty ?? 0),
          nn(it.return_rate ?? 0),
          nn(it.return_amount ?? 0),
          nn(it.item_cost ?? 0),
          nn(it.cgst_per ?? 0),
          nn(it.sgst_per ?? 0),
          nn(it.igst_per ?? 0),
          nn(it.cgst_amount ?? 0),
          nn(it.sgst_amount ?? 0),
          nn(it.igst_amount ?? 0),
          it.reason ?? null,
        ]
      );
    }

    // Update total_cost in master
    await client.query(
      `UPDATE inv_trn_sales_return_master SET total_cost = $1, edited_date = NOW() WHERE sales_ret_id = $2`,
      [nn(totalCost), salesRetId]
    );

    await client.query("COMMIT");
    res.json({ success: true, count: items.length });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Failed to replace sales return items" });
  } finally {
    client.release();
  }
});

// Confirm sales return (update inventory and stock ledger)
router.post("/:salesRetId/confirm", checkPeriodStatus, async (req, res) => {
  const { salesRetId } = req.params;
  if (!/^\d+$/.test(String(salesRetId))) {
    return res.status(400).json({ error: "Invalid sales return id" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existing = await client.query(
      `SELECT is_confirmed, is_posted, fyear_id, sales_ret_date FROM inv_trn_sales_return_master WHERE sales_ret_id = $1 FOR UPDATE`,
      [salesRetId]
    );

    if (existing.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Sales return not found" });
    }

    const { is_confirmed, is_posted, fyear_id, sales_ret_date } = existing.rows[0];

    if (is_confirmed) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Sales return is already confirmed" });
    }

    if (is_posted) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Sales return is already posted" });
    }

    // Get return details for stock ledger
    const detailsForLedger = await client.query(
      `SELECT d.item_id, d.return_qty, i.unit 
       FROM inv_trn_sales_return_detail d
       LEFT JOIN tblmasitem i ON d.item_id = i.itemcode
       WHERE d.sales_ret_id = $1`,
      [salesRetId]
    );

    // Create stock ledger entries and update inventory
    for (const row of detailsForLedger.rows || []) {
      const { item_id, return_qty, unit } = row;
      if (!item_id || !return_qty || return_qty <= 0) continue;

      // Insert stock ledger entry for sales return (IN transaction - positive qty)
      await client.query(
        `INSERT INTO trn_stock_ledger 
         (fyear_id, inv_master_id, itemcode, tran_type, tran_date, unit, qty)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [fyear_id, salesRetId, item_id, 'SRET', sales_ret_date, unit || '', return_qty]
      );

      // Update item master stock (increase stock for return)
      await client.query(
        `UPDATE tblmasitem 
         SET curstock = curstock + $1
         WHERE itemcode = $2`,
        [return_qty, item_id]
      );
    }

    // Update to confirmed status
    await client.query(
      `UPDATE inv_trn_sales_return_master SET is_confirmed = true, edited_date = NOW() WHERE sales_ret_id = $1`,
      [salesRetId]
    );

    await client.query("COMMIT");
    res.json({ success: true, message: "Sales return confirmed successfully. Inventory updated." });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Failed to confirm sales return", details: err.message });
  } finally {
    client.release();
  }
});

// Post sales return (create journals and acc_trn_invoice entry)
router.post("/:salesRetId/post", checkPeriodStatus, async (req, res) => {
  const { salesRetId } = req.params;
  if (!/^\d+$/.test(String(salesRetId))) {
    return res.status(400).json({ error: "Invalid sales return id" });
  }

  const client = await pool.connect();
  const num = (v) => parseFloat(v ?? 0) || 0;
  
  try {
    await client.query("BEGIN");

    // Check if sales return exists and is confirmed but not posted
    const existing = await client.query(
      `SELECT is_confirmed, is_posted FROM inv_trn_sales_return_master WHERE sales_ret_id = $1 FOR UPDATE`,
      [salesRetId]
    );

    if (existing.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Sales return not found" });
    }

    const { is_confirmed, is_posted } = existing.rows[0];

    if (!is_confirmed) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Sales return must be confirmed before posting" });
    }

    if (is_posted) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Sales return is already posted" });
    }

    // Get sales return master data for journal generation
    const returnMasterRes = await client.query(
      `SELECT m.sales_ret_id, m.fyear_id, m.sales_ret_no, m.sales_ret_date, m.party_id,
              m.taxable_amount, m.cgst_amount, m.sgst_amount, m.igst_amount, m.rounded_off, m.total_amount, m.total_cost,
              COALESCE(p.partyname, 'Unknown Customer') as customer_name
       FROM inv_trn_sales_return_master m
       LEFT JOIN tblmasparty p ON m.party_id = p.partyid
       WHERE m.sales_ret_id = $1`,
      [salesRetId]
    );
    
    const returnMaster = returnMasterRes.rows[0];
    if (!returnMaster) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Sales return master not found" });
    }

    const totalAmount = num(returnMaster.total_amount);
    const taxableAmount = num(returnMaster.taxable_amount);
    const cgstAmount = num(returnMaster.cgst_amount);
    const sgstAmount = num(returnMaster.sgst_amount);
    const igstAmount = num(returnMaster.igst_amount);
    const roundedOff = num(returnMaster.rounded_off);
    const totalCost = num(returnMaster.total_cost || 0);
    
    // ========================================
    // DYNAMIC JOURNAL GENERATION FOR SALES RETURN
    // ========================================
    
    // Get all mappings for Sales Return
    const mappingsRes = await client.query(`
      SELECT 
        mapping_id, transaction_type, event_code, entry_sequence,
        account_nature, debit_credit, value_source, description_template, is_dynamic_dc
      FROM con_transaction_mapping 
      WHERE UPPER(TRIM(transaction_type)) = 'SALES RETURN'
      ORDER BY event_code, entry_sequence
    `);
    
    console.log(`Query found ${mappingsRes.rows.length} mappings for Sales Return`);
    
    if (mappingsRes.rows.length > 0) {
      console.log(`Found ${mappingsRes.rows.length} journal mappings for Sales Return`);
      
      console.log(`Total COGS amount from master: ${totalCost}`);
      
      // Prepare transaction data for value source mapping
      const transactionData = {
        SALES_RETURN_TOTAL_AMOUNT: totalAmount,
        SALES_RETURN_TAXABLE_AMOUNT: taxableAmount,
        SALES_RETURN_CGST_AMOUNT: cgstAmount,
        SALES_RETURN_SGST_AMOUNT: sgstAmount,
        SALES_RETURN_IGST_AMOUNT: igstAmount,
        SALES_RETURN_COGS_AMOUNT: totalCost,
        ROUND_OFF_AMOUNT: roundedOff
      };
      
      console.log('Transaction data for journal generation:', transactionData);
      
      try {
        // Group mappings by event_code
        const eventGroups = {};
        mappingsRes.rows.forEach(mapping => {
          if (!eventGroups[mapping.event_code]) {
            eventGroups[mapping.event_code] = [];
          }
          eventGroups[mapping.event_code].push(mapping);
        });
        
        console.log(`Found ${Object.keys(eventGroups).length} event codes:`, Object.keys(eventGroups));
        
        // Create journal entries for each event code
        for (const [eventCode, mappings] of Object.entries(eventGroups)) {
          console.log(`\n=== Creating journal for event: ${eventCode} ===`);
          console.log(`Event has ${mappings.length} mappings`);
          
          // Create journal master entry
          const journalMasterRes = await client.query(`
            INSERT INTO public.acc_journal_master 
            (journal_date, finyearid, journal_serial, source_document_type, source_document_ref, 
             source_document_id, total_debit, total_credit, narration, created_date)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
            RETURNING journal_mas_id
          `, [
            returnMaster.sales_ret_date,
            returnMaster.fyear_id || 1,
            `SRET-${returnMaster.sales_ret_no}-${eventCode}`,
            'SALES_RETURN',
            `SRET-${returnMaster.sales_ret_no}-${eventCode}`,
            salesRetId,
            0, // Will be updated after calculating totals
            0,
            `Sales Return ${returnMaster.sales_ret_no} - ${returnMaster.customer_name}`
          ]);
          
          const journalMasId = journalMasterRes.rows[0].journal_mas_id;
          console.log(`Created journal master with ID: ${journalMasId} for event: ${eventCode}`);
          
          let eventDebits = 0, eventCredits = 0;
          
          // Generate journal detail entries
          console.log(`\nProcessing ${mappings.length} mappings for event ${eventCode}:`);
          for (const mapping of mappings) {
            const amount = transactionData[mapping.value_source] || 0;
            
            console.log(`\n--- Processing mapping ${mapping.entry_sequence} ---`);
            console.log(`Account Nature: ${mapping.account_nature}`);
            console.log(`Debit/Credit: ${mapping.debit_credit}`);
            console.log(`Value Source: ${mapping.value_source}`);
            console.log(`Amount from transaction data: ${amount}`);
            
            if (amount > 0) {
              // Get account ID from account nature
              let accountRes = await client.query(`
                SELECT account_id, account_code, account_name, account_nature 
                FROM public.acc_mas_coa 
                WHERE TRIM(UPPER(account_nature)) = TRIM(UPPER($1)) AND is_active = true
                LIMIT 1
              `, [mapping.account_nature]);
              
              // If exact match fails, try pattern matching
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
                console.log(`Found account ID ${accountId} (${accountRes.rows[0].account_code} - ${accountRes.rows[0].account_name})`);
              } else {
                console.log(`❌ WARNING: No account found for nature: ${mapping.account_nature}`);
                console.log(`   Skipping this entry`);
                continue;
              }
              
              // Generate description from template
              let description = mapping.description_template || `${mapping.account_nature} - Return ${returnMaster.sales_ret_no}`;
              description = description
                .replace('{{sales_ret_no}}', returnMaster.sales_ret_no || '')
                .replace('{{sales_ret_date}}', returnMaster.sales_ret_date || '');
              
              console.log(`✅ Creating journal detail entry:`);
              console.log(`   Account: ${accountRes.rows[0].account_name} (${accountRes.rows[0].account_code})`);
              console.log(`   ${mapping.debit_credit === 'D' ? 'Debit' : 'Credit'}: ${amount}`);
              console.log(`   Description: ${description}`);
              
              // Insert journal detail entry
              await client.query(`
                INSERT INTO public.acc_journal_detail 
                (journal_mas_id, account_id, party_id, debit_amount, credit_amount, description, created_date)
                VALUES ($1, $2, $3, $4, $5, $6, NOW())
              `, [
                journalMasId,
                accountId,
                returnMaster.party_id,
                mapping.debit_credit === 'D' ? amount : 0,
                mapping.debit_credit === 'C' ? amount : 0,
                description
              ]);
              
              // Track totals
              if (mapping.debit_credit === 'D') {
                eventDebits += amount;
              } else {
                eventCredits += amount;
              }
            } else {
              console.log(`❌ SKIPPING mapping ${mapping.account_nature} (${mapping.debit_credit})`);
              console.log(`   Reason: Amount is ${amount}`);
            }
          }
          
          // Update journal master with totals
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
      console.log('No journal mappings found for Sales Return - skipping journal creation');
    }

    // Populate acc_trn_invoice table for sales return tracking
    console.log(`Populating acc_trn_invoice table for sales return ${salesRetId}...`);
    try {
      // Use positive amounts (the tran_type indicates it's a return)
      await client.query(`
        INSERT INTO public.acc_trn_invoice (
          fyear_id, party_id, tran_type, inv_master_id, tran_date, 
          party_inv_no, party_inv_date, tran_amount, paid_amount, 
          balance_amount, status, inv_reference, is_posted
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        returnMaster.fyear_id || 1,      // fyear_id
        returnMaster.party_id,           // party_id (customer)
        'SAL_RET',                       // tran_type (Sales Return)
        salesRetId,                      // inv_master_id (using return ID)
        returnMaster.sales_ret_date,     // tran_date
        returnMaster.sales_ret_no,       // party_inv_no (return number)
        returnMaster.sales_ret_date,     // party_inv_date
        Math.abs(totalAmount),           // tran_amount (positive - constraint requires >= 0)
        0,                               // paid_amount (initially 0)
        Math.abs(totalAmount),           // balance_amount (positive - calculated as tran - paid)
        0,                               // status (0 = Open)
        `SRET-${returnMaster.sales_ret_no}`, // inv_reference
        true                             // is_posted
      ]);
      console.log(`Successfully added sales return ${returnMaster.sales_ret_no} to acc_trn_invoice table`);
    } catch (accTrnError) {
      console.error('Error populating acc_trn_invoice table for sales return:', accTrnError);
      // Don't throw error - this shouldn't stop the posting process
    }

    // Update to posted status
    await client.query(
      `UPDATE inv_trn_sales_return_master SET is_posted = true, edited_date = NOW() WHERE sales_ret_id = $1`,
      [salesRetId]
    );

    await client.query("COMMIT");
    res.json({ 
      success: true, 
      message: "Sales return posted successfully with dynamic journal entries",
      journal_entries_created: mappingsRes.rows.length
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error posting sales return:", err);
    res.status(500).json({ error: "Failed to post sales return", details: err.message });
  } finally {
    client.release();
  }
});

// Delete sales return
router.delete("/:salesRetId", async (req, res) => {
  const { salesRetId } = req.params;
  if (!/^\d+$/.test(String(salesRetId))) {
    return res.status(400).json({ error: "Invalid sales return id" });
  }
  
  try {
    await pool.query(`DELETE FROM inv_trn_sales_return_detail WHERE sales_ret_id=$1`, [salesRetId]);
    await pool.query(`DELETE FROM inv_trn_sales_return_master WHERE sales_ret_id=$1`, [salesRetId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete sales return" });
  }
});

module.exports = router;