const express = require("express");
const router = express.Router();
const pool = require("../db");

const nn = (v) => (v === undefined || v === null || String(v).trim() === "" ? null : v);

// Get all payments
router.get("/", async (req, res) => {
  const { fromDate, toDate, vendorId, fyearId } = req.query || {};
  const where = [];
  const params = [];
  
  if (fromDate) { params.push(fromDate); where.push(`p.payment_date >= $${params.length}`); }
  if (toDate) { params.push(toDate); where.push(`p.payment_date <= $${params.length}`); }
  if (vendorId) { params.push(vendorId); where.push(`p.party_id = $${params.length}`); }
  if (fyearId) { params.push(fyearId); where.push(`p.fyear_id = $${params.length}`); }
  
  const filter = where.length ? `WHERE ${where.join(" AND ")}` : "";

  try {
    const result = await pool.query(
      `SELECT p.payment_id, p.payment_no, p.payment_date, p.payment_reference,
              party.partyname as vendor_name, p.payment_mode, p.payment_amount,
              p.is_confirmed, p.is_posted
       FROM acc_trn_payment_voucher p
       LEFT JOIN tblmasparty party ON p.party_id = party.partyid
       ${filter}
       ORDER BY p.payment_date DESC, p.payment_no DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch payments" });
  }
});

// Get next payment number
router.get("/next-number", async (req, res) => {
  try {
    const fyearId = req.query.fyear_id || 1;
    const result = await pool.query(
      `SELECT COALESCE(MAX(payment_no), 0) + 1 AS next_no 
       FROM acc_trn_payment_voucher WHERE fyear_id = $1`,
      [fyearId]
    );
    res.json({ next_no: result.rows[0]?.next_no || 1 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate next payment number" });
  }
});

// Get outstanding invoices for vendor
router.get("/vendor/:vendorId/outstanding", async (req, res) => {
  const { vendorId } = req.params;
  const fyearId = req.query.fyear_id || 1;
  
  try {
    const result = await pool.query(
      `SELECT tran_id, party_inv_no, tran_date, tran_amount, 
              paid_amount, balance_amount, inv_reference
       FROM acc_trn_invoice
       WHERE party_id = $1 
         AND fyear_id = $2
         AND tran_type = 'PUR'
         AND balance_amount > 0
         AND is_posted = TRUE
       ORDER BY tran_date ASC`,
      [vendorId, fyearId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch outstanding invoices" });
  }
});

// Get single payment
router.get("/:paymentId", async (req, res) => {
  const { paymentId } = req.params;

  try {
    const header = await pool.query(
      `SELECT p.*, party.partyname as vendor_name
       FROM acc_trn_payment_voucher p
       LEFT JOIN tblmasparty party ON p.party_id = party.partyid
       WHERE p.payment_id = $1`,
      [paymentId]
    );

    if (header.rows.length === 0) {
      return res.status(404).json({ error: "Payment not found" });
    }

    const allocations = await pool.query(
      `SELECT a.*, i.party_inv_no, i.tran_date as inv_date, 
              i.tran_amount as inv_amount, i.paid_amount, i.balance_amount
       FROM acc_trn_payment_allocation a
       LEFT JOIN acc_trn_invoice i ON a.purchase_inv_id = i.tran_id
       WHERE a.payment_id = $1
       ORDER BY i.tran_date`,
      [paymentId]
    );

    const cheque = await pool.query(
      `SELECT * FROM acc_trn_cheque WHERE voucher_id = $1 AND voucher_type = 'PAYMENT'`,
      [paymentId]
    );

    res.json({
      header: header.rows[0],
      allocations: allocations.rows,
      cheque: cheque.rows[0] || null
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch payment" });
  }
});

// Create payment
router.post("/", async (req, res) => {
  const { header = {}, allocations = [], cheque = null } = req.body || {};
  
  console.log('=== Payment Creation Request ===');
  console.log('Header:', JSON.stringify(header, null, 2));
  console.log('Allocations:', JSON.stringify(allocations, null, 2));
  console.log('Cheque:', JSON.stringify(cheque, null, 2));
  
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let paymentNo = header.payment_no;
    if (!paymentNo) {
      const maxResult = await client.query(
        `SELECT COALESCE(MAX(payment_no), 0) + 1 AS next_no 
         FROM acc_trn_payment_voucher WHERE fyear_id = $1`,
        [header.fyear_id || 1]
      );
      paymentNo = maxResult.rows[0].next_no;
    }

    console.log('Inserting payment with values:', {
      fyear_id: header.fyear_id || 1,
      payment_no: paymentNo,
      payment_date: header.payment_date,
      payment_reference: nn(header.payment_reference),
      party_id: header.party_id,
      payment_mode: header.payment_mode || 'CASH',
      payment_amount: header.payment_amount,
      cash_account_id: nn(header.cash_account_id),
      bank_account_id: nn(header.bank_account_id),
      narration: nn(header.narration)
    });

    const headerResult = await client.query(
      `INSERT INTO acc_trn_payment_voucher
       (fyear_id, payment_no, payment_date, payment_reference, party_id, 
        payment_mode, payment_amount, cash_account_id, bank_account_id, narration)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING payment_id`,
      [
        header.fyear_id || 1,
        paymentNo,
        header.payment_date,
        nn(header.payment_reference),
        header.party_id,
        header.payment_mode || 'CASH',
        header.payment_amount,
        nn(header.cash_account_id),
        nn(header.bank_account_id),
        nn(header.narration)
      ]
    );

    const paymentId = headerResult.rows[0].payment_id;

    for (const alloc of allocations) {
      if (alloc.allocated_amount > 0) {
        await client.query(
          `INSERT INTO acc_trn_payment_allocation
           (payment_id, purchase_inv_id, allocated_amount)
           VALUES ($1, $2, $3)`,
          [paymentId, alloc.purchase_inv_id, alloc.allocated_amount]
        );
      }
    }

    if (header.payment_mode === 'CHEQUE' && cheque) {
      await client.query(
        `INSERT INTO acc_trn_cheque
         (voucher_id, voucher_type, cheque_no, cheque_date, clearing_date, bank_name, 
          branch_name, cheque_amount, cheque_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          paymentId,
          'PAYMENT',
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
    console.log('✓ Payment created successfully:', paymentId);
    res.json({ 
      success: true, 
      payment_id: paymentId,
      payment_no: paymentNo
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error('❌ Payment creation error:', err);
    console.error('Error message:', err.message);
    console.error('Error detail:', err.detail);
    console.error('Error code:', err.code);
    res.status(500).json({ error: "Failed to create payment", details: err.message });
  } finally {
    client.release();
  }
});

// Update payment
router.put("/:paymentId", async (req, res) => {
  const { paymentId } = req.params;
  const { header = {}, allocations = [], cheque = null } = req.body || {};
  
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existing = await client.query(
      `SELECT is_confirmed FROM acc_trn_payment_voucher WHERE payment_id = $1`,
      [paymentId]
    );

    if (existing.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Payment not found" });
    }

    if (existing.rows[0].is_confirmed) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Cannot edit confirmed payment" });
    }

    await client.query(
      `UPDATE acc_trn_payment_voucher
       SET payment_date = $1, payment_reference = $2, party_id = $3,
           payment_mode = $4, payment_amount = $5, cash_account_id = $6,
           bank_account_id = $7, narration = $8, edited_date = NOW()
       WHERE payment_id = $9`,
      [
        header.payment_date,
        nn(header.payment_reference),
        header.party_id,
        header.payment_mode,
        header.payment_amount,
        nn(header.cash_account_id),
        nn(header.bank_account_id),
        nn(header.narration),
        paymentId
      ]
    );

    await client.query(`DELETE FROM acc_trn_payment_allocation WHERE payment_id = $1`, [paymentId]);
    
    for (const alloc of allocations) {
      if (alloc.allocated_amount > 0) {
        await client.query(
          `INSERT INTO acc_trn_payment_allocation
           (payment_id, purchase_inv_id, allocated_amount)
           VALUES ($1, $2, $3)`,
          [paymentId, alloc.purchase_inv_id, alloc.allocated_amount]
        );
      }
    }

    await client.query(`DELETE FROM acc_trn_cheque WHERE voucher_id = $1 AND voucher_type = 'PAYMENT'`, [paymentId]);
    
    if (header.payment_mode === 'CHEQUE' && cheque) {
      await client.query(
        `INSERT INTO acc_trn_cheque
         (voucher_id, voucher_type, cheque_no, cheque_date, clearing_date, bank_name, 
          branch_name, cheque_amount, cheque_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          paymentId,
          'PAYMENT',
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
    res.status(500).json({ error: "Failed to update payment", details: err.message });
  } finally {
    client.release();
  }
});

// Confirm payment
router.post("/:paymentId/confirm", async (req, res) => {
  const { paymentId } = req.params;
  
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const payment = await client.query(
      `SELECT is_confirmed FROM acc_trn_payment_voucher WHERE payment_id = $1`,
      [paymentId]
    );

    if (payment.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Payment not found" });
    }

    if (payment.rows[0].is_confirmed) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Payment already confirmed" });
    }

    const allocations = await client.query(
      `SELECT purchase_inv_id, allocated_amount FROM acc_trn_payment_allocation WHERE payment_id = $1`,
      [paymentId]
    );

    for (const alloc of allocations.rows) {
      await client.query(
        `UPDATE acc_trn_invoice
         SET paid_amount = paid_amount + $1,
             balance_amount = tran_amount - (paid_amount + $1),
             status = CASE 
               WHEN (tran_amount - (paid_amount + $1)) = 0 THEN 2
               WHEN (paid_amount + $1) > 0 THEN 1
               ELSE 0
             END,
             edited_date = NOW()
         WHERE tran_id = $2`,
        [alloc.allocated_amount, alloc.purchase_inv_id]
      );
    }

    await client.query(
      `UPDATE acc_trn_payment_voucher SET is_confirmed = TRUE, edited_date = NOW() WHERE payment_id = $1`,
      [paymentId]
    );

    await client.query("COMMIT");
    res.json({ success: true, message: "Payment confirmed successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Failed to confirm payment", details: err.message });
  } finally {
    client.release();
  }
});

// Post payment
router.post("/:paymentId/post", async (req, res) => {
  const { paymentId } = req.params;
  
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const payment = await client.query(
      `SELECT p.*, party.partyname
       FROM acc_trn_payment_voucher p
       LEFT JOIN tblmasparty party ON p.party_id = party.partyid
       WHERE p.payment_id = $1`,
      [paymentId]
    );

    if (payment.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Payment not found" });
    }

    const pmt = payment.rows[0];

    if (!pmt.is_confirmed) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Payment must be confirmed before posting" });
    }

    if (pmt.is_posted) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Payment already posted" });
    }

    const journalSerial = `PAY-${pmt.payment_no}`;
    const journalResult = await client.query(
      `INSERT INTO acc_journal_master
       (journal_date, finyearid, journal_serial, source_document_type, source_document_ref,
        source_document_id, total_debit, total_credit, narration)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8)
       RETURNING journal_mas_id`,
      [
        pmt.payment_date,
        pmt.fyear_id,
        journalSerial,
        'VENDOR_PAYMENT',
        `PAY-${pmt.payment_no}`,
        paymentId,
        pmt.payment_amount,
        `Payment to ${pmt.partyname} - ${pmt.payment_reference || ''}`
      ]
    );

    const journalMasId = journalResult.rows[0].journal_mas_id;

    const apAccount = await client.query(
      `SELECT account_id FROM acc_mas_coa 
       WHERE UPPER(TRIM(account_nature)) = 'AP_CONTROL' AND is_active = TRUE LIMIT 1`
    );

    if (apAccount.rows.length > 0) {
      await client.query(
        `INSERT INTO acc_journal_detail
         (journal_mas_id, account_id, party_id, debit_amount, description)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          journalMasId,
          apAccount.rows[0].account_id,
          pmt.party_id,
          pmt.payment_amount,
          `Payment to ${pmt.partyname}`
        ]
      );
    }

    const accountId = pmt.payment_mode === 'CASH' ? pmt.cash_account_id : pmt.bank_account_id;
    
    if (accountId) {
      await client.query(
        `INSERT INTO acc_journal_detail
         (journal_mas_id, account_id, credit_amount, description)
         VALUES ($1, $2, $3, $4)`,
        [
          journalMasId,
          accountId,
          pmt.payment_amount,
          `Payment via ${pmt.payment_mode} - ${pmt.payment_reference || ''}`
        ]
      );
    }

    await client.query(
      `UPDATE acc_trn_payment_voucher SET is_posted = TRUE, edited_date = NOW() WHERE payment_id = $1`,
      [paymentId]
    );

    await client.query("COMMIT");
    res.json({ success: true, message: "Payment posted successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Failed to post payment", details: err.message });
  } finally {
    client.release();
  }
});

// Delete payment
router.delete("/:paymentId", async (req, res) => {
  const { paymentId } = req.params;
  
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const payment = await client.query(
      `SELECT is_confirmed FROM acc_trn_payment_voucher WHERE payment_id = $1`,
      [paymentId]
    );

    if (payment.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Payment not found" });
    }

    if (payment.rows[0].is_confirmed) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Cannot delete confirmed payment" });
    }

    await client.query(`DELETE FROM acc_trn_payment_voucher WHERE payment_id = $1`, [paymentId]);

    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Failed to delete payment", details: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
