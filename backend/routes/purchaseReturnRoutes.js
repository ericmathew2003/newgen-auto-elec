const express = require("express");
const router = express.Router();
const pool = require("../db");
const { checkPeriodStatus, checkPeriodStatusForUpdate } = require("../middleware/checkPeriodStatus");

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
              m.is_posted, m.is_confirmed
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
    
    const sql = selectedFYearID
      ? `SELECT COALESCE(MAX(purch_ret_no), 0) + 1 AS next_no FROM trn_purchase_return_master WHERE fyear_id = $1`
      : `SELECT COALESCE(MAX(purch_ret_no), 0) + 1 AS next_no FROM trn_purchase_return_master`;
    const params = selectedFYearID ? [selectedFYearID] : [];
    
    const result = await pool.query(sql, params);
    const next_no = result.rows[0]?.next_no || 1;
    
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
router.post("/", checkPeriodStatus, async (req, res) => {
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
    is_confirmed = false,
    deleted = false,
  } = header;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // If purch_ret_no is missing or marked as 'NEW', allocate the next number atomically
    let retNoToUse = purch_ret_no;
    
    const needsAutoNumber = purch_ret_no === undefined || purch_ret_no === null || String(purch_ret_no).trim() === "" || String(purch_ret_no).toUpperCase() === "NEW";
    
    if (needsAutoNumber) {
      await client.query("LOCK TABLE trn_purchase_return_master IN EXCLUSIVE MODE");
      const sql = fyear_id
        ? `SELECT COALESCE(MAX(purch_ret_no), 0) + 1 AS next_no FROM trn_purchase_return_master WHERE fyear_id = $1`
        : `SELECT COALESCE(MAX(purch_ret_no), 0) + 1 AS next_no FROM trn_purchase_return_master`;
      const params = fyear_id ? [fyear_id] : [];
      
      const r = await client.query(sql, params);
      retNoToUse = r.rows[0]?.next_no || 1;
    }

    const result = await client.query(
      `INSERT INTO trn_purchase_return_master
       (fyear_id, purch_ret_no, tran_date, party_id, remark,
        taxable_total, cgst_amount, sgst_amount, igst_amount, rounded_off, total_amount, is_posted, is_confirmed, deleted)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
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
        !!is_confirmed,
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
    
    const response = { 
      success: true, 
      pret_id, 
      purch_ret_id: pret_id, // Alias for frontend compatibility
      purch_ret_no: savedReturnNo 
    };
    
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
router.put("/:purchRetId", checkPeriodStatusForUpdate, async (req, res) => {
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
    is_confirmed = false,
    deleted = false,
  } = req.body || {};

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existing = await client.query(
      `SELECT is_posted, is_confirmed FROM trn_purchase_return_master WHERE pret_id=$1 FOR UPDATE`,
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
           taxable_total=$5, cgst_amount=$6, sgst_amount=$7, igst_amount=$8, rounded_off=$9, total_amount=$10, is_posted=$11, is_confirmed=$12, deleted=$13
       WHERE pret_id=$14`,
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
        !!is_confirmed,
        !!deleted,
        purchRetId,
      ]
    );

    // NOTE: Stock updates are handled in /confirm endpoint, not here

    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Failed to update purchase return" });
  } finally {
    client.release();
  }
});

// Replace all detail rows for a purchase return
router.post("/:purchRetId/items/replace", checkPeriodStatus, async (req, res) => {
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

// Confirm purchase return - Updates inventory and creates stock ledger entries
router.post("/:purchRetId/confirm", checkPeriodStatus, async (req, res) => {
  const { purchRetId } = req.params;
  if (!/^\d+$/.test(String(purchRetId))) {
    return res.status(400).json({ error: "Invalid purchase return id" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Check if purchase return exists and is not already confirmed or posted
    const existing = await client.query(
      `SELECT is_confirmed, is_posted, fyear_id, tran_date FROM trn_purchase_return_master WHERE pret_id = $1 FOR UPDATE`,
      [purchRetId]
    );

    if (existing.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Purchase return not found" });
    }

    const { is_confirmed, is_posted, fyear_id, tran_date } = existing.rows[0];

    if (is_confirmed) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Purchase return is already confirmed" });
    }

    if (is_posted) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Purchase return is already posted" });
    }

    // Get return details with item info for stock ledger
    const detailsForLedger = await client.query(
      `SELECT d.item_code, d.qty, i.unit 
       FROM trn_purchase_return_detail d
       LEFT JOIN tblmasitem i ON d.item_code = i.itemcode
       WHERE d.pret_mas_id = $1`,
      [purchRetId]
    );

    // Create stock ledger entries and update inventory
    for (const row of detailsForLedger.rows || []) {
      const { item_code, qty, unit } = row;
      if (!item_code || !qty || qty <= 0) continue;

      // Insert stock ledger entry for purchase return (OUT transaction - negative qty)
      await client.query(
        `INSERT INTO trn_stock_ledger 
         (fyear_id, inv_master_id, itemcode, tran_type, tran_date, unit, qty)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [fyear_id, purchRetId, item_code, 'PRET', tran_date, unit || '', -qty]
      );

      // Update item master stock (reduce stock for return)
      await client.query(
        `UPDATE tblmasitem 
         SET curstock = GREATEST(0, curstock - $1)
         WHERE itemcode = $2`,
        [qty, item_code]
      );
    }

    // Update to confirmed status
    await client.query(
      `UPDATE trn_purchase_return_master SET is_confirmed = true WHERE pret_id = $1`,
      [purchRetId]
    );

    await client.query("COMMIT");
    res.json({ success: true, message: "Purchase return confirmed and inventory updated successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Failed to confirm purchase return" });
  } finally {
    client.release();
  }
});

// Post purchase return (create accounting entries only - stock already updated in confirm)
router.post("/:purchRetId/post", checkPeriodStatus, async (req, res) => {
  const { purchRetId } = req.params;
  if (!/^\d+$/.test(String(purchRetId))) {
    return res.status(400).json({ error: "Invalid purchase return id" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Check if purchase return exists and is confirmed but not posted
    const existing = await client.query(
      `SELECT is_confirmed, is_posted, fyear_id, tran_date FROM trn_purchase_return_master WHERE pret_id = $1 FOR UPDATE`,
      [purchRetId]
    );

    if (existing.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Purchase return not found" });
    }

    const { is_confirmed, is_posted, fyear_id, tran_date } = existing.rows[0];

    if (!is_confirmed) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Purchase return must be confirmed before posting" });
    }

    if (is_posted) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Purchase return is already posted" });
    }

    // NOTE: Stock updates and ledger entries are handled in /confirm endpoint
    // This endpoint only handles accounting entries

    // ========================================
    // DYNAMIC JOURNAL GENERATION FOR PURCHASE RETURN
    // ========================================
    
    // Check if journals already exist for this purchase return and delete them
    const existingJournalsRes = await client.query(
      `SELECT journal_mas_id, journal_serial 
       FROM public.acc_journal_master 
       WHERE source_document_type = 'PURCHASE_RETURN' 
       AND source_document_id = $1`,
      [purchRetId]
    );
    
    if (existingJournalsRes.rows.length > 0) {
      for (const journal of existingJournalsRes.rows) {
        // Delete journal details first
        await client.query(
          `DELETE FROM public.acc_journal_detail WHERE journal_mas_id = $1`,
          [journal.journal_mas_id]
        );
        // Delete journal master
        await client.query(
          `DELETE FROM public.acc_journal_master WHERE journal_mas_id = $1`,
          [journal.journal_mas_id]
        );
      }
    }
    
    // Get purchase return master data for journal generation
    const returnMasterRes = await client.query(
      `SELECT m.pret_id, m.fyear_id, m.purch_ret_no, m.tran_date, m.party_id,
              m.taxable_total, m.cgst_amount, m.sgst_amount, m.igst_amount, m.rounded_off, m.total_amount,
              COALESCE(p.partyname, 'Unknown Supplier') as supplier_name
       FROM trn_purchase_return_master m
       LEFT JOIN tblmasparty p ON m.party_id = p.partyid
       WHERE m.pret_id = $1`,
      [purchRetId]
    );
    
    const returnMaster = returnMasterRes.rows[0];
    if (!returnMaster) {
      throw new Error('Purchase return master not found for journal generation');
    }
    
    const num = (v) => parseFloat(v ?? 0) || 0;
    
    const totalAmount = num(returnMaster.total_amount);
    const taxableTotal = num(returnMaster.taxable_total);
    const cgstAmount = num(returnMaster.cgst_amount);
    const sgstAmount = num(returnMaster.sgst_amount);
    const igstAmount = num(returnMaster.igst_amount);
    const roundedOff = num(returnMaster.rounded_off);
    
    // Get all mappings for Purchase Return
    const mappingsRes = await client.query(`
      SELECT 
        mapping_id, transaction_type, event_code, entry_sequence,
        account_nature, debit_credit, value_source, description_template, is_dynamic_dc
      FROM con_transaction_mapping 
      WHERE UPPER(TRIM(transaction_type)) = 'PURCHASE RETURN'
         AND TRIM(event_code) = 'PUR_RET'
      ORDER BY event_code, entry_sequence
    `);
    
    
    if (mappingsRes.rows.length > 0) {
      
      // Prepare transaction data for value source mapping
      const transactionData = {
        PURCHASE_RETURN_TOTAL_AMOUNT: totalAmount,
        PURCHASE_RETURN_TAXABLE_AMOUNT: taxableTotal,
        PURCHASE_RETURN_CGST_AMOUNT: cgstAmount,
          PURCHASE_RETURN_SGST_AMOUNT: sgstAmount,
          PURCHASE_RETURN_IGST_AMOUNT: igstAmount,
          ROUND_OFF_AMOUNT: roundedOff
        };
        
        
        try {
          // Group mappings by event_code
          const eventGroups = {};
          mappingsRes.rows.forEach(mapping => {
            if (!eventGroups[mapping.event_code]) {
              eventGroups[mapping.event_code] = [];
            }
            eventGroups[mapping.event_code].push(mapping);
          });
          
          
          // Create journal entries for each event code
          for (const [eventCode, mappings] of Object.entries(eventGroups)) {
            
            // Create journal master entry
            const journalMasterRes = await client.query(`
              INSERT INTO public.acc_journal_master 
              (journal_date, finyearid, journal_serial, source_document_type, source_document_ref, 
               source_document_id, total_debit, total_credit, narration, created_date)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
              RETURNING journal_mas_id
            `, [
              returnMaster.tran_date,
              returnMaster.fyear_id || 1,
              `PRET-${returnMaster.purch_ret_no}-${eventCode}`,
              'PURCHASE_RETURN',
              `PRET-${returnMaster.purch_ret_no}-${eventCode}`,
              purchRetId,
              0, // Will be updated after calculating totals
              0,
              `Purchase Return for ${returnMaster.supplier_name}`
            ]);
            
            const journalMasId = journalMasterRes.rows[0].journal_mas_id;
            
            let eventDebits = 0, eventCredits = 0;
            
            // Generate journal detail entries
            for (const mapping of mappings) {
              const amount = transactionData[mapping.value_source] || 0;
              
              
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
                } else {
                  continue;
                }
                
                // Generate description from template
                let description = mapping.description_template || `${mapping.account_nature} - Return ${returnMaster.purch_ret_no}`;
                description = description
                  .replace('{{purch_ret_no}}', returnMaster.purch_ret_no || '')
                  .replace('{{tran_date}}', returnMaster.tran_date || '');
                
                
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
              }
            }
            
            // Update journal master with totals
            await client.query(`
              UPDATE public.acc_journal_master 
              SET total_debit = $1, total_credit = $2
              WHERE journal_mas_id = $3
            `, [eventDebits, eventCredits, journalMasId]);
            
          }
          
          
        } catch (journalError) {
          console.error('Error creating journal entries:', journalError);
          throw journalError; // Re-throw to trigger rollback
        }
      } else {
      }

    // Populate acc_trn_invoice table for purchase return tracking
    try {
      // Get the full purchase return data
      const returnData = await client.query(
        `SELECT fyear_id, party_id, purch_ret_no, tran_date, total_amount 
         FROM trn_purchase_return_master WHERE pret_id = $1`,
        [purchRetId]
      );
      
      if (returnData.rows.length > 0) {
        const returnInfo = returnData.rows[0];
        
        // For purchase returns, use positive amounts (the tran_type indicates it's a return)
        // The constraint requires tran_amount >= 0 and paid_amount >= 0
        await client.query(`
          INSERT INTO public.acc_trn_invoice (
            fyear_id, party_id, tran_type, inv_master_id, tran_date, 
            party_inv_no, party_inv_date, tran_amount, paid_amount, 
            balance_amount, status, inv_reference, is_posted
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `, [
          returnInfo.fyear_id || 1,      // fyear_id
          returnInfo.party_id,           // party_id (supplier)
          'PUR_RET',                     // tran_type (Purchase Return)
          purchRetId,                    // inv_master_id (using return ID)
          returnInfo.tran_date,          // tran_date
          returnInfo.purch_ret_no,       // party_inv_no (return number)
          returnInfo.tran_date,          // party_inv_date
          Math.abs(returnInfo.total_amount || 0), // tran_amount (positive - constraint requires >= 0)
          0,                             // paid_amount (initially 0)
          Math.abs(returnInfo.total_amount || 0), // balance_amount (positive - calculated as tran - paid)
          0,                             // status (0 = Open)
          `PRET-${returnInfo.purch_ret_no}`, // inv_reference
          true                           // is_posted
        ]);
      }
    } catch (accTrnError) {
      console.error('Error populating acc_trn_invoice table for purchase return:', accTrnError);
      // Don't throw error - this shouldn't stop the posting process
    }

    // Update to posted status (after all journal and accounting entries are created)
    await client.query(
      `UPDATE trn_purchase_return_master SET is_posted = true WHERE pret_id = $1`,
      [purchRetId]
    );

    await client.query("COMMIT");
    res.json({ success: true, message: "Purchase return posted successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Failed to post purchase return" });
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
