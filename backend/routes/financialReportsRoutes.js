const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { checkPermission } = require('../middleware/checkPermission');

// Helper function to format currency
const formatCurrency = (amount) => {
  return parseFloat(amount || 0).toFixed(2);
};

// 1. Trial Balance Report
router.get('/trial-balance', authenticateToken, checkPermission('REPORTS_FINANCIAL_STATEMENTS_VIEW'), async (req, res) => {
  let client;
  
  try {
    const { fromDate, toDate } = req.query;
    
    if (!fromDate || !toDate) {
      return res.status(400).json({ error: 'From date and to date are required' });
    }
    
    client = await pool.connect();
    
    // Get all accounts with their balances
    const accountsQuery = `
      SELECT 
        a.account_id,
        a.account_code,
        a.account_name,
        COALESCE(ag.group_name, 'Uncategorized') as group_name,
        COALESCE(a.account_nature, 'Unknown') as nature_name,
        COALESCE(SUM(jd.debit_amount), 0) as total_debit,
        COALESCE(SUM(jd.credit_amount), 0) as total_credit
      FROM acc_mas_coa a
      LEFT JOIN acc_mas_group ag ON a.group_id = ag.group_id
      LEFT JOIN acc_journal_detail jd ON a.account_id = jd.account_id
      LEFT JOIN acc_journal_master jm ON jd.journal_mas_id = jm.journal_mas_id 
        AND jm.journal_date BETWEEN $1 AND $2
      WHERE a.is_active = true
      GROUP BY a.account_id, a.account_code, a.account_name, ag.group_name, a.account_nature
      HAVING COALESCE(SUM(jd.debit_amount), 0) != 0
         OR COALESCE(SUM(jd.credit_amount), 0) != 0
      ORDER BY a.account_code
    `;
    
    const result = await client.query(accountsQuery, [fromDate, toDate]);
    
    let totalDebit = 0;
    let totalCredit = 0;
    
    const accounts = result.rows.map(row => {
      const debit = parseFloat(row.total_debit || 0);
      const credit = parseFloat(row.total_credit || 0);
      const balance = debit - credit;
      
      totalDebit += debit;
      totalCredit += credit;
      
      return {
        account_code: row.account_code,
        account_name: row.account_name,
        group_name: row.group_name,
        nature: row.nature_name,
        debit: formatCurrency(debit),
        credit: formatCurrency(credit),
        balance: formatCurrency(Math.abs(balance)),
        balance_type: balance >= 0 ? 'Dr' : 'Cr'
      };
    });
    
    res.json({
      success: true,
      report_name: 'Trial Balance',
      period: { from: fromDate, to: toDate },
      accounts: accounts,
      totals: {
        total_debit: formatCurrency(totalDebit),
        total_credit: formatCurrency(totalCredit),
        difference: formatCurrency(Math.abs(totalDebit - totalCredit))
      }
    });
    
  } catch (error) {
    console.error('Error generating trial balance:', error);
    res.status(500).json({ 
      error: 'Failed to generate trial balance', 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  } finally {
    if (client) client.release();
  }
});

// 2. Trading Account Report
router.get('/trading-account', authenticateToken, checkPermission('REPORTS_FINANCIAL_STATEMENTS_VIEW'), async (req, res) => {
  let client;
  
  try {
    const { fromDate, toDate } = req.query;
    
    if (!fromDate || !toDate) {
      return res.status(400).json({ error: 'From date and to date are required' });
    }
    
    client = await pool.connect();
    
    // Get sales (taxable amount only, excluding GST) from trn_invoice_master
    const salesQuery = `
      SELECT COALESCE(SUM(taxable_tot), 0) as total_sales
      FROM trn_invoice_master
      WHERE inv_date BETWEEN $1 AND $2
        AND is_deleted = false
    `;
    
    const salesResult = await client.query(salesQuery, [fromDate, toDate]);
    const totalSales = parseFloat(salesResult.rows[0].total_sales);
    
    // Get sales returns (taxable amount only, excluding GST)
    const salesReturnQuery = `
      SELECT COALESCE(SUM(taxable_amount), 0) as total_sales_return
      FROM inv_trn_sales_return_master
      WHERE sales_ret_date BETWEEN $1 AND $2
        AND is_cancelled = false
    `;
    
    const salesReturnResult = await client.query(salesReturnQuery, [fromDate, toDate]);
    const totalSalesReturn = parseFloat(salesReturnResult.rows[0].total_sales_return);
    
    // Net sales
    const netSales = totalSales - totalSalesReturn;
    
    // Get purchases (taxable amount only, excluding GST) from tbltrnpurchase
    // invamt is the base amount, add other charges but exclude GST
    const purchasesQuery = `
      SELECT COALESCE(SUM(
        invamt + COALESCE(tptcharge, 0) + COALESCE(labcharge, 0) + 
        COALESCE(misccharge, 0) + COALESCE(packcharge, 0) + 
        COALESCE(rounded, 0)
      ), 0) as total_purchases
      FROM tbltrnpurchase
      WHERE trdate BETWEEN $1 AND $2
        AND is_cancelled = false
    `;
    
    const purchasesResult = await client.query(purchasesQuery, [fromDate, toDate]);
    const totalPurchases = parseFloat(purchasesResult.rows[0].total_purchases);
    
    // Get purchase returns (taxable amount only, excluding GST)
    const purchaseReturnQuery = `
      SELECT COALESCE(SUM(taxable_total), 0) as total_purchase_return
      FROM trn_purchase_return_master
      WHERE tran_date BETWEEN $1 AND $2
        AND is_deleted = false
    `;
    
    const purchaseReturnResult = await client.query(purchaseReturnQuery, [fromDate, toDate]);
    const totalPurchaseReturn = parseFloat(purchaseReturnResult.rows[0].total_purchase_return);
    
    // Net purchases
    const netPurchases = totalPurchases - totalPurchaseReturn;
    
    // Calculate opening stock as of the start date (fromDate)
    // Opening Stock = Previous Opening Stock + Purchases before fromDate - Sales before fromDate (at cost)
    
    // Get business opening stock (from tblmasitem)
    const businessOpeningQuery = `
      SELECT COALESCE(SUM(opening_stock * avgcost), 0) as business_opening
      FROM tblmasitem
      WHERE deleted = false
    `;
    const businessOpeningResult = await client.query(businessOpeningQuery);
    const businessOpening = parseFloat(businessOpeningResult.rows[0].business_opening);
    
    // Get purchases before the period start date
    const purchasesBeforeQuery = `
      SELECT COALESCE(SUM(
        invamt + COALESCE(tptcharge, 0) + COALESCE(labcharge, 0) + 
        COALESCE(misccharge, 0) + COALESCE(packcharge, 0) + 
        COALESCE(rounded, 0)
      ), 0) as purchases_before
      FROM tbltrnpurchase
      WHERE trdate < $1
        AND is_cancelled = false
    `;
    const purchasesBeforeResult = await client.query(purchasesBeforeQuery, [fromDate]);
    const purchasesBefore = parseFloat(purchasesBeforeResult.rows[0].purchases_before);
    
    // Get purchase returns before the period start date
    const purchaseReturnsBeforeQuery = `
      SELECT COALESCE(SUM(taxable_total), 0) as returns_before
      FROM trn_purchase_return_master
      WHERE tran_date < $1
        AND is_deleted = false
    `;
    const purchaseReturnsBeforeResult = await client.query(purchaseReturnsBeforeQuery, [fromDate]);
    const purchaseReturnsBefore = parseFloat(purchaseReturnsBeforeResult.rows[0].returns_before);
    
    // Get cost of sales before the period start date
    // Using taxable_tot as approximation of cost (ideally should use actual cost from stock ledger)
    const salesCostBeforeQuery = `
      SELECT COALESCE(SUM(taxable_tot), 0) as sales_cost_before
      FROM trn_invoice_master
      WHERE inv_date < $1
        AND is_deleted = false
    `;
    const salesCostBeforeResult = await client.query(salesCostBeforeQuery, [fromDate]);
    const salesCostBefore = parseFloat(salesCostBeforeResult.rows[0].sales_cost_before);
    
    // Get sales returns before the period (add back to stock)
    const salesReturnsBeforeQuery = `
      SELECT COALESCE(SUM(taxable_amount), 0) as sales_returns_before
      FROM inv_trn_sales_return_master
      WHERE sales_ret_date < $1
        AND is_cancelled = false
    `;
    const salesReturnsBeforeResult = await client.query(salesReturnsBeforeQuery, [fromDate]);
    const salesReturnsBefore = parseFloat(salesReturnsBeforeResult.rows[0].sales_returns_before);
    
    // Calculate opening stock for the period
    // Opening Stock = Business Opening + Purchases Before - Purchase Returns Before - Sales Cost Before + Sales Returns Before
    const openingStock = businessOpening + purchasesBefore - purchaseReturnsBefore - salesCostBefore + salesReturnsBefore;
    
    // Get cost of goods sold during the period from stock ledger
    // Join with item master to get the cost/avgcost
    const costOfGoodsSoldQuery = `
      SELECT COALESCE(SUM(ABS(sl.qty) * COALESCE(i.avgcost, i.cost, 0)), 0) as cogs
      FROM trn_stock_ledger sl
      LEFT JOIN tblmasitem i ON sl.itemcode = i.itemcode
      WHERE sl.tran_date BETWEEN $1 AND $2
        AND sl.tran_type IN ('SAL', 'SALES', 'Sales', 'S')
        AND sl.qty < 0
    `;
    const cogsResult = await client.query(costOfGoodsSoldQuery, [fromDate, toDate]);
    let costOfGoodsSold = parseFloat(cogsResult.rows[0].cogs);
    
    // If stock ledger doesn't have data or COGS is zero, estimate it
    // Use a percentage of sales as fallback
    if (costOfGoodsSold === 0 && netSales > 0) {
      // Estimate: assume 70% of sales is cost (30% margin)
      // This is a fallback - ideally stock ledger should have accurate data
      costOfGoodsSold = netSales * 0.7;
    }
    
    // Calculate closing stock for the period
    // Closing Stock = Opening Stock + Net Purchases - Cost of Goods Sold
    const closingStock = openingStock + netPurchases - costOfGoodsSold;
    
    // Calculate gross profit
    const grossProfit = netSales - costOfGoodsSold;
    
    res.json({
      success: true,
      report_name: 'Trading Account',
      period: { from: fromDate, to: toDate },
      particulars: {
        opening_stock: formatCurrency(openingStock),
        purchases: formatCurrency(totalPurchases),
        purchase_returns: formatCurrency(totalPurchaseReturn),
        net_purchases: formatCurrency(netPurchases),
        closing_stock: formatCurrency(closingStock),
        cost_of_goods_sold: formatCurrency(costOfGoodsSold),
        sales: formatCurrency(totalSales),
        sales_returns: formatCurrency(totalSalesReturn),
        net_sales: formatCurrency(netSales),
        gross_profit: formatCurrency(grossProfit),
        gross_profit_percentage: netSales > 0 ? ((grossProfit / netSales) * 100).toFixed(2) + '%' : '0%'
      }
    });
    
  } catch (error) {
    console.error('Error generating trading account:', error);
    res.status(500).json({ error: 'Failed to generate trading account', details: error.message });
  } finally {
    if (client) client.release();
  }
});

// 3. Profit & Loss Statement
router.get('/profit-loss', authenticateToken, checkPermission('REPORTS_FINANCIAL_STATEMENTS_VIEW'), async (req, res) => {
  let client;
  
  try {
    const { fromDate, toDate } = req.query;
    
    if (!fromDate || !toDate) {
      return res.status(400).json({ error: 'From date and to date are required' });
    }
    
    client = await pool.connect();
    
    // Get revenue accounts (group_id = 3: Income / Revenue)
    const revenueQuery = `
      SELECT 
        a.account_name,
        COALESCE(SUM(jd.credit_amount - jd.debit_amount), 0) as amount
      FROM acc_mas_coa a
      LEFT JOIN acc_journal_detail jd ON a.account_id = jd.account_id
      LEFT JOIN acc_journal_master jm ON jd.journal_mas_id = jm.journal_mas_id
        AND jm.journal_date BETWEEN $1 AND $2
      WHERE a.group_id = 3
        AND a.is_active = true
      GROUP BY a.account_id, a.account_name
      HAVING COALESCE(SUM(jd.credit_amount - jd.debit_amount), 0) != 0
      ORDER BY a.account_name
    `;
    
    const revenueResult = await client.query(revenueQuery, [fromDate, toDate]);
    
    // Get expense accounts (group_id = 5: Expenses)
    const expenseQuery = `
      SELECT 
        a.account_name,
        COALESCE(SUM(jd.debit_amount - jd.credit_amount), 0) as amount
      FROM acc_mas_coa a
      LEFT JOIN acc_journal_detail jd ON a.account_id = jd.account_id
      LEFT JOIN acc_journal_master jm ON jd.journal_mas_id = jm.journal_mas_id
        AND jm.journal_date BETWEEN $1 AND $2
      WHERE a.group_id = 5
        AND a.is_active = true
      GROUP BY a.account_id, a.account_name
      HAVING COALESCE(SUM(jd.debit_amount - jd.credit_amount), 0) != 0
      ORDER BY a.account_name
    `;
    
    const expenseResult = await client.query(expenseQuery, [fromDate, toDate]);
    
    const revenue = revenueResult.rows.map(row => ({
      account: row.account_name,
      amount: formatCurrency(row.amount)
    }));
    
    const expenses = expenseResult.rows.map(row => ({
      account: row.account_name,
      amount: formatCurrency(row.amount)
    }));
    
    const totalRevenue = revenueResult.rows.reduce((sum, row) => sum + parseFloat(row.amount), 0);
    const totalExpenses = expenseResult.rows.reduce((sum, row) => sum + parseFloat(row.amount), 0);
    const netProfit = totalRevenue - totalExpenses;
    
    res.json({
      success: true,
      report_name: 'Profit & Loss Statement',
      period: { from: fromDate, to: toDate },
      revenue: {
        items: revenue,
        total: formatCurrency(totalRevenue)
      },
      expenses: {
        items: expenses,
        total: formatCurrency(totalExpenses)
      },
      net_profit: formatCurrency(netProfit),
      net_profit_type: netProfit >= 0 ? 'Profit' : 'Loss'
    });
    
  } catch (error) {
    console.error('Error generating P&L:', error);
    res.status(500).json({ error: 'Failed to generate P&L statement', details: error.message });
  } finally {
    if (client) client.release();
  }
});

// 4. Balance Sheet
router.get('/balance-sheet', authenticateToken, checkPermission('REPORTS_FINANCIAL_STATEMENTS_VIEW'), async (req, res) => {
  let client;
  
  try {
    const { toDate } = req.query;
    
    if (!toDate) {
      return res.status(400).json({ error: 'As on date is required' });
    }
    
    client = await pool.connect();
    
    // Get assets (group_id = 1: Assets, 6: Fixed Assets, 7: Current Assets)
    const assetsQuery = `
      SELECT 
        a.account_name,
        ag.group_name,
        COALESCE(SUM(jd.debit_amount - jd.credit_amount), 0) as balance
      FROM acc_mas_coa a
      LEFT JOIN acc_mas_group ag ON a.group_id = ag.group_id
      LEFT JOIN acc_journal_detail jd ON a.account_id = jd.account_id
      LEFT JOIN acc_journal_master jm ON jd.journal_mas_id = jm.journal_mas_id
        AND jm.journal_date <= $1
      WHERE a.group_id IN (1, 6, 7)
        AND a.is_active = true
      GROUP BY a.account_id, a.account_name, ag.group_name
      HAVING COALESCE(SUM(jd.debit_amount - jd.credit_amount), 0) != 0
      ORDER BY ag.group_name, a.account_name
    `;
    
    const assetsResult = await client.query(assetsQuery, [toDate]);
    
    // Get liabilities (group_id = 2: Liability)
    const liabilitiesQuery = `
      SELECT 
        a.account_name,
        ag.group_name,
        COALESCE(SUM(jd.credit_amount - jd.debit_amount), 0) as balance
      FROM acc_mas_coa a
      LEFT JOIN acc_mas_group ag ON a.group_id = ag.group_id
      LEFT JOIN acc_journal_detail jd ON a.account_id = jd.account_id
      LEFT JOIN acc_journal_master jm ON jd.journal_mas_id = jm.journal_mas_id
        AND jm.journal_date <= $1
      WHERE a.group_id = 2
        AND a.is_active = true
      GROUP BY a.account_id, a.account_name, ag.group_name
      HAVING COALESCE(SUM(jd.credit_amount - jd.debit_amount), 0) != 0
      ORDER BY ag.group_name, a.account_name
    `;
    
    const liabilitiesResult = await client.query(liabilitiesQuery, [toDate]);
    
    // Get equity (group_id = 4: Equity)
    const equityQuery = `
      SELECT 
        a.account_name,
        ag.group_name,
        COALESCE(SUM(jd.credit_amount - jd.debit_amount), 0) as balance
      FROM acc_mas_coa a
      LEFT JOIN acc_mas_group ag ON a.group_id = ag.group_id
      LEFT JOIN acc_journal_detail jd ON a.account_id = jd.account_id
      LEFT JOIN acc_journal_master jm ON jd.journal_mas_id = jm.journal_mas_id
        AND jm.journal_date <= $1
      WHERE a.group_id = 4
        AND a.is_active = true
      GROUP BY a.account_id, a.account_name, ag.group_name
      HAVING COALESCE(SUM(jd.credit_amount - jd.debit_amount), 0) != 0
      ORDER BY ag.group_name, a.account_name
    `;
    
    const equityResult = await client.query(equityQuery, [toDate]);
    
    // Calculate net profit/loss from P&L accounts (Income - Expenses)
    // Income/Revenue (group_id = 3) - credit balance
    const incomeQuery = `
      SELECT COALESCE(SUM(jd.credit_amount - jd.debit_amount), 0) as total_income
      FROM acc_mas_coa a
      LEFT JOIN acc_journal_detail jd ON a.account_id = jd.account_id
      LEFT JOIN acc_journal_master jm ON jd.journal_mas_id = jm.journal_mas_id
        AND jm.journal_date <= $1
      WHERE a.group_id = 3
        AND a.is_active = true
    `;
    
    const incomeResult = await client.query(incomeQuery, [toDate]);
    const totalIncome = parseFloat(incomeResult.rows[0].total_income || 0);
    
    // Expenses (group_id = 5) - debit balance
    const expensesQuery = `
      SELECT COALESCE(SUM(jd.debit_amount - jd.credit_amount), 0) as total_expenses
      FROM acc_mas_coa a
      LEFT JOIN acc_journal_detail jd ON a.account_id = jd.account_id
      LEFT JOIN acc_journal_master jm ON jd.journal_mas_id = jm.journal_mas_id
        AND jm.journal_date <= $1
      WHERE a.group_id = 5
        AND a.is_active = true
    `;
    
    const expensesResult = await client.query(expensesQuery, [toDate]);
    const totalExpenses = parseFloat(expensesResult.rows[0].total_expenses || 0);
    
    // Net profit/loss (Income - Expenses)
    const netProfitLoss = totalIncome - totalExpenses;
    
    const assets = assetsResult.rows.map(row => ({
      account: row.account_name,
      group: row.group_name,
      amount: formatCurrency(row.balance)
    }));
    
    const liabilities = liabilitiesResult.rows.map(row => ({
      account: row.account_name,
      group: row.group_name,
      amount: formatCurrency(row.balance)
    }));
    
    const equity = equityResult.rows.map(row => ({
      account: row.account_name,
      group: row.group_name,
      amount: formatCurrency(row.balance)
    }));
    
    // Add net profit/loss to equity items
    if (Math.abs(netProfitLoss) > 0.01) {
      equity.push({
        account: netProfitLoss >= 0 ? 'Net Profit for the Period' : 'Net Loss for the Period',
        group: 'Equity',
        amount: formatCurrency(Math.abs(netProfitLoss))
      });
    }
    
    const totalAssets = assetsResult.rows.reduce((sum, row) => sum + parseFloat(row.balance), 0);
    const totalLiabilities = liabilitiesResult.rows.reduce((sum, row) => sum + parseFloat(row.balance), 0);
    const totalEquity = equityResult.rows.reduce((sum, row) => sum + parseFloat(row.balance), 0) + netProfitLoss;
    
    res.json({
      success: true,
      report_name: 'Balance Sheet',
      as_on_date: toDate,
      assets: {
        items: assets,
        total: formatCurrency(totalAssets)
      },
      liabilities: {
        items: liabilities,
        total: formatCurrency(totalLiabilities)
      },
      equity: {
        items: equity,
        total: formatCurrency(totalEquity)
      },
      total_liabilities_and_equity: formatCurrency(totalLiabilities + totalEquity),
      balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
      net_profit_loss: formatCurrency(netProfitLoss),
      net_profit_loss_type: netProfitLoss >= 0 ? 'Profit' : 'Loss'
    });
    
  } catch (error) {
    console.error('Error generating balance sheet:', error);
    res.status(500).json({ error: 'Failed to generate balance sheet', details: error.message });
  } finally {
    if (client) client.release();
  }
});

// 5. Cash Flow Statement
router.get('/cash-flow', authenticateToken, checkPermission('REPORTS_FINANCIAL_STATEMENTS_VIEW'), async (req, res) => {
  let client;
  
  try {
    const { fromDate, toDate } = req.query;
    
    if (!fromDate || !toDate) {
      return res.status(400).json({ error: 'From date and to date are required' });
    }
    
    client = await pool.connect();
    
    // Operating Activities (from sales, purchases, expenses)
    const operatingQuery = `
      SELECT 
        'Sales Receipts' as description,
        COALESCE(SUM(tot_amount), 0) as amount
      FROM trn_invoice_master
      WHERE inv_date BETWEEN $1 AND $2 AND is_deleted = false
      
      UNION ALL
      
      SELECT 
        'Sales Returns' as description,
        -COALESCE(SUM(total_amount), 0) as amount
      FROM inv_trn_sales_return_master
      WHERE sales_ret_date BETWEEN $1 AND $2 AND is_cancelled = false
      
      UNION ALL
      
      SELECT 
        'Purchase Payments' as description,
        -COALESCE(SUM(
          invamt + COALESCE(tptcharge, 0) + COALESCE(labcharge, 0) + 
          COALESCE(misccharge, 0) + COALESCE(packcharge, 0) + 
          COALESCE(rounded, 0) + COALESCE(cgst, 0) + 
          COALESCE(sgst, 0) + COALESCE(igst, 0)
        ), 0) as amount
      FROM tbltrnpurchase
      WHERE trdate BETWEEN $1 AND $2 AND is_cancelled = false
      
      UNION ALL
      
      SELECT 
        'Purchase Returns' as description,
        COALESCE(SUM(total_amount), 0) as amount
      FROM trn_purchase_return_master
      WHERE tran_date BETWEEN $1 AND $2 AND is_deleted = false
    `;
    
    const operatingResult = await client.query(operatingQuery, [fromDate, toDate]);
    
    // Investing Activities (from asset purchases/sales)
    const investingQuery = `
      SELECT 
        a.account_name as description,
        COALESCE(SUM(jd.credit_amount - jd.debit_amount), 0) as amount
      FROM acc_mas_coa a
      INNER JOIN acc_journal_detail jd ON a.account_id = jd.account_id
      INNER JOIN acc_journal_master jm ON jd.journal_mas_id = jm.journal_mas_id
      WHERE a.account_nature = 'Asset'
        AND jm.journal_date BETWEEN $1 AND $2
        AND a.is_active = true
      GROUP BY a.account_id, a.account_name
      HAVING COALESCE(SUM(jd.credit_amount - jd.debit_amount), 0) != 0
    `;
    
    const investingResult = await client.query(investingQuery, [fromDate, toDate]);
    
    // Financing Activities (from loans, equity)
    const financingQuery = `
      SELECT 
        a.account_name as description,
        COALESCE(SUM(jd.credit_amount - jd.debit_amount), 0) as amount
      FROM acc_mas_coa a
      INNER JOIN acc_journal_detail jd ON a.account_id = jd.account_id
      INNER JOIN acc_journal_master jm ON jd.journal_mas_id = jm.journal_mas_id
      WHERE a.account_nature IN ('Liability', 'Equity')
        AND jm.journal_date BETWEEN $1 AND $2
        AND a.is_active = true
      GROUP BY a.account_id, a.account_name
      HAVING COALESCE(SUM(jd.credit_amount - jd.debit_amount), 0) != 0
    `;
    
    const financingResult = await client.query(financingQuery, [fromDate, toDate]);
    
    const operating = operatingResult.rows.map(row => ({
      description: row.description,
      amount: formatCurrency(row.amount)
    }));
    
    const investing = investingResult.rows.map(row => ({
      description: row.description,
      amount: formatCurrency(row.amount)
    }));
    
    const financing = financingResult.rows.map(row => ({
      description: row.description,
      amount: formatCurrency(row.amount)
    }));
    
    const totalOperating = operatingResult.rows.reduce((sum, row) => sum + parseFloat(row.amount), 0);
    const totalInvesting = investingResult.rows.reduce((sum, row) => sum + parseFloat(row.amount), 0);
    const totalFinancing = financingResult.rows.reduce((sum, row) => sum + parseFloat(row.amount), 0);
    
    const netCashFlow = totalOperating + totalInvesting + totalFinancing;
    
    res.json({
      success: true,
      report_name: 'Cash Flow Statement',
      period: { from: fromDate, to: toDate },
      operating_activities: {
        items: operating,
        total: formatCurrency(totalOperating)
      },
      investing_activities: {
        items: investing,
        total: formatCurrency(totalInvesting)
      },
      financing_activities: {
        items: financing,
        total: formatCurrency(totalFinancing)
      },
      net_cash_flow: formatCurrency(netCashFlow)
    });
    
  } catch (error) {
    console.error('Error generating cash flow statement:', error);
    res.status(500).json({ error: 'Failed to generate cash flow statement', details: error.message });
  } finally {
    if (client) client.release();
  }
});

// Get report summary (for dashboard)
router.get('/summary', authenticateToken, checkPermission('REPORTS_FINANCIAL_STATEMENTS_VIEW'), async (req, res) => {
  let client;
  
  try {
    const { fromDate, toDate } = req.query;
    
    client = await pool.connect();
    
    // Get key metrics
    const metricsQuery = `
      SELECT 
        COALESCE(SUM(CASE WHEN s.is_deleted = false THEN s.tot_amount ELSE 0 END), 0) as total_sales,
        COALESCE(SUM(CASE WHEN p.is_cancelled = false THEN 
          p.invamt + COALESCE(p.tptcharge, 0) + COALESCE(p.labcharge, 0) + 
          COALESCE(p.misccharge, 0) + COALESCE(p.packcharge, 0) + 
          COALESCE(p.rounded, 0) + COALESCE(p.cgst, 0) + 
          COALESCE(p.sgst, 0) + COALESCE(p.igst, 0)
        ELSE 0 END), 0) as total_purchases,
        COUNT(DISTINCT CASE WHEN s.is_deleted = false THEN s.inv_master_id END) as sales_count,
        COUNT(DISTINCT CASE WHEN p.is_cancelled = false THEN p.tranid END) as purchase_count
      FROM trn_invoice_master s
      FULL OUTER JOIN tbltrnpurchase p ON DATE(s.inv_date) = DATE(p.trdate)
      WHERE (s.inv_date BETWEEN $1 AND $2 OR s.inv_date IS NULL)
        AND (p.trdate BETWEEN $1 AND $2 OR p.trdate IS NULL)
    `;
    
    const metricsResult = await client.query(metricsQuery, [fromDate || '1900-01-01', toDate || '2099-12-31']);
    const metrics = metricsResult.rows[0];
    
    res.json({
      success: true,
      summary: {
        total_sales: formatCurrency(metrics.total_sales),
        total_purchases: formatCurrency(metrics.total_purchases),
        gross_margin: formatCurrency(parseFloat(metrics.total_sales) - parseFloat(metrics.total_purchases)),
        sales_transactions: parseInt(metrics.sales_count),
        purchase_transactions: parseInt(metrics.purchase_count)
      },
      period: { from: fromDate, to: toDate }
    });
    
  } catch (error) {
    console.error('Error generating summary:', error);
    res.status(500).json({ error: 'Failed to generate summary', details: error.message });
  } finally {
    if (client) client.release();
  }
});

// 6. Ledger Report
router.get('/ledger', authenticateToken, checkPermission('REPORTS_LEDGER_VIEW'), async (req, res) => {
  let client;
  
  try {
    const { accountId, fromDate, toDate, partyId } = req.query;
    
    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }
    
    if (!fromDate || !toDate) {
      return res.status(400).json({ error: 'From date and to date are required' });
    }
    
    client = await pool.connect();
    
    // Get account details
    const accountQuery = `
      SELECT 
        a.account_id,
        a.account_code,
        a.account_name,
        COALESCE(ag.group_name, 'Uncategorized') as group_name,
        a.account_nature
      FROM acc_mas_coa a
      LEFT JOIN acc_mas_group ag ON a.group_id = ag.group_id
      WHERE a.account_id = $1
        AND a.is_active = true
    `;
    
    const accountResult = await client.query(accountQuery, [accountId]);
    
    if (accountResult.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    const account = accountResult.rows[0];

    // If partyId provided, get party name for display
    let partyName = null;
    if (partyId) {
      const partyResult = await client.query(
        `SELECT partyname FROM tblmasparty WHERE partyid = $1`, [partyId]
      );
      if (partyResult.rows.length > 0) partyName = partyResult.rows[0].partyname;
    }

    // Build party filter clause
    const partyFilter = partyId ? `AND jd.party_id = ${parseInt(partyId)}` : '';
    
    // Get opening balance (transactions before fromDate)
    const openingBalanceQuery = `
      SELECT 
        COALESCE(SUM(jd.debit_amount), 0) as total_debit,
        COALESCE(SUM(jd.credit_amount), 0) as total_credit
      FROM acc_journal_detail jd
      INNER JOIN acc_journal_master jm ON jd.journal_mas_id = jm.journal_mas_id
      WHERE jd.account_id = $1
        AND jm.journal_date < $2
        ${partyFilter}
    `;
    
    const openingBalanceResult = await client.query(openingBalanceQuery, [accountId, fromDate]);
    const openingDebit = parseFloat(openingBalanceResult.rows[0].total_debit || 0);
    const openingCredit = parseFloat(openingBalanceResult.rows[0].total_credit || 0);
    const openingBalance = openingDebit - openingCredit;
    
    // Get transactions for the period
    const transactionsQuery = `
      SELECT 
        jm.journal_mas_id,
        jm.journal_serial,
        jm.journal_date,
        COALESCE(jm.narration, '') as narration,
        COALESCE(jd.debit_amount, 0) as debit_amount,
        COALESCE(jd.credit_amount, 0) as credit_amount,
        COALESCE(jd.description, '') as description
      FROM acc_journal_detail jd
      INNER JOIN acc_journal_master jm ON jd.journal_mas_id = jm.journal_mas_id
      WHERE jd.account_id = $1
        AND jm.journal_date BETWEEN $2 AND $3
        ${partyFilter}
      ORDER BY jm.journal_date, jm.journal_mas_id
    `;
    
    const transactionsResult = await client.query(transactionsQuery, [accountId, fromDate, toDate]);
    
    // Calculate running balance — each row has EITHER debit OR credit, never both
    let runningBalance = openingBalance;
    const transactions = transactionsResult.rows.map(row => {
      const debit = parseFloat(row.debit_amount || 0);
      const credit = parseFloat(row.credit_amount || 0);
      runningBalance = runningBalance + debit - credit;
      
      return {
        journal_no: row.journal_serial || '',
        date: row.journal_date,
        narration: row.narration || row.description || '',
        // Show debit only if it has a debit amount, credit only if credit amount
        debit: debit > 0 ? formatCurrency(debit) : '',
        credit: credit > 0 ? formatCurrency(credit) : '',
        balance: formatCurrency(Math.abs(runningBalance)),
        balance_type: runningBalance >= 0 ? 'Dr' : 'Cr'
      };
    });
    
    // Calculate totals
    const totalDebit = transactionsResult.rows.reduce((sum, row) => sum + parseFloat(row.debit_amount || 0), 0);
    const totalCredit = transactionsResult.rows.reduce((sum, row) => sum + parseFloat(row.credit_amount || 0), 0);
    const closingBalance = openingBalance + totalDebit - totalCredit;
    
    res.json({
      success: true,
      report_name: 'Ledger Report',
      account: {
        account_id: account.account_id,
        account_code: account.account_code,
        account_name: account.account_name,
        group_name: account.group_name,
        party_name: partyName
      },
      period: { from: fromDate, to: toDate },
      opening_balance: {
        amount: formatCurrency(Math.abs(openingBalance)),
        type: openingBalance >= 0 ? 'Dr' : 'Cr'
      },
      transactions: transactions,
      totals: {
        total_debit: formatCurrency(totalDebit),
        total_credit: formatCurrency(totalCredit)
      },
      closing_balance: {
        amount: formatCurrency(Math.abs(closingBalance)),
        type: closingBalance >= 0 ? 'Dr' : 'Cr'
      }
    });
    
  } catch (error) {
    console.error('Error generating ledger report:', error);
    res.status(500).json({ 
      error: 'Failed to generate ledger report', 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  } finally {
    if (client) client.release();
  }
});

// 7. Get parties with their account IDs (for ledger party filter)
router.get('/ledger-parties', authenticateToken, checkPermission('REPORTS_LEDGER_VIEW'), async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query(`
      SELECT p.partyid, p.partyname, p.partytype, p.accountid,
             a.account_name, a.account_code
      FROM tblmasparty p
      LEFT JOIN acc_mas_coa a ON p.accountid = a.account_id
      WHERE p.accountid IS NOT NULL
      ORDER BY p.partytype, p.partyname
    `);
    res.json({ success: true, parties: result.rows });
  } catch (error) {
    console.error('Error fetching ledger parties:', error);
    res.status(500).json({ error: 'Failed to fetch parties', details: error.message });
  } finally {
    if (client) client.release();
  }
});

module.exports = router;
