const pool = require('./backend/db');

async function verifyDashboardCustomerPageSync() {
  try {
    console.log('=== VERIFYING DASHBOARD AND CUSTOMERPAGE SYNC ===');
    
    // 1. Test new dashboard query (matches CustomerPage logic)
    console.log('\n1. New Dashboard Query (should match CustomerPage):');
    const dashboardCustomers = await pool.query(`
      SELECT COUNT(*) as customers 
      FROM (
        SELECT p.partyid, p.partytype
        FROM tblmasparty p
        LEFT JOIN acc_mas_account a ON p.accountid = a.account_id
      ) subq 
      WHERE CAST(COALESCE(subq.partytype, 0) AS INTEGER) = 1
    `);
    console.log('Dashboard customer count:', dashboardCustomers.rows[0].customers);
    
    // 2. Simulate CustomerPage query and filtering
    console.log('\n2. CustomerPage Query and Filtering:');
    const customerPageData = await pool.query(`
      SELECT 
        p.partyid, 
        p.partycode, 
        p.partytype, 
        p.partyname, 
        p.contactno, 
        p.address1, 
        p.accountid, 
        p.gstnum, 
        p.address2, 
        p.created_date, 
        p.edited_date,
        a.account_name, 
        a.account_code
      FROM tblmasparty p
      LEFT JOIN acc_mas_account a ON p.accountid = a.account_id
      ORDER BY p.partyid
    `);
    
    // Apply CustomerPage filtering logic
    const filteredCustomers = customerPageData.rows.filter(p => 
      parseInt(p.partytype ?? 0, 10) === 1
    );
    
    console.log('Total parties from CustomerPage API:', customerPageData.rows.length);
    console.log('Customers after CustomerPage filtering:', filteredCustomers.length);
    
    // 3. Compare results
    console.log('\n3. Comparison:');
    console.log(`Dashboard count: ${dashboardCustomers.rows[0].customers}`);
    console.log(`CustomerPage count: ${filteredCustomers.length}`);
    
    if (dashboardCustomers.rows[0].customers === filteredCustomers.length) {
      console.log('✅ SUCCESS: Dashboard and CustomerPage counts match!');
    } else {
      console.log('❌ MISMATCH: Dashboard and CustomerPage counts do not match!');
      console.log(`Difference: ${Math.abs(dashboardCustomers.rows[0].customers - filteredCustomers.length)}`);
    }
    
    // 4. Test suppliers too
    console.log('\n4. Testing Suppliers:');
    const dashboardSuppliers = await pool.query(`
      SELECT COUNT(*) as suppliers 
      FROM (
        SELECT p.partyid, p.partytype
        FROM tblmasparty p
        LEFT JOIN acc_mas_account a ON p.accountid = a.account_id
      ) subq 
      WHERE CAST(COALESCE(subq.partytype, 0) AS INTEGER) = 2
    `);
    
    const filteredSuppliers = customerPageData.rows.filter(p => 
      parseInt(p.partytype ?? 0, 10) === 2
    );
    
    console.log(`Dashboard suppliers: ${dashboardSuppliers.rows[0].suppliers}`);
    console.log(`Filtered suppliers: ${filteredSuppliers.length}`);
    
    if (dashboardSuppliers.rows[0].suppliers === filteredSuppliers.length) {
      console.log('✅ SUCCESS: Supplier counts also match!');
    } else {
      console.log('❌ MISMATCH: Supplier counts do not match!');
    }
    
    // 5. Show sample customers for verification
    console.log('\n5. Sample customers (first 5):');
    filteredCustomers.slice(0, 5).forEach(customer => {
      console.log(`- ID: ${customer.partyid}, Name: ${customer.partyname}, Type: ${customer.partytype}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

verifyDashboardCustomerPageSync();