const express = require("express");
const router = express.Router();
const pool = require("../db");
const { authenticateToken } = require("../middleware/auth");
const { checkPermission } = require("../middleware/checkPermission");

/**
 * Get all invoices with filtering options
 */
router.get("/", authenticateToken, checkPermission('ACCOUNTS_INVOICE_VIEW'), async (req, res) => {
  try {
    const { 
      fyear_id, 
      party_id, 
      tran_type, 
      status, 
      from_date, 
      to_date,
      page = 1, 
      limit = 50 
    } = req.query;

    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;

    // Build WHERE conditions
    if (fyear_id) {
      whereConditions.push(`i.fyear_id = $${paramIndex++}`);
      queryParams.push(fyear_id);
    }

    if (party_id) {
      whereConditions.push(`i.party_id = $${paramIndex++}`);
      queryParams.push(party_id);
    }

    if (tran_type) {
      whereConditions.push(`i.tran_type = $${paramIndex++}`);
      queryParams.push(tran_type);
    }

    if (status !== undefined) {
      whereConditions.push(`i.status = $${paramIndex++}`);
      queryParams.push(status);
    }

    if (from_date) {
      whereConditions.push(`i.tran_date >= $${paramIndex++}`);
      queryParams.push(from_date);
    }

    if (to_date) {
      whereConditions.push(`i.tran_date <= $${paramIndex++}`);
      queryParams.push(to_date);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Calculate offset for pagination
    const offset = (page - 1) * limit;
    queryParams.push(limit, offset);

    const query = `
      SELECT 
        i.*,
        p.partyname,
        fy.finyearname
      FROM acc_trn_invoice i
      LEFT JOIN tblmasparty p ON i.party_id = p.partyid
      LEFT JOIN tblfinyear fy ON i.fyear_id = fy.finyearid
      ${whereClause}
      ORDER BY i.tran_date DESC, i.tran_id DESC
      LIMIT $${paramIndex - 1} OFFSET $${paramIndex}
    `;

    const result = await pool.query(query, queryParams);

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM acc_trn_invoice i
      ${whereClause}
    `;
    const countResult = await pool.query(countQuery, queryParams.slice(0, -2)); // Remove limit and offset

    res.json({
      invoices: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        pages: Math.ceil(countResult.rows[0].total / limit)
      }
    });

  } catch (err) {
    console.error('Error fetching invoices:', err);
    res.status(500).json({ error: "Failed to fetch invoices" });
  }
});

/**
 * Get single invoice by ID
 */
router.get("/:tranId", authenticateToken, checkPermission('ACCOUNTS_INVOICE_VIEW'), async (req, res) => {
  try {
    const { tranId } = req.params;

    const result = await pool.query(`
      SELECT 
        i.*,
        p.partyname,
        p.partyaddress,
        p.partycity,
        p.partystate,
        p.partygstin,
        fy.finyearname
      FROM acc_trn_invoice i
      LEFT JOIN tblmasparty p ON i.party_id = p.partyid
      LEFT JOIN tblfinyear fy ON i.fyear_id = fy.finyearid
      WHERE i.tran_id = $1
    `, [tranId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error('Error fetching invoice:', err);
    res.status(500).json({ error: "Failed to fetch invoice" });
  }
});

/**
 * Create new invoice (usually called from purchase/sales posting)
 */
router.post("/", authenticateToken, checkPermission('ACCOUNTS_INVOICE_ADD'), async (req, res) => {
  try {
    const {
      fyear_id,
      party_id,
      tran_type,
      inv_master_id,
      tran_date,
      party_inv_no,
      party_inv_date,
      tran_amount,
      paid_amount = 0,
      inv_reference,
      is_posted = true
    } = req.body;

    // Validate required fields
    if (!fyear_id || !party_id || !tran_type || !inv_master_id || !tran_date || !tran_amount) {
      return res.status(400).json({ 
        error: "Missing required fields: fyear_id, party_id, tran_type, inv_master_id, tran_date, tran_amount" 
      });
    }

    // Validate tran_type
    if (!['SAL', 'PUR', 'SAL_RET', 'PUR_RET'].includes(tran_type)) {
      return res.status(400).json({ 
        error: "Invalid tran_type. Must be one of: SAL, PUR, SAL_RET, PUR_RET" 
      });
    }

    const balance_amount = parseFloat(tran_amount) - parseFloat(paid_amount);

    const result = await pool.query(`
      INSERT INTO acc_trn_invoice 
      (fyear_id, party_id, tran_type, inv_master_id, tran_date, party_inv_no, party_inv_date, 
       tran_amount, paid_amount, balance_amount, inv_reference, is_posted)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [
      fyear_id, party_id, tran_type, inv_master_id, tran_date, 
      party_inv_no, party_inv_date, tran_amount, paid_amount, 
      balance_amount, inv_reference, is_posted
    ]);

    res.json({ 
      success: true, 
      invoice: result.rows[0],
      message: "Invoice created successfully" 
    });

  } catch (err) {
    console.error('Error creating invoice:', err);
    res.status(500).json({ error: "Failed to create invoice", details: err.message });
  }
});

/**
 * Update invoice (mainly for payment updates)
 */
router.put("/:tranId", authenticateToken, checkPermission('ACCOUNTS_INVOICE_EDIT'), async (req, res) => {
  try {
    const { tranId } = req.params;
    const {
      paid_amount,
      status,
      inv_reference
    } = req.body;

    // Get current invoice to calculate new balance
    const currentResult = await pool.query(`
      SELECT tran_amount, paid_amount FROM acc_trn_invoice WHERE tran_id = $1
    `, [tranId]);

    if (currentResult.rows.length === 0) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    const currentInvoice = currentResult.rows[0];
    const newPaidAmount = paid_amount !== undefined ? parseFloat(paid_amount) : parseFloat(currentInvoice.paid_amount);
    const balance_amount = parseFloat(currentInvoice.tran_amount) - newPaidAmount;

    // Determine status based on payment
    let newStatus = status;
    if (newStatus === undefined) {
      if (balance_amount <= 0) {
        newStatus = 2; // Closed
      } else if (newPaidAmount > 0) {
        newStatus = 1; // Partial
      } else {
        newStatus = 0; // Open
      }
    }

    const result = await pool.query(`
      UPDATE acc_trn_invoice 
      SET 
        paid_amount = $1,
        balance_amount = $2,
        status = $3,
        inv_reference = COALESCE($4, inv_reference),
        edited_date = now()
      WHERE tran_id = $5
      RETURNING *
    `, [newPaidAmount, balance_amount, newStatus, inv_reference, tranId]);

    res.json({ 
      success: true, 
      invoice: result.rows[0],
      message: "Invoice updated successfully" 
    });

  } catch (err) {
    console.error('Error updating invoice:', err);
    res.status(500).json({ error: "Failed to update invoice", details: err.message });
  }
});

/**
 * Get invoice summary/statistics
 */
router.get("/summary/stats", authenticateToken, checkPermission('ACCOUNTS_INVOICE_VIEW'), async (req, res) => {
  try {
    const { fyear_id, tran_type } = req.query;

    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;

    if (fyear_id) {
      whereConditions.push(`fyear_id = $${paramIndex++}`);
      queryParams.push(fyear_id);
    }

    if (tran_type) {
      whereConditions.push(`tran_type = $${paramIndex++}`);
      queryParams.push(tran_type);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const result = await pool.query(`
      SELECT 
        tran_type,
        COUNT(*) as total_invoices,
        SUM(tran_amount) as total_amount,
        SUM(paid_amount) as total_paid,
        SUM(balance_amount) as total_balance,
        COUNT(CASE WHEN status = 0 THEN 1 END) as open_invoices,
        COUNT(CASE WHEN status = 1 THEN 1 END) as partial_invoices,
        COUNT(CASE WHEN status = 2 THEN 1 END) as closed_invoices
      FROM acc_trn_invoice
      ${whereClause}
      GROUP BY tran_type
      ORDER BY tran_type
    `, queryParams);

    res.json(result.rows);

  } catch (err) {
    console.error('Error fetching invoice summary:', err);
    res.status(500).json({ error: "Failed to fetch invoice summary" });
  }
});

/**
 * Get outstanding invoices (unpaid/partially paid)
 */
router.get("/outstanding/list", authenticateToken, checkPermission('ACCOUNTS_INVOICE_VIEW'), async (req, res) => {
  try {
    const { fyear_id, party_id, tran_type } = req.query;

    let whereConditions = ['i.balance_amount > 0']; // Only outstanding invoices
    let queryParams = [];
    let paramIndex = 1;

    if (fyear_id) {
      whereConditions.push(`i.fyear_id = $${paramIndex++}`);
      queryParams.push(fyear_id);
    }

    if (party_id) {
      whereConditions.push(`i.party_id = $${paramIndex++}`);
      queryParams.push(party_id);
    }

    if (tran_type) {
      whereConditions.push(`i.tran_type = $${paramIndex++}`);
      queryParams.push(tran_type);
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    const result = await pool.query(`
      SELECT 
        i.*,
        p.partyname,
        EXTRACT(DAYS FROM (CURRENT_DATE - i.tran_date)) as days_outstanding
      FROM acc_trn_invoice i
      LEFT JOIN tblmasparty p ON i.party_id = p.partyid
      ${whereClause}
      ORDER BY i.tran_date ASC
    `, queryParams);

    res.json(result.rows);

  } catch (err) {
    console.error('Error fetching outstanding invoices:', err);
    res.status(500).json({ error: "Failed to fetch outstanding invoices" });
  }
});

/**
 * Get acc_trn_invoice record by inv_master_id
 * Used to get tran_id for payment allocation
 */
router.get("/by-master/:invMasterId", authenticateToken, async (req, res) => {
  try {
    const { invMasterId } = req.params;

    const result = await pool.query(`
      SELECT 
        tran_id,
        fyear_id,
        party_id,
        tran_type,
        inv_master_id,
        tran_date,
        party_inv_no,
        party_inv_date,
        tran_amount,
        paid_amount,
        balance_amount,
        status,
        inv_reference
      FROM acc_trn_invoice
      WHERE inv_master_id = $1
      LIMIT 1
    `, [invMasterId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Invoice not found in accounts receivable" });
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error('Error fetching invoice by master id:', err);
    res.status(500).json({ error: "Failed to fetch invoice" });
  }
});

module.exports = router;