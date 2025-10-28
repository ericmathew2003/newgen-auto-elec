const express = require("express");
const router = express.Router();
const pool = require("../db");

// Get business notifications
router.get("/", async (req, res) => {
  try {
    const notifications = [];

    // 1. Low Stock Items (items with current stock <= 5)
    const lowStockResult = await pool.query(`
      SELECT itemname, curstock 
      FROM tblmasitem 
      WHERE COALESCE(curstock, 0) <= 5 
      AND COALESCE(curstock, 0) >= 0
      ORDER BY curstock ASC 
      LIMIT 5
    `);

    lowStockResult.rows.forEach(item => {
      notifications.push({
        id: `low-stock-${item.itemname}`,
        type: 'warning',
        title: 'Low Stock Alert',
        message: `${item.itemname} - Only ${item.curstock || 0} units left`,
        timestamp: new Date().toISOString(),
        priority: 'high'
      });
    });

    // 2. Recent Sales (last 3 sales)
    const recentSalesResult = await pool.query(`
      SELECT m.inv_no, m.inv_date, m.tot_amount, 
             COALESCE(p.partyname, m.customer_name) as customer_name
      FROM trn_invoice_master m
      LEFT JOIN tblmasparty p ON p.partyid = m.party_id
      WHERE m.is_deleted = false
      ORDER BY m.inv_date DESC, m.inv_master_id DESC
      LIMIT 3
    `);

    recentSalesResult.rows.forEach(sale => {
      notifications.push({
        id: `sale-${sale.inv_no}`,
        type: 'success',
        title: 'New Sale Recorded',
        message: `Invoice #${sale.inv_no} - ₹${sale.tot_amount} to ${sale.customer_name}`,
        timestamp: sale.inv_date,
        priority: 'medium'
      });
    });

    // 3. Recent Purchases (last 2 purchases)
    const recentPurchasesResult = await pool.query(`
      SELECT h.tranid, h.trdate, h.invamount, p.partyname
      FROM tbltrnhdr h
      LEFT JOIN tblmasparty p ON p.partyid = h.partyid
      ORDER BY h.trdate DESC, h.tranid DESC
      LIMIT 2
    `);

    recentPurchasesResult.rows.forEach(purchase => {
      notifications.push({
        id: `purchase-${purchase.tranid}`,
        type: 'info',
        title: 'Purchase Recorded',
        message: `Purchase #${purchase.tranid} - ₹${purchase.invamount} from ${purchase.partyname}`,
        timestamp: purchase.trdate,
        priority: 'medium'
      });
    });

    // 4. Items with Zero Stock
    const zeroStockResult = await pool.query(`
      SELECT COUNT(*) as count 
      FROM tblmasitem 
      WHERE COALESCE(curstock, 0) = 0
    `);

    if (zeroStockResult.rows[0].count > 0) {
      notifications.push({
        id: 'zero-stock-alert',
        type: 'error',
        title: 'Out of Stock Items',
        message: `${zeroStockResult.rows[0].count} items are completely out of stock`,
        timestamp: new Date().toISOString(),
        priority: 'high'
      });
    }

    // Sort by priority and timestamp
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    notifications.sort((a, b) => {
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }
      return new Date(b.timestamp) - new Date(a.timestamp);
    });

    res.json(notifications.slice(0, 10)); // Limit to 10 notifications
  } catch (err) {
    console.error("Error fetching notifications:", err);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

// Mark notification as read (optional for future use)
router.post("/:id/read", async (req, res) => {
  try {
    // For now, just return success
    // In future, you could store read status in database
    res.json({ success: true });
  } catch (err) {
    console.error("Error marking notification as read:", err);
    res.status(500).json({ error: "Failed to mark notification as read" });
  }
});

module.exports = router;