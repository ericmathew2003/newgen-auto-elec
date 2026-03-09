const pool = require('../db');

/**
 * Middleware to check if a financial period is open for transactions
 * Validates that the transaction date falls within an open period
 */
const checkPeriodStatus = async (req, res, next) => {
  try {
    // Extract transaction date and financial year from request body
    // Support multiple field name conventions and nested structures
    const { 
      TrDate, FYearID, fyearid, finyearid,  // Purchase/General format (top level)
      inv_date, fyear_id,                    // Sales format (top level)
      journal_date,                          // Journal entry format (top level)
      credit_note_date,                      // Credit note format (top level)
      debit_note_date,                       // Debit note format (top level)
      header                                 // Nested format (returns, payments, receipts)
    } = req.body;
    
    // Check top level first, then nested header
    let transactionDate = TrDate || inv_date || journal_date || credit_note_date || debit_note_date;
    let financialYearId = FYearID || fyearid || fyear_id || finyearid;
    
    // If not found at top level, check inside header object
    // Field names: sales_ret_date, tran_date (purchase return), payment_date, receipt_date, voucher_date
    if (!transactionDate && header) {
      transactionDate = header.TrDate || header.inv_date || header.sales_ret_date || 
                       header.tran_date || header.payment_date || header.receipt_date ||
                       header.voucher_date || header.journal_date;
    }
    
    if (!financialYearId && header) {
      financialYearId = header.FYearID || header.fyearid || header.fyear_id || header.finyearid;
    }

    // If no transaction date or financial year, skip validation
    if (!transactionDate || !financialYearId) {
      return next();
    }

    // Check if the transaction date falls within a closed period
    const periodCheck = await pool.query(`
      SELECT 
        fp.period_id,
        fp.period_name,
        fp.status,
        fp.start_date,
        fp.end_date,
        fy.finyearname
      FROM public.acc_financial_period fp
      JOIN public.tblfinyear fy ON fp.finyearid = fy.finyearid
      WHERE fp.finyearid = $1
        AND $2::date BETWEEN fp.start_date AND fp.end_date
    `, [financialYearId, transactionDate]);

    if (periodCheck.rows.length === 0) {
      return res.status(400).json({
        error: 'Transaction date does not fall within any defined financial period',
        details: 'Please check the transaction date and financial year'
      });
    }

    const period = periodCheck.rows[0];

    // Check if period is closed
    if (period.status === 'Closed' || period.status === 'LOCKED') {
      return res.status(403).json({
        error: `Period "${period.period_name}" is closed`,
        details: `Transactions cannot be posted to closed periods. Please contact your administrator to reopen the period.`,
        periodInfo: {
          periodName: period.period_name,
          status: period.status,
          startDate: period.start_date,
          endDate: period.end_date,
          financialYear: period.finyearname
        }
      });
    }

    // Period is open, allow transaction to proceed
    req.periodInfo = period;
    next();

  } catch (error) {
    console.error('Error checking period status:', error);
    res.status(500).json({
      error: 'Failed to validate financial period',
      details: error.message
    });
  }
};

/**
 * Middleware specifically for update operations
 * Checks both the original transaction date and new transaction date
 */
const checkPeriodStatusForUpdate = async (req, res, next) => {
  try {
    const { 
      TrDate, FYearID, fyearid, finyearid,  // Purchase/General format (top level)
      inv_date, fyear_id,                    // Sales format (top level)
      journal_date,                          // Journal entry format (top level)
      credit_note_date,                      // Credit note format (top level)
      debit_note_date,                       // Debit note format (top level)
      header                                 // Nested format (returns, payments, receipts)
    } = req.body;
    
    // Check top level first, then nested header
    let transactionDate = TrDate || inv_date || journal_date || credit_note_date || debit_note_date;
    let financialYearId = FYearID || fyearid || fyear_id || finyearid;
    
    // If not found at top level, check inside header object
    // Field names: sales_ret_date, tran_date (purchase return), payment_date, receipt_date, voucher_date
    if (!transactionDate && header) {
      transactionDate = header.TrDate || header.inv_date || header.sales_ret_date || 
                       header.tran_date || header.payment_date || header.receipt_date ||
                       header.voucher_date || header.journal_date;
    }
    
    if (!financialYearId && header) {
      financialYearId = header.FYearID || header.fyearid || header.fyear_id || header.finyearid;
    }

    if (!transactionDate || !financialYearId) {
      return next();
    }

    // Check if the new transaction date falls within a closed period
    const periodCheck = await pool.query(`
      SELECT 
        fp.period_id,
        fp.period_name,
        fp.status,
        fp.start_date,
        fp.end_date,
        fy.finyearname
      FROM public.acc_financial_period fp
      JOIN public.tblfinyear fy ON fp.finyearid = fy.finyearid
      WHERE fp.finyearid = $1
        AND $2::date BETWEEN fp.start_date AND fp.end_date
    `, [financialYearId, transactionDate]);

    if (periodCheck.rows.length === 0) {
      return res.status(400).json({
        error: 'Transaction date does not fall within any defined financial period'
      });
    }

    const period = periodCheck.rows[0];

    if (period.status === 'Closed' || period.status === 'LOCKED') {
      return res.status(403).json({
        error: `Period "${period.period_name}" is closed`,
        details: `Cannot modify transactions in closed periods.`,
        periodInfo: {
          periodName: period.period_name,
          status: period.status
        }
      });
    }

    req.periodInfo = period;
    next();

  } catch (error) {
    console.error('Error checking period status for update:', error);
    res.status(500).json({
      error: 'Failed to validate financial period',
      details: error.message
    });
  }
};

module.exports = {
  checkPeriodStatus,
  checkPeriodStatusForUpdate
};
