const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Dashboard metrics and charts
router.get('/summary', authenticateToken, async (req, res) => {
  try {
    const [purchaseTotals, salesTotals, suppliers, customers, itemStats, purchaseMonthly, salesMonthly] = await Promise.all([
      pool.query(`
        SELECT
          COALESCE(SUM(InvAmt),0) AS total_purchase,
          COALESCE(SUM(CGST+SGST+IGST),0) AS total_purchase_tax,
          COUNT(*) AS purchase_count
        FROM tblTrnPurchase
      `),
      pool.query(`
        SELECT
          COALESCE(SUM(tot_amount),0) AS total_sales,
          COALESCE(SUM(cgst_amount+sgst_amount+igst_amount),0) AS total_sales_tax,
          COUNT(*) AS sales_count
        FROM public.trn_invoice_master
        WHERE is_deleted = false
      `),
      // Use the same query as CustomerPage to ensure consistency
      pool.query(`
        SELECT COUNT(*) as suppliers 
        FROM (
          SELECT p.partyid, p.partytype
          FROM tblmasparty p
          LEFT JOIN acc_mas_account a ON p.accountid = a.account_id
        ) subq 
        WHERE CAST(COALESCE(subq.partytype, 0) AS INTEGER) = 2
      `),
      pool.query(`
        SELECT COUNT(*) as customers 
        FROM (
          SELECT p.partyid, p.partytype
          FROM tblmasparty p
          LEFT JOIN acc_mas_account a ON p.accountid = a.account_id
        ) subq 
        WHERE CAST(COALESCE(subq.partytype, 0) AS INTEGER) = 1
      `),
      pool.query(`
        SELECT 
          COUNT(*) as total_items,
          COUNT(CASE WHEN curstock < 10 AND curstock > 0 THEN 1 END) as low_stock_items,
          COUNT(CASE WHEN curstock = 0 THEN 1 END) as out_of_stock_items,
          COALESCE(SUM(curstock * cost), 0) as total_stock_value
        FROM tblMasItem 
        WHERE deleted = false OR deleted IS NULL
      `),
      pool.query(`
        SELECT to_char(TrDate, 'YYYY-MM') AS ym,
          COALESCE(SUM(InvAmt),0) AS total
        FROM tblTrnPurchase
        GROUP BY 1
        ORDER BY 1
      `),
      pool.query(`
        SELECT to_char(inv_date, 'YYYY-MM') AS ym,
          COALESCE(SUM(tot_amount),0) AS total
        FROM public.trn_invoice_master
        WHERE is_deleted = false
        GROUP BY 1
        ORDER BY 1
      `)
    ]);

    const total_purchase = Number(purchaseTotals.rows[0]?.total_purchase || 0);
    const total_purchase_tax = Number(purchaseTotals.rows[0]?.total_purchase_tax || 0);
    const purchase_count = Number(purchaseTotals.rows[0]?.purchase_count || 0);

    const total_sales = Number(salesTotals.rows[0]?.total_sales || 0);
    const total_sales_tax = Number(salesTotals.rows[0]?.total_sales_tax || 0);
    const sales_count = Number(salesTotals.rows[0]?.sales_count || 0);

    const suppliers_count = Number(suppliers.rows[0]?.suppliers || 0);
    const customers_count = Number(customers.rows[0]?.customers || 0);

    const total_items = Number(itemStats.rows[0]?.total_items || 0);
    const low_stock_items = Number(itemStats.rows[0]?.low_stock_items || 0);
    const out_of_stock_items = Number(itemStats.rows[0]?.out_of_stock_items || 0);
    const total_stock_value = Number(itemStats.rows[0]?.total_stock_value || 0);

    res.json({
      metrics: {
        totalPurchase: total_purchase,
        totalPurchaseTax: total_purchase_tax,
        purchaseCount: purchase_count,
        totalSales: total_sales,
        totalSalesTax: total_sales_tax,
        salesCount: sales_count,
        suppliers: suppliers_count,
        customers: customers_count,
        totalItems: total_items,
        lowStockItems: low_stock_items,
        outOfStockItems: out_of_stock_items,
        totalStockValue: total_stock_value,
      },
      charts: {
        purchaseMonthly: purchaseMonthly.rows, // [{ ym: '2025-01', total: 1234.56 }, ...]
        salesMonthly: salesMonthly.rows // [{ ym: '2025-01', total: 1234.56 }, ...]
      }
    });
  } catch (err) {
    console.error('Dashboard summary error:', err);
    res.status(500).json({ error: 'Failed to load dashboard data' });
  }
});

// Simple test endpoint
router.get('/test', (req, res) => {
  res.json({ message: 'Dashboard routes working!' });
});

// Dashboard statistics endpoint
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const stats = {
      totalItems: 0,
      totalSuppliers: 0,
      monthlyPurchases: 0,
      monthlyReturns: 0,
      lowStockItems: 0,
      recentTransactions: [],
      stockAlerts: [],
      topItems: []
    };

    // Get total items count
    try {
      const itemsResult = await pool.query(
        'SELECT COUNT(*) as count FROM tblmasitem WHERE deleted = false OR deleted IS NULL'
      );
      stats.totalItems = parseInt(itemsResult.rows[0].count) || 0;
    } catch (error) {
      console.log('Items table query failed, using 0');
      stats.totalItems = 0;
    }

    // Get total suppliers count (using same logic as CustomerPage)
    try {
      const suppliersResult = await pool.query(`
        SELECT COUNT(*) as count 
        FROM (
          SELECT p.partyid, p.partytype
          FROM tblmasparty p
          LEFT JOIN acc_mas_account a ON p.accountid = a.account_id
        ) subq 
        WHERE CAST(COALESCE(subq.partytype, 0) AS INTEGER) = 2
      `);
      stats.totalSuppliers = parseInt(suppliersResult.rows[0].count) || 0;
    } catch (error) {
      console.log('Suppliers query failed, using 0');
      stats.totalSuppliers = 0;
    }

    // Get total customers count (using same logic as CustomerPage)
    try {
      const customersResult = await pool.query(`
        SELECT COUNT(*) as count 
        FROM (
          SELECT p.partyid, p.partytype
          FROM tblmasparty p
          LEFT JOIN acc_mas_account a ON p.accountid = a.account_id
        ) subq 
        WHERE CAST(COALESCE(subq.partytype, 0) AS INTEGER) = 1
      `);
      stats.totalCustomers = parseInt(customersResult.rows[0].count) || 0;
    } catch (error) {
      console.log('Customers query failed, using 0');
      stats.totalCustomers = 0;
    }

    // Get monthly purchases amount
    try {
      const monthlyPurchasesResult = await pool.query(`
        SELECT COALESCE(SUM(invamt), 0) as total 
        FROM tbltrnpurchase 
        WHERE EXTRACT(MONTH FROM trdate) = EXTRACT(MONTH FROM CURRENT_DATE)
        AND EXTRACT(YEAR FROM trdate) = EXTRACT(YEAR FROM CURRENT_DATE)
        AND (is_cancelled = false OR is_cancelled IS NULL)
      `);
      stats.monthlyPurchases = parseFloat(monthlyPurchasesResult.rows[0].total) || 0;
    } catch (error) {
      console.log('Monthly purchases query failed, using 0');
      stats.monthlyPurchases = 0;
    }

    // Get monthly sales amount (from invoice master)
    try {
      const monthlySalesResult = await pool.query(`
        SELECT COALESCE(SUM(tot_amount), 0) as total 
        FROM trn_invoice_master 
        WHERE EXTRACT(MONTH FROM inv_date) = EXTRACT(MONTH FROM CURRENT_DATE)
        AND EXTRACT(YEAR FROM inv_date) = EXTRACT(YEAR FROM CURRENT_DATE)
        AND (is_deleted = false OR is_deleted IS NULL)
      `);
      stats.monthlyReturns = parseFloat(monthlySalesResult.rows[0].total) || 0;
    } catch (error) {
      console.log('Monthly sales query failed, using 0');
      stats.monthlyReturns = 0;
    }

    // Get low stock items (items with stock less than 10)
    try {
      const lowStockResult = await pool.query(
        'SELECT COUNT(*) as count FROM tblmasitem WHERE curstock < 10 AND (deleted = false OR deleted IS NULL)'
      );
      stats.lowStockItems = parseInt(lowStockResult.rows[0].count) || 0;
    } catch (error) {
      console.log('Low stock query failed, using 0');
      stats.lowStockItems = 0;
    }

    // Get recent transactions (purchases only if sales table doesn't exist)
    try {
      const recentPurchasesResult = await pool.query(`
        SELECT 
          p.trdate as date,
          p.invamt as amount,
          COALESCE(pt.partyname, 'Unknown Supplier') as party,
          'Purchase' as type
        FROM tbltrnpurchase p
        LEFT JOIN tblmasparty pt ON p.partyid = pt.partyid
        WHERE (p.is_cancelled = false OR p.is_cancelled IS NULL)
        AND p.trdate IS NOT NULL
        ORDER BY p.trdate DESC
        LIMIT 5
      `);

      stats.recentTransactions = recentPurchasesResult.rows.map(row => ({
        date: row.date ? new Date(row.date).toLocaleDateString() : 'Unknown',
        amount: parseFloat(row.amount || 0).toLocaleString(),
        party: row.party || 'Unknown',
        type: row.type
      }));

      // Try to add sales transactions if table exists
      try {
        const recentSalesResult = await pool.query(`
          SELECT 
            i.inv_date as date,
            i.tot_amount as amount,
            COALESCE(pt.partyname, i.customer_name, 'Unknown Customer') as party,
            'Sale' as type
          FROM trn_invoice_master i
          LEFT JOIN tblmasparty pt ON i.party_id = pt.partyid
          WHERE (i.is_deleted = false OR i.is_deleted IS NULL)
          AND i.inv_date IS NOT NULL
          ORDER BY i.inv_date DESC
          LIMIT 3
        `);

        const salesTransactions = recentSalesResult.rows.map(row => ({
          date: row.date ? new Date(row.date).toLocaleDateString() : 'Unknown',
          amount: parseFloat(row.amount || 0).toLocaleString(),
          party: row.party || 'Unknown',
          type: row.type
        }));

        // Combine and sort all transactions
        const allTransactions = [...stats.recentTransactions, ...salesTransactions]
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .slice(0, 5);

        stats.recentTransactions = allTransactions;
      } catch (salesError) {
        console.log('Sales transactions query failed, showing purchases only');
      }

    } catch (error) {
      console.log('Recent transactions query failed, using empty array');
      stats.recentTransactions = [];
    }

    // Get stock alerts (items with low stock)
    try {
      const stockAlertsResult = await pool.query(`
        SELECT 
          itemname,
          curstock as current_stock
        FROM tblmasitem 
        WHERE curstock < 10 
        AND (deleted = false OR deleted IS NULL)
        AND itemname IS NOT NULL
        ORDER BY curstock ASC
        LIMIT 10
      `);

      stats.stockAlerts = stockAlertsResult.rows.map(row => ({
        itemName: row.itemname || 'Unknown Item',
        currentStock: parseFloat(row.current_stock) || 0
      }));
    } catch (error) {
      console.log('Stock alerts query failed, using empty array');
      stats.stockAlerts = [];
    }

    // Get top items by stock value
    try {
      const topItemsResult = await pool.query(`
        SELECT 
          itemname,
          curstock,
          cost,
          (COALESCE(curstock, 0) * COALESCE(cost, 0)) as stock_value
        FROM tblmasitem 
        WHERE (deleted = false OR deleted IS NULL)
        AND COALESCE(curstock, 0) > 0
        AND COALESCE(cost, 0) > 0
        AND itemname IS NOT NULL
        ORDER BY stock_value DESC
        LIMIT 10
      `);

      stats.topItems = topItemsResult.rows.map(row => ({
        itemName: row.itemname || 'Unknown Item',
        stock: parseFloat(row.curstock) || 0,
        cost: parseFloat(row.cost) || 0,
        stockValue: parseFloat(row.stock_value) || 0
      }));
    } catch (error) {
      console.log('Top items query failed, using empty array');
      stats.topItems = [];
    }

    res.json(stats);
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({
      error: 'Failed to fetch dashboard statistics',
      details: error.message
    });
  }
});

// Get monthly trends
router.get('/trends', authenticateToken, async (req, res) => {
  try {
    const trends = {
      purchaseTrends: [],
      salesTrends: [],
      inventoryTrends: []
    };

    // Get last 6 months purchase trends
    try {
      const purchaseTrendsResult = await pool.query(`
        SELECT 
          EXTRACT(MONTH FROM trdate) as month,
          EXTRACT(YEAR FROM trdate) as year,
          COUNT(*) as transaction_count,
          COALESCE(SUM(invamt), 0) as total_amount
        FROM tbltrnpurchase 
        WHERE trdate >= CURRENT_DATE - INTERVAL '6 months'
        AND (is_cancelled = false OR is_cancelled IS NULL)
        GROUP BY EXTRACT(YEAR FROM trdate), EXTRACT(MONTH FROM trdate)
        ORDER BY year, month
      `);

      trends.purchaseTrends = purchaseTrendsResult.rows.map(row => ({
        month: parseInt(row.month),
        year: parseInt(row.year),
        transactionCount: parseInt(row.transaction_count),
        totalAmount: parseFloat(row.total_amount)
      }));
    } catch (error) {
      console.log('Purchase trends query failed, using empty array');
      trends.purchaseTrends = [];
    }

    // Get sales trends from invoice master
    try {
      const salesTrendsResult = await pool.query(`
        SELECT 
          EXTRACT(MONTH FROM inv_date) as month,
          EXTRACT(YEAR FROM inv_date) as year,
          COUNT(*) as transaction_count,
          COALESCE(SUM(tot_amount), 0) as total_amount
        FROM trn_invoice_master 
        WHERE inv_date >= CURRENT_DATE - INTERVAL '6 months'
        AND (is_deleted = false OR is_deleted IS NULL)
        GROUP BY EXTRACT(YEAR FROM inv_date), EXTRACT(MONTH FROM inv_date)
        ORDER BY year, month
      `);

      trends.salesTrends = salesTrendsResult.rows.map(row => ({
        month: parseInt(row.month),
        year: parseInt(row.year),
        transactionCount: parseInt(row.transaction_count),
        totalAmount: parseFloat(row.total_amount)
      }));
    } catch (error) {
      console.log('Sales trends query failed, using empty array');
      trends.salesTrends = [];
    }

    // Get inventory movement trends from stock ledger
    try {
      const inventoryTrendsResult = await pool.query(`
        SELECT 
          EXTRACT(MONTH FROM tran_date) as month,
          EXTRACT(YEAR FROM tran_date) as year,
          tran_type,
          COUNT(*) as movement_count,
          COALESCE(SUM(qty), 0) as total_qty
        FROM trn_stock_ledger 
        WHERE tran_date >= CURRENT_DATE - INTERVAL '6 months'
        GROUP BY EXTRACT(YEAR FROM tran_date), EXTRACT(MONTH FROM tran_date), tran_type
        ORDER BY year, month
      `);

      trends.inventoryTrends = inventoryTrendsResult.rows.map(row => ({
        month: parseInt(row.month),
        year: parseInt(row.year),
        type: row.tran_type,
        movementCount: parseInt(row.movement_count),
        totalQty: parseFloat(row.total_qty)
      }));
    } catch (error) {
      console.log('Inventory trends query failed, using empty array');
      trends.inventoryTrends = [];
    }

    res.json(trends);
  } catch (error) {
    console.error('Dashboard trends error:', error);
    res.status(500).json({
      error: 'Failed to fetch dashboard trends',
      details: error.message
    });
  }
});

// Get performance metrics
router.get('/performance', authenticateToken, async (req, res) => {
  try {
    const performance = {
      inventoryTurnover: '0.0',
      purchaseGrowthRate: '0.0',
      currentMonthPurchases: 0,
      currentMonthSales: 0
    };

    // Calculate inventory turnover ratio
    try {
      const avgInventoryResult = await pool.query(`
        SELECT AVG(COALESCE(curstock, 0) * COALESCE(cost, 0)) as avg_inventory_value
        FROM tblmasitem 
        WHERE (deleted = false OR deleted IS NULL)
        AND COALESCE(curstock, 0) > 0
        AND COALESCE(cost, 0) > 0
      `);

      const cogsSalesResult = await pool.query(`
        SELECT COALESCE(SUM(invamt), 0) as total_purchases
        FROM tbltrnpurchase 
        WHERE EXTRACT(YEAR FROM trdate) = EXTRACT(YEAR FROM CURRENT_DATE)
        AND (is_cancelled = false OR is_cancelled IS NULL)
      `);

      const avgInventoryValue = parseFloat(avgInventoryResult.rows[0].avg_inventory_value) || 1;
      const totalPurchases = parseFloat(cogsSalesResult.rows[0].total_purchases) || 0;

      if (avgInventoryValue > 0) {
        performance.inventoryTurnover = (totalPurchases / avgInventoryValue).toFixed(2);
      }
    } catch (error) {
      console.log('Inventory turnover calculation failed, using 0.0');
      performance.inventoryTurnover = '0.0';
    }

    // Calculate purchase growth metrics
    try {
      const currentMonthPurchases = await pool.query(`
        SELECT COALESCE(SUM(invamt), 0) as total
        FROM tbltrnpurchase 
        WHERE EXTRACT(MONTH FROM trdate) = EXTRACT(MONTH FROM CURRENT_DATE)
        AND EXTRACT(YEAR FROM trdate) = EXTRACT(YEAR FROM CURRENT_DATE)
        AND (is_cancelled = false OR is_cancelled IS NULL)
      `);

      const lastMonthPurchases = await pool.query(`
        SELECT COALESCE(SUM(invamt), 0) as total
        FROM tbltrnpurchase 
        WHERE EXTRACT(MONTH FROM trdate) = EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month')
        AND EXTRACT(YEAR FROM trdate) = EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '1 month')
        AND (is_cancelled = false OR is_cancelled IS NULL)
      `);

      const currentPurchaseTotal = parseFloat(currentMonthPurchases.rows[0].total) || 0;
      const lastPurchaseTotal = parseFloat(lastMonthPurchases.rows[0].total) || 0;

      performance.currentMonthPurchases = currentPurchaseTotal;

      if (lastPurchaseTotal > 0) {
        performance.purchaseGrowthRate = (((currentPurchaseTotal - lastPurchaseTotal) / lastPurchaseTotal) * 100).toFixed(1);
      } else if (currentPurchaseTotal > 0) {
        performance.purchaseGrowthRate = '100.0'; // New purchases this month
      }
    } catch (error) {
      console.log('Purchase growth calculation failed, using 0.0');
      performance.purchaseGrowthRate = '0.0';
      performance.currentMonthPurchases = 0;
    }

    // Calculate sales metrics
    try {
      const currentMonthSales = await pool.query(`
        SELECT COALESCE(SUM(tot_amount), 0) as total
        FROM trn_invoice_master 
        WHERE EXTRACT(MONTH FROM inv_date) = EXTRACT(MONTH FROM CURRENT_DATE)
        AND EXTRACT(YEAR FROM inv_date) = EXTRACT(YEAR FROM CURRENT_DATE)
        AND (is_deleted = false OR is_deleted IS NULL)
      `);

      performance.currentMonthSales = parseFloat(currentMonthSales.rows[0].total) || 0;
    } catch (error) {
      console.log('Sales calculation failed, using 0');
      performance.currentMonthSales = 0;
    }

    res.json(performance);
  } catch (error) {
    console.error('Dashboard performance error:', error);
    res.status(500).json({
      error: 'Failed to fetch performance metrics',
      details: error.message
    });
  }
});

// Get low stock items for dashboard (no permissions required)
router.get('/low-stock-items', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        itemcode,
        itemname,
        curstock,
        cost,
        model,
        g.groupname,
        b.brandname
      FROM tblmasitem i
      LEFT JOIN tblmasgroup g ON i.groupid = g.groupid
      LEFT JOIN tblmasbrand b ON i.brandid = b.brandid
      WHERE COALESCE(curstock, 0) > 0 
      AND COALESCE(curstock, 0) <= 10
      AND (deleted = false OR deleted IS NULL)
      ORDER BY curstock ASC
      LIMIT 50
    `);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching low stock items for dashboard:', err);
    res.json([]); // Return empty array instead of error to prevent UI issues
  }
});

// Get out of stock items for dashboard (no permissions required)
router.get('/out-of-stock-items', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        itemcode,
        itemname,
        curstock,
        cost,
        model,
        g.groupname,
        b.brandname
      FROM tblmasitem i
      LEFT JOIN tblmasgroup g ON i.groupid = g.groupid
      LEFT JOIN tblmasbrand b ON i.brandid = b.brandid
      WHERE COALESCE(curstock, 0) = 0
      AND (deleted = false OR deleted IS NULL)
      ORDER BY itemname ASC
      LIMIT 50
    `);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching out of stock items for dashboard:', err);
    res.json([]); // Return empty array instead of error to prevent UI issues
  }
});

module.exports = router;