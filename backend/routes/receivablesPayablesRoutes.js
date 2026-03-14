const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { checkPermission } = require('../middleware/checkPermission');

// Get Party Ledger (Customer or Supplier)
router.get('/ledger', authenticateToken, checkPermission('ACCOUNTS_Customer_Ledger_View'), async (req, res) => {
  try {
    const { partyId, partyType, fromDate, toDate } = req.query;

    console.log('=== Ledger Report Request ===');
    console.log('Party ID:', partyId);
    console.log('Party Type:', partyType);
    console.log('From Date:', fromDate);
    console.log('To Date:', toDate);

    if (!partyId || !partyType || !fromDate || !toDate) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Get party details
    const partyResult = await pool.query(
      `SELECT partyid, partycode, partyname, gstnum, address1, contactno
       FROM tblmasparty
       WHERE partyid = $1 AND partytype = $2`,
      [partyId, partyType]
    );

    if (partyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Party not found' });
    }

    const party = partyResult.rows[0];

    // Get opening balance (transactions before fromDate)
    const openingBalanceQuery = `
      SELECT 
        COALESCE(SUM(tran_amount), 0) as total_invoices,
        COALESCE(SUM(paid_amount), 0) as total_paid
      FROM acc_trn_invoice
      WHERE party_id = $1
      AND tran_date < $2
      AND is_posted = true
    `;

    const openingResult = await pool.query(openingBalanceQuery, [partyId, fromDate]);
    const openingInvoices = parseFloat(openingResult.rows[0].total_invoices) || 0;
    const openingPaid = parseFloat(openingResult.rows[0].total_paid) || 0;
    
    let openingBalance = openingInvoices - openingPaid;
    let openingBalanceType = '';
    
    if (parseInt(partyType) === 1) {
      // Customer: Positive balance means customer owes us (Dr)
      openingBalanceType = openingBalance >= 0 ? 'Dr' : 'Cr';
    } else {
      // Supplier: Positive balance means we owe supplier (Cr)
      openingBalanceType = openingBalance >= 0 ? 'Cr' : 'Dr';
    }

    // Get transactions for the period
    const transactionsQuery = `
      SELECT 
        tran_id,
        tran_date as date,
        party_inv_no as document_no,
        CASE 
          WHEN tran_type = 'SAL' THEN 'Sales Invoice'
          WHEN tran_type = 'PUR' THEN 'Purchase Invoice'
          WHEN tran_type = 'PAYMENT' THEN 'Payment'
          WHEN tran_type = 'RECEIPT' THEN 'Receipt'
          WHEN tran_type = 'RETURN' THEN 'Return'
          ELSE tran_type
        END as description,
        tran_amount,
        paid_amount,
        balance_amount,
        inv_reference
      FROM acc_trn_invoice
      WHERE party_id = $1
      AND tran_date BETWEEN $2 AND $3
      AND is_posted = true
      ORDER BY tran_date, tran_id
    `;

    const transactionsResult = await pool.query(transactionsQuery, [partyId, fromDate, toDate]);

    console.log('Transactions found:', transactionsResult.rows.length);
    console.log('Transaction details:', JSON.stringify(transactionsResult.rows, null, 2));

    // Calculate running balance
    let runningBalance = Math.abs(openingBalance);
    let runningBalanceType = openingBalanceType;
    
    const transactions = transactionsResult.rows.map(txn => {
      const tranAmount = parseFloat(txn.tran_amount) || 0;
      const paidAmount = parseFloat(txn.paid_amount) || 0;

      let debit = 0;
      let credit = 0;

      if (parseInt(partyType) === 1) {
        // Customer: Invoice increases debit (customer owes us)
        // Payment increases credit (customer pays us)
        debit = tranAmount;  // Invoice amount
        credit = paidAmount; // Payment amount

        // Update running balance
        if (runningBalanceType === 'Dr') {
          runningBalance = runningBalance + debit - credit;
          if (runningBalance < 0) {
            runningBalance = Math.abs(runningBalance);
            runningBalanceType = 'Cr';
          }
        } else {
          runningBalance = runningBalance + credit - debit;
          if (runningBalance < 0) {
            runningBalance = Math.abs(runningBalance);
            runningBalanceType = 'Dr';
          }
        }
      } else {
        // Supplier: Invoice increases credit (we owe supplier)
        // Payment increases debit (we pay supplier)
        credit = tranAmount;  // Invoice amount
        debit = paidAmount;   // Payment amount

        // Update running balance
        if (runningBalanceType === 'Cr') {
          runningBalance = runningBalance + credit - debit;
          if (runningBalance < 0) {
            runningBalance = Math.abs(runningBalance);
            runningBalanceType = 'Dr';
          }
        } else {
          runningBalance = runningBalance + debit - credit;
          if (runningBalance < 0) {
            runningBalance = Math.abs(runningBalance);
            runningBalanceType = 'Cr';
          }
        }
      }

      return {
        date: txn.date,
        document_no: txn.document_no || txn.inv_reference || 'N/A',
        description: txn.description,
        debit: debit,
        credit: credit,
        balance: runningBalance,
        balance_type: runningBalanceType
      };
    });

    // Calculate totals
    const totalDebit = transactions.reduce((sum, txn) => sum + parseFloat(txn.debit), 0);
    const totalCredit = transactions.reduce((sum, txn) => sum + parseFloat(txn.credit), 0);

    res.json({
      party,
      period: { from: fromDate, to: toDate },
      opening_balance: {
        amount: Math.abs(openingBalance),
        type: openingBalanceType
      },
      transactions,
      totals: {
        total_debit: totalDebit,
        total_credit: totalCredit
      },
      closing_balance: {
        amount: runningBalance,
        type: runningBalanceType
      }
    });

  } catch (error) {
    console.error('Error generating ledger report:', error);
    res.status(500).json({ error: 'Failed to generate ledger report', details: error.message });
  }
});

// Get Party Aging Report (Customer or Supplier)
router.get('/aging', authenticateToken, checkPermission('ACCOUNTS_Customer_Aging_View'), async (req, res) => {
  try {
    const { partyId, partyType, fromDate, toDate } = req.query;

    if (!partyId || !partyType || !toDate) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Get party details
    const partyResult = await pool.query(
      `SELECT partyid, partycode, partyname, gstnum, address1, contactno
       FROM tblmasparty
       WHERE partyid = $1 AND partytype = $2`,
      [partyId, partyType]
    );

    if (partyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Party not found' });
    }

    const party = partyResult.rows[0];

    // Get outstanding invoices from acc_trn_invoice table
    const agingQuery = `
      SELECT 
        party_inv_no as document_no,
        tran_date as date,
        tran_amount as amount,
        paid_amount as paid,
        balance_amount as outstanding,
        ($2::date - tran_date::date) as days_overdue
      FROM acc_trn_invoice
      WHERE party_id = $1
      AND is_posted = true
      AND tran_date <= $2
      AND balance_amount > 0.01
      ORDER BY tran_date
    `;

    const agingResult = await pool.query(agingQuery, [partyId, toDate]);

    // Calculate aging buckets
    const agingBuckets = {
      current: 0,      // 0-30 days
      '31_60': 0,      // 31-60 days
      over_60: 0       // Over 60 days
    };

    let totalOutstanding = 0;

    const agingDetails = agingResult.rows.map(item => {
      const outstanding = parseFloat(item.outstanding) || 0;
      const daysOverdue = parseInt(item.days_overdue) || 0;

      totalOutstanding += outstanding;

      // Categorize into buckets
      if (daysOverdue <= 30) {
        agingBuckets.current += outstanding;
      } else if (daysOverdue <= 60) {
        agingBuckets['31_60'] += outstanding;
      } else {
        agingBuckets.over_60 += outstanding;
      }

      return {
        document_no: item.document_no || 'N/A',
        date: item.date,
        amount: parseFloat(item.amount) || 0,
        paid: parseFloat(item.paid) || 0,
        outstanding: outstanding,
        days_overdue: daysOverdue
      };
    });

    res.json({
      party,
      as_on_date: toDate,
      total_outstanding: totalOutstanding,
      aging_buckets: agingBuckets,
      aging_details: agingDetails
    });

  } catch (error) {
    console.error('Error generating aging report:', error);
    res.status(500).json({ error: 'Failed to generate aging report', details: error.message });
  }
});

module.exports = router;
