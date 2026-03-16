const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { checkPermission } = require('../middleware/checkPermission');

// Get Party Ledger (Customer or Supplier) — reads from acc_journal_detail
router.get('/ledger', authenticateToken, checkPermission('ACCOUNTS_Customer_Ledger_View'), async (req, res) => {
  let client;
  try {
    const { partyId, partyType, fromDate, toDate } = req.query;

    if (!partyId || !partyType || !fromDate || !toDate) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    client = await pool.connect();

    // Get party details including their GL account id
    const partyResult = await client.query(
      `SELECT partyid, partycode, partyname, gstnum, address1, contactno, accountid
       FROM tblmasparty
       WHERE partyid = $1 AND partytype = $2`,
      [partyId, partyType]
    );

    if (partyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Party not found' });
    }

    const party = partyResult.rows[0];
    const accountId = party.accountid;

    if (!accountId) {
      return res.status(400).json({ error: 'Party has no linked GL account. Please set accountid in tblmasparty.' });
    }

    // Opening balance: sum of journal lines for this account+party before fromDate
    const openingResult = await client.query(`
      SELECT
        COALESCE(SUM(jd.debit_amount), 0)  AS total_debit,
        COALESCE(SUM(jd.credit_amount), 0) AS total_credit
      FROM acc_journal_detail jd
      INNER JOIN acc_journal_master jm ON jd.journal_mas_id = jm.journal_mas_id
      WHERE jd.account_id = $1
        AND (
          jd.party_id = $2
          OR (
            jd.party_id IS NULL
            AND jm.journal_mas_id IN (
              SELECT DISTINCT jd2.journal_mas_id
              FROM acc_journal_detail jd2
              WHERE jd2.party_id = $2
            )
          )
        )
        AND jm.journal_date < $3
    `, [accountId, partyId, fromDate]);

    const openingDebit = parseFloat(openingResult.rows[0].total_debit) || 0;
    const openingCredit = parseFloat(openingResult.rows[0].total_credit) || 0;
    // Net opening: positive = Dr balance (customer owes us)
    const openingNet = openingDebit - openingCredit;
    const openingBalanceType = openingNet >= 0 ? 'Dr' : 'Cr';

    // Transactions for the period — one row per journal line (never mixed debit+credit)
    // Filter: account_id = party's AR account (primary), party_id = partyId (secondary)
    // Also include lines where party_id IS NULL but journal is linked to this party's invoices
    const txnResult = await client.query(`
      SELECT
        jm.journal_date                                    AS date,
        jm.journal_serial                                  AS document_no,
        COALESCE(jm.source_document_ref, jm.journal_serial) AS ref,
        jm.source_document_type                            AS doc_type,
        COALESCE(jd.description, jm.narration, '')         AS narration,
        jd.debit_amount,
        jd.credit_amount
      FROM acc_journal_detail jd
      INNER JOIN acc_journal_master jm ON jd.journal_mas_id = jm.journal_mas_id
      WHERE jd.account_id = $1
        AND (
          jd.party_id = $2
          OR (
            jd.party_id IS NULL
            AND jm.journal_mas_id IN (
              SELECT DISTINCT jd2.journal_mas_id
              FROM acc_journal_detail jd2
              WHERE jd2.party_id = $2
            )
          )
        )
        AND jm.journal_date BETWEEN $3 AND $4
      ORDER BY jm.journal_date, jm.journal_mas_id
    `, [accountId, partyId, fromDate, toDate]);

    // Build running balance
    let runningBalance = openingNet; // signed: positive = Dr
    const transactions = txnResult.rows.map(row => {
      const debit = parseFloat(row.debit_amount) || 0;
      const credit = parseFloat(row.credit_amount) || 0;
      runningBalance += (debit - credit);

      // Friendly description from source_document_type
      const docType = (row.doc_type || '').toUpperCase();
      let description = row.narration;
      if (!description || description.trim() === '') {
        if (docType.includes('SALES_RETURN') || docType.includes('SAL_RET')) description = 'Sales Return';
        else if (docType.includes('SALES')) description = 'Sales Invoice';
        else if (docType.includes('PURCHASE_RETURN') || docType.includes('PUR_RET')) description = 'Purchase Return';
        else if (docType.includes('PURCHASE')) description = 'Purchase Invoice';
        else if (docType.includes('RECEIPT')) description = 'Receipt';
        else if (docType.includes('PAYMENT')) description = 'Payment';
        else description = row.doc_type || '';
      }

      return {
        date: row.date,
        document_no: row.ref || row.document_no || '',
        description,
        debit: debit > 0 ? debit : 0,
        credit: credit > 0 ? credit : 0,
        balance: Math.abs(runningBalance),
        balance_type: runningBalance >= 0 ? 'Dr' : 'Cr'
      };
    });

    const totalDebit = transactions.reduce((s, t) => s + t.debit, 0);
    const totalCredit = transactions.reduce((s, t) => s + t.credit, 0);

    res.json({
      party,
      period: { from: fromDate, to: toDate },
      opening_balance: {
        amount: Math.abs(openingNet),
        type: openingBalanceType
      },
      transactions,
      totals: { total_debit: totalDebit, total_credit: totalCredit },
      closing_balance: {
        amount: Math.abs(runningBalance),
        type: runningBalance >= 0 ? 'Dr' : 'Cr'
      }
    });

  } catch (error) {
    console.error('Error generating ledger report:', error);
    res.status(500).json({ error: 'Failed to generate ledger report', details: error.message });
  } finally {
    if (client) client.release();
  }
});

// Get Party Aging Report (Customer or Supplier)
router.get('/aging', authenticateToken, checkPermission('ACCOUNTS_Customer_Aging_View'), async (req, res) => {
  let client;
  try {
    const { partyId, partyType, toDate } = req.query;

    if (!partyId || !partyType || !toDate) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    client = await pool.connect();

    // Get party details
    const partyResult = await client.query(
      `SELECT partyid, partycode, partyname, gstnum, address1, contactno, accountid
       FROM tblmasparty
       WHERE partyid = $1 AND partytype = $2`,
      [partyId, partyType]
    );

    if (partyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Party not found' });
    }

    const party = partyResult.rows[0];

    // Outstanding per invoice = tran_amount - SUM(allocated receipts)
    // This is accurate regardless of whether receipts are allocated or not
    const invoicesResult = await client.query(`
      SELECT
        i.tran_id,
        COALESCE(i.party_inv_no, i.inv_reference, i.tran_id::text) AS document_no,
        i.tran_date                                                  AS date,
        i.tran_amount                                                AS amount,
        COALESCE(SUM(a.allocated_amount), 0)                         AS allocated,
        i.tran_amount - COALESCE(SUM(a.allocated_amount), 0)         AS outstanding,
        ($1::date - i.tran_date::date)                               AS days_overdue
      FROM acc_trn_invoice i
      LEFT JOIN acc_trn_receipt_allocation a ON a.invoice_id = i.tran_id
      WHERE i.party_id = $2
        AND i.tran_type = 'SAL'
        AND i.is_posted = true
        AND i.tran_date <= $1
      GROUP BY i.tran_id, i.party_inv_no, i.inv_reference, i.tran_date, i.tran_amount
      HAVING i.tran_amount - COALESCE(SUM(a.allocated_amount), 0) > 0.01
      ORDER BY i.tran_date
    `, [toDate, partyId]);

    // Total sales returns up to toDate — these reduce the customer's outstanding balance
    const returnsResult = await client.query(`
      SELECT COALESCE(SUM(tran_amount), 0) AS total_returns
      FROM acc_trn_invoice
      WHERE party_id = $1
        AND tran_type = 'SAL_RET'
        AND is_posted = true
        AND tran_date <= $2
    `, [partyId, toDate]);

    const totalReturns = parseFloat(returnsResult.rows[0].total_returns) || 0;

    // Unallocated receipts reduce the net outstanding even if not matched to specific invoices
    const unallocatedResult = await client.query(`
      SELECT COALESCE(SUM(unallocated_amount), 0) AS total_unallocated
      FROM acc_trn_receipts_voucher
      WHERE party_id = $1
        AND is_posted = true
        AND receipt_date <= $2
        AND unallocated_amount > 0.01
    `, [partyId, toDate]);

    const totalUnallocated = parseFloat(unallocatedResult.rows[0].total_unallocated) || 0;

    // Aging buckets
    const agingBuckets = {
      current: 0,    // 0-30 days
      '31_60': 0,    // 31-60 days
      '61_90': 0,    // 61-90 days
      '91_180': 0,   // 91-180 days
      over_180: 0    // 180+ days
    };

    let totalOutstanding = 0;

    const agingDetails = invoicesResult.rows.map(item => {
      const outstanding = parseFloat(item.outstanding) || 0;
      const daysOverdue = parseInt(item.days_overdue) || 0;

      totalOutstanding += outstanding;

      if (daysOverdue <= 30)       agingBuckets.current   += outstanding;
      else if (daysOverdue <= 60)  agingBuckets['31_60']  += outstanding;
      else if (daysOverdue <= 90)  agingBuckets['61_90']  += outstanding;
      else if (daysOverdue <= 180) agingBuckets['91_180'] += outstanding;
      else                         agingBuckets.over_180  += outstanding;

      return {
        document_no:  item.document_no,
        date:         item.date,
        amount:       parseFloat(item.amount) || 0,
        allocated:    parseFloat(item.allocated) || 0,
        outstanding,
        days_overdue: daysOverdue
      };
    });

    // Net outstanding = invoice outstanding - unallocated receipts - sales returns
    const netOutstanding = Math.max(0, totalOutstanding - totalUnallocated - totalReturns);

    res.json({
      party,
      as_on_date: toDate,
      total_outstanding: totalOutstanding,
      total_unallocated_receipts: totalUnallocated,
      total_sales_returns: totalReturns,
      net_outstanding: netOutstanding,
      aging_buckets: agingBuckets,
      aging_details: agingDetails
    });

  } catch (error) {
    console.error('Error generating aging report:', error);
    res.status(500).json({ error: 'Failed to generate aging report', details: error.message });
  } finally {
    if (client) client.release();
  }
});

module.exports = router;
