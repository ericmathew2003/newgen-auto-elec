const express = require("express");
const router = express.Router();
const pool = require("../db");
const { authenticateToken } = require("../middleware/auth");
const { checkPermission } = require("../middleware/checkPermission");

/**
 * Get Stock In Hand Report
 * Query params:
 * - reportType: 'group-wise' or 'all-items'
 * - groupId: (optional) specific group ID for group-wise report
 * - includeZeroStock: 'true' or 'false' (default: 'false')
 */
router.get("/stock-in-hand", authenticateToken, checkPermission('INVENTORY_STOCK_IN_HAND_REPORT_VIEW'), async (req, res) => {
  try {
    const { reportType = 'all-items', groupId, includeZeroStock = 'false' } = req.query;

    let query;
    let params = [];
    
    // Build WHERE clause
    const whereConditions = ['(i.deleted = FALSE OR i.deleted IS NULL)'];
    
    // Add zero stock filter if not including zero stock items
    if (includeZeroStock === 'false') {
      whereConditions.push('COALESCE(i.curstock, 0) > 0');
    }
    
    // Add group filter for group-wise report
    if (reportType === 'group-wise' && groupId) {
      params.push(groupId);
      whereConditions.push(`i.groupid = $${params.length}`);
    }
    
    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    if (reportType === 'group-wise') {
      // Group-wise report with totals per group
      query = `
        SELECT 
          g.groupid,
          g.groupname,
          i.itemcode as item_id,
          i.itemname as item_name,
          i.unit,
          COALESCE(i.curstock, 0) as qty,
          COALESCE(i.avgcost, 0) as cost,
          COALESCE(i.curstock, 0) * COALESCE(i.avgcost, 0) as value
        FROM tblmasitem i
        LEFT JOIN tblmasgroup g ON i.groupid = g.groupid
        ${whereClause}
        ORDER BY g.groupname, i.itemname
      `;
    } else {
      // All items report
      query = `
        SELECT 
          g.groupid,
          g.groupname,
          i.itemcode as item_id,
          i.itemname as item_name,
          i.unit,
          COALESCE(i.curstock, 0) as qty,
          COALESCE(i.avgcost, 0) as cost,
          COALESCE(i.curstock, 0) * COALESCE(i.avgcost, 0) as value
        FROM tblmasitem i
        LEFT JOIN tblmasgroup g ON i.groupid = g.groupid
        ${whereClause}
        ORDER BY g.groupname, i.itemname
      `;
    }

    const result = await pool.query(query, params);

    // Group the results by group and calculate totals
    const groupedData = {};
    let grandTotal = {
      qty: 0,
      value: 0
    };

    result.rows.forEach(row => {
      const groupName = row.groupname || 'Ungrouped';
      
      if (!groupedData[groupName]) {
        groupedData[groupName] = {
          groupid: row.groupid,
          groupname: groupName,
          items: [],
          totals: {
            qty: 0,
            value: 0
          }
        };
      }

      const qty = parseFloat(row.qty) || 0;
      const value = parseFloat(row.value) || 0;

      groupedData[groupName].items.push({
        item_id: row.item_id,
        item_name: row.item_name,
        unit: row.unit,
        qty: qty,
        cost: parseFloat(row.cost) || 0,
        value: value
      });

      groupedData[groupName].totals.qty += qty;
      groupedData[groupName].totals.value += value;

      grandTotal.qty += qty;
      grandTotal.value += value;
    });

    // Convert grouped data to array
    const groups = Object.values(groupedData);

    res.json({
      reportType,
      groups,
      grandTotal,
      generatedAt: new Date().toISOString()
    });

  } catch (err) {
    res.status(500).json({ 
      error: 'Failed to generate stock in hand report', 
      details: err.message 
    });
  }
});

/**
 * Get list of groups for filter dropdown
 */
router.get("/groups", authenticateToken, checkPermission('INVENTORY_STOCK_IN_HAND_REPORT_VIEW'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT groupid, groupname
      FROM tblmasgroup
      ORDER BY groupname
    `);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

module.exports = router;
