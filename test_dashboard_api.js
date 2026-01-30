const pool = require('./backend/db');

async function testDashboardQueries() {
  try {
    console.log('=== TESTING DASHBOARD QUERIES ===');
    
    // Test each query individually to identify any issues
    
    console.log('\n1. Testing purchase totals query...');
    try {
      const purchaseTotals = await pool.query(`
        SELECT
          COALESCE(SUM(InvAmt),0) AS total_purchase,
          COALESCE(SUM(CGST+SGST+IGST),0) AS total_purchase_tax,
          COUNT(*) AS purchase_count
        FROM tblTrnPurchase
      `);
      console.log('✅ Purchase totals:', purchaseTotals.rows[0]);
    } catch (error) {
      console.log('❌ Purchase totals failed:', error.message);
    }
    
    console.log('\n2. Testing sales totals query...');
    try {
      const salesTotals = await pool.query(`
        SELECT
          COALESCE(SUM(tot_amount),0) AS total_sales,
          COALESCE(SUM(cgst_amount+sgst_amount+igst_amount),0) AS total_sales_tax,
          COUNT(*) AS sales_count
        FROM public.trn_invoice_master
        WHERE is_deleted = false
      `);
      console.log('✅ Sales totals:', salesTotals.rows[0]);
    } catch (error) {
      console.log('❌ Sales totals failed:', error.message);
    }
    
    console.log('\n3. Testing suppliers count query...');
    try {
      const suppliers = await pool.query(`SELECT COUNT(*)::int AS suppliers FROM tblMasParty WHERE PartyType = 2`);
      console.log('✅ Suppliers count:', suppliers.rows[0]);
    } catch (error) {
      console.log('❌ Suppliers count failed:', error.message);
    }
    
    console.log('\n4. Testing customers count query...');
    try {
      const customers = await pool.query(`SELECT COUNT(*)::int AS customers FROM tblMasParty WHERE PartyType = 1`);
      console.log('✅ Customers count:', customers.rows[0]);
    } catch (error) {
      console.log('❌ Customers count failed:', error.message);
    }
    
    console.log('\n5. Testing item stats query...');
    try {
      const itemStats = await pool.query(`
        SELECT 
          COUNT(*) as total_items,
          COUNT(CASE WHEN curstock < 10 AND curstock > 0 THEN 1 END) as low_stock_items,
          COUNT(CASE WHEN curstock = 0 THEN 1 END) as out_of_stock_items,
          COALESCE(SUM(curstock * cost), 0) as total_stock_value
        FROM tblMasItem 
        WHERE deleted = false OR deleted IS NULL
      `);
      console.log('✅ Item stats:', itemStats.rows[0]);
    } catch (error) {
      console.log('❌ Item stats failed:', error.message);
    }
    
    console.log('\n6. Testing purchase monthly query...');
    try {
      const purchaseMonthly = await pool.query(`
        SELECT to_char(TrDate, 'YYYY-MM') AS ym,
          COALESCE(SUM(InvAmt),0) AS total
        FROM tblTrnPurchase
        GROUP BY 1
        ORDER BY 1
      `);
      console.log('✅ Purchase monthly count:', purchaseMonthly.rows.length);
    } catch (error) {
      console.log('❌ Purchase monthly failed:', error.message);
    }
    
    console.log('\n7. Testing sales monthly query...');
    try {
      const salesMonthly = await pool.query(`
        SELECT to_char(inv_date, 'YYYY-MM') AS ym,
          COALESCE(SUM(tot_amount),0) AS total
        FROM public.trn_invoice_master
        WHERE is_deleted = false
        GROUP BY 1
        ORDER BY 1
      `);
      console.log('✅ Sales monthly count:', salesMonthly.rows.length);
    } catch (error) {
      console.log('❌ Sales monthly failed:', error.message);
    }
    
  } catch (error) {
    console.error('Overall error:', error);
  } finally {
    process.exit(0);
  }
}

testDashboardQueries();