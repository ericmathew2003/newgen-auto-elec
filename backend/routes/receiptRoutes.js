const express = require("express");
const router = express.Router();
const pool = require("../db");
const { checkPeriodStatus, checkPeriodStatusForUpdate } = require("../middleware/checkPeriodStatus");

const nn = (v) => (v === undefined || v === null || String(v).trim() === "" ? null : v);

// Get all receipts
router.get("/", async (req, res) => {
  const { fromDate, toDate, customerId, fyearId } = req.query || {};
  const where = [];
  const params = [];
  
  if (fromDate) { params.push(fromDate); where.push(`r.receipt_date >= $${params.length}`); }
  if (toDate) { params.push(toDate); where.push(`r.receipt_date <= $${params.length}`); }
  if (customerId) { params.push(customerId); where.push(`r.party_id = $${params.length}`); }
  if (fyearId) { params.push(fyearId); where.push(`r.fyear_id = $${params.length}`); }
  
  const filter = where.length ? `WHERE ${where.join(" AND ")}` : "";

  try {
    const result = await pool.query(
      `SELECT r.receipt_id, r.receipt_no, r.receipt_date, r.reference_number,
              party.partyname as customer_name, r.receipt_mode, r.receipt_amount,
              r.is_confirmed, r.is_posted
       FROM acc_trn_receipts_voucher r
       LEFT JOIN tblmasparty party ON r.party_id = party.partyid
       ${filter}
       ORDER BY r.receipt_date DESC, r.receipt_no DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch receipts" });
  }
});

// Get next receipt number
router.get("/next-number", async (req, res) => {
  try {
    const fyearId = req.query.fyear_id || 1;
    const result = await pool.query(
      `SELECT COALESCE(MAX(receipt_no), 0) + 1 AS next_no 
       FROM acc_trn_receipts_voucher WHERE fyear_id = $1`,
      [fyearId]
    );
    res.json({ next_no: result.rows[0]?.next_no || 1 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate next receipt number" });
  }
});

// Get outstanding invoices for customer
router.get("/customer/:customerId/outstanding", async (req, res) => {
  const { customerId } = req.params;
  const fyearId = req.query.fyear_id || 1;
  
  try {
    const result = await pool.query(
      `SELECT tran_id, party_inv_no, tran_date, tran_amount, 
              paid_amount, balance_amount, inv_reference
       FROM acc_trn_invoice
       WHERE party_id = $1 
         AND fyear_id = $2
         AND tran_type = 'SAL'
         AND balance_amount > 0
         AND is_posted = TRUE
       ORDER BY tran_date ASC`,
      [customerId, fyearId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch outstanding invoices" });
  }
});

// Get single receipt
router.get("/:receiptId", async (req, res) => {
  const { receiptId } = req.params;

  try {
    const header = await pool.query(
      `SELECT r.*, party.partyname as customer_name
       FROM acc_trn_receipts_voucher r
       LEFT JOIN tblmasparty party ON r.party_id = party.partyid
       WHERE r.receipt_id = $1`,
      [receiptId]
    );

    if (header.rows.length === 0) {
      return res.status(404).json({ error: "Receipt not found" });
    }

    const allocations = await pool.query(
      `SELECT a.*, i.party_inv_no, i.tran_date as inv_date, 
              i.tran_amount as inv_amount, i.paid_amount, i.balance_amount
       FROM acc_trn_receipt_allocation a
       LEFT JOIN acc_trn_invoice i ON a.invoice_id = i.tran_id
       WHERE a.receipt_id = $1
       ORDER BY i.tran_date`,
      [receiptId]
    );

    const cheque = await pool.query(
      `SELECT * FROM acc_trn_cheque WHERE voucher_id = $1 AND voucher_type = 'RECEIPT'`,
      [receiptId]
    );

    res.json({
      header: header.rows[0],
      allocations: allocations.rows,
      cheque: cheque.rows[0] || null
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch receipt" });
  }
});

// Create receipt
router.post("/", checkPeriodStatus, async (req, res) => {
  const { header = {}, allocations = [], cheque = null } = req.body || {};
  
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let receiptNo = header.receipt_no;
    if (!receiptNo) {
      const maxResult = await client.query(
        `SELECT COALESCE(MAX(receipt_no), 0) + 1 AS next_no 
         FROM acc_trn_receipts_voucher WHERE fyear_id = $1`,
        [header.fyear_id || 1]
      );
      receiptNo = maxResult.rows[0].next_no;
    }

    const totalAllocated = allocations.reduce((sum, a) => sum + (parseFloat(a.allocated_amount) || 0), 0);
    const unallocatedAmount = (parseFloat(header.receipt_amount) || 0) - totalAllocated;

    const headerResult = await client.query(
      `INSERT INTO acc_trn_receipts_voucher
       (fyear_id, receipt_no, receipt_date, reference_number, party_id, 
        receipt_mode, receipt_amount, receipt_account_id, unallocated_amount, narration)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING receipt_id`,
      [
        header.fyear_id || 1,
        receiptNo,
        header.receipt_date,
        nn(header.reference_number),
        header.party_id,
        header.receipt_mode || 'CASH',
        header.receipt_amount,
        header.receipt_account_id,
        unallocatedAmount,
        nn(header.narration)
      ]
    );

    const receiptId = headerResult.rows[0].receipt_id;

    for (const alloc of allocations) {
      if (alloc.allocated_amount > 0) {
        await client.query(
          `INSERT INTO acc_trn_receipt_allocation
           (receipt_id, invoice_id, allocated_amount)
           VALUES ($1, $2, $3)`,
          [receiptId, alloc.invoice_id, alloc.allocated_amount]
        );
      }
    }

    if (header.receipt_mode === 'CHEQUE' && cheque) {
      await client.query(
        `INSERT INTO acc_trn_cheque
         (voucher_id, voucher_type, cheque_no, cheque_date, clearing_date, bank_name, 
          branch_name, cheque_amount, cheque_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          receiptId,
          'RECEIPT',
          cheque.cheque_no,
          cheque.cheque_date,
          nn(cheque.clearing_date),
          cheque.bank_name,
          nn(cheque.branch_name),
          cheque.cheque_amount,
          cheque.cheque_status || 'ISSUED'
        ]
      );
    }

    await client.query("COMMIT");
    res.json({ 
      success: true, 
      receipt_id: receiptId,
      receipt_no: receiptNo
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Failed to create receipt", details: err.message });
  } finally {
    client.release();
  }
});

// Update receipt
router.put("/:receiptId", checkPeriodStatusForUpdate, async (req, res) => {
  const { receiptId } = req.params;
  const { header = {}, allocations = [], cheque = null } = req.body || {};
  
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existing = await client.query(
      `SELECT is_confirmed FROM acc_trn_receipts_voucher WHERE receipt_id = $1`,
      [receiptId]
    );

    if (existing.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Receipt not found" });
    }

    if (existing.rows[0].is_confirmed) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Cannot edit confirmed receipt" });
    }

    const totalAllocated = allocations.reduce((sum, a) => sum + (parseFloat(a.allocated_amount) || 0), 0);
    const unallocatedAmount = (parseFloat(header.receipt_amount) || 0) - totalAllocated;

    await client.query(
      `UPDATE acc_trn_receipts_voucher
       SET receipt_date = $1, reference_number = $2, party_id = $3,
           receipt_mode = $4, receipt_amount = $5, receipt_account_id = $6,
           unallocated_amount = $7, narration = $8, edited_date = NOW()
       WHERE receipt_id = $9`,
      [
        header.receipt_date,
        nn(header.reference_number),
        header.party_id,
        header.receipt_mode,
        header.receipt_amount,
        header.receipt_account_id,
        unallocatedAmount,
        nn(header.narration),
        receiptId
      ]
    );

    await client.query(`DELETE FROM acc_trn_receipt_allocation WHERE receipt_id = $1`, [receiptId]);
    
    for (const alloc of allocations) {
      if (alloc.allocated_amount > 0) {
        await client.query(
          `INSERT INTO acc_trn_receipt_allocation
           (receipt_id, invoice_id, allocated_amount)
           VALUES ($1, $2, $3)`,
          [receiptId, alloc.invoice_id, alloc.allocated_amount]
        );
      }
    }

    await client.query(`DELETE FROM acc_trn_cheque WHERE voucher_id = $1 AND voucher_type = 'RECEIPT'`, [receiptId]);
    
    if (header.receipt_mode === 'CHEQUE' && cheque) {
      await client.query(
        `INSERT INTO acc_trn_cheque
         (voucher_id, voucher_type, cheque_no, cheque_date, clearing_date, bank_name, 
          branch_name, cheque_amount, cheque_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          receiptId,
          'RECEIPT',
          cheque.cheque_no,
          cheque.cheque_date,
          nn(cheque.clearing_date),
          cheque.bank_name,
          nn(cheque.branch_name),
          cheque.cheque_amount,
          cheque.cheque_status || 'ISSUED'
        ]
      );
    }

    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Failed to update receipt", details: err.message });
  } finally {
    client.release();
  }
});

// Confirm and Post receipt (merged operation)
router.post("/:receiptId/confirm", checkPeriodStatus, async (req, res) => {
  const { receiptId } = req.params;
  
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Get receipt with party details
    const receipt = await client.query(
      `SELECT r.*, party.partyname
       FROM acc_trn_receipts_voucher r
       LEFT JOIN tblmasparty party ON r.party_id = party.partyid
       WHERE r.receipt_id = $1`,
      [receiptId]
    );

    if (receipt.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Receipt not found" });
    }

    const rct = receipt.rows[0];

    if (rct.is_confirmed) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Receipt already confirmed and posted" });
    }

    // Step 1: Update invoice allocations (paid_amount, balance_amount, status)
    const allocations = await client.query(
      `SELECT a.invoice_id, a.allocated_amount, i.inv_master_id
       FROM acc_trn_receipt_allocation a
       JOIN acc_trn_invoice i ON i.tran_id = a.invoice_id
       WHERE a.receipt_id = $1`,
      [receiptId]
    );

    for (const alloc of allocations.rows) {
      const newPaidAmount = await client.query(
        `SELECT (paid_amount + $1::numeric) as new_paid, tran_amount FROM acc_trn_invoice WHERE tran_id = $2`,
        [alloc.allocated_amount, alloc.invoice_id]
      );
      
      const { new_paid, tran_amount } = newPaidAmount.rows[0];
      const newBalance = parseFloat(tran_amount) - parseFloat(new_paid);
      
      await client.query(
        `UPDATE acc_trn_invoice
         SET paid_amount = $1::numeric,
             balance_amount = $2::numeric,
             status = CASE 
               WHEN $2::numeric <= 0.01 THEN 2
               WHEN $1::numeric > 0 THEN 1
               ELSE 0
             END,
             edited_date = NOW()
         WHERE tran_id = $3`,
        [new_paid, newBalance, alloc.invoice_id]
      );

      // Check if invoice is fully paid and update is_paid flag
      if (newBalance <= 0.01) {
        await client.query(
          `UPDATE trn_invoice_master SET is_paid = TRUE WHERE inv_master_id = $1`,
          [alloc.inv_master_id]
        );
      }
    }

    // Step 2: Create journal entries
    const journalSerial = `RCT-${rct.receipt_no}`;
    const journalResult = await client.query(
      `INSERT INTO acc_journal_master
       (journal_date, finyearid, journal_serial, source_document_type, source_document_ref,
        source_document_id, total_debit, total_credit, narration)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8)
       RETURNING journal_mas_id`,
      [
        rct.receipt_date,
        rct.fyear_id,
        journalSerial,
        'CUSTOMER_RECEIPT',
        `RCT-${rct.receipt_no}`,
        receiptId,
        rct.receipt_amount,
        `Receipt from ${rct.partyname} - ${rct.reference_number || ''}`
      ]
    );

    const journalMasId = journalResult.rows[0].journal_mas_id;

    // Debit: Cash/Bank Account
    await client.query(
      `INSERT INTO acc_journal_detail
       (journal_mas_id, account_id, debit_amount, description)
       VALUES ($1, $2, $3, $4)`,
      [
        journalMasId,
        rct.receipt_account_id,
        rct.receipt_amount,
        `Receipt via ${rct.receipt_mode} - ${rct.reference_number || ''}`
      ]
    );

    // Credit: AR Control Account
    const arAccount = await client.query(
      `SELECT account_id FROM acc_mas_coa 
       WHERE UPPER(TRIM(account_nature)) = 'AR_CONTROL' AND is_active = TRUE LIMIT 1`
    );

    if (arAccount.rows.length > 0) {
      await client.query(
        `INSERT INTO acc_journal_detail
         (journal_mas_id, account_id, party_id, credit_amount, description)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          journalMasId,
          arAccount.rows[0].account_id,
          rct.party_id,
          rct.receipt_amount,
          `Receipt from ${rct.partyname}`
        ]
      );
    }

    // Step 3: Mark as confirmed and posted
    await client.query(
      `UPDATE acc_trn_receipts_voucher 
       SET is_confirmed = TRUE, is_posted = TRUE, edited_date = NOW() 
       WHERE receipt_id = $1`,
      [receiptId]
    );

    await client.query("COMMIT");
    res.json({ success: true, message: "Receipt confirmed and posted successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Failed to confirm and post receipt", details: err.message });
  } finally {
    client.release();
  }
});

// Post receipt (kept for backward compatibility, but now just calls confirm logic)
router.post("/:receiptId/post", checkPeriodStatus, async (req, res) => {
  const { receiptId } = req.params;
  
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const receipt = await client.query(
      `SELECT is_posted FROM acc_trn_receipts_voucher WHERE receipt_id = $1`,
      [receiptId]
    );

    if (receipt.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Receipt not found" });
    }

    if (receipt.rows[0].is_posted) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Receipt already posted" });
    }

    // Receipt exists but not posted, this shouldn't happen with new flow
    // but handle it gracefully
    await client.query("ROLLBACK");
    return res.status(400).json({ 
      error: "Receipt must be confirmed first. Confirm operation now handles both confirmation and posting." 
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Failed to post receipt", details: err.message });
  } finally {
    client.release();
  }
});

// Delete receipt
router.delete("/:receiptId", async (req, res) => {
  const { receiptId } = req.params;
  
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const receipt = await client.query(
      `SELECT is_confirmed FROM acc_trn_receipts_voucher WHERE receipt_id = $1`,
      [receiptId]
    );

    if (receipt.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Receipt not found" });
    }

    if (receipt.rows[0].is_confirmed) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Cannot delete confirmed receipt" });
    }

    await client.query(`DELETE FROM acc_trn_receipts_voucher WHERE receipt_id = $1`, [receiptId]);

    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Failed to delete receipt", details: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
