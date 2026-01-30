const pool = require('./backend/db');

async function verifyCustomerCountFix() {
  try {
    console.log('=== VERIFYING CUSTOMER COUNT FIX ===');
    
    // Test the new dashboard queries
    console.log('\n1. New dashboard queries (with deleted filter):');
    const newCustomers = await pool.query(`SELECT COUNT(*)::int AS customers FROM tblMasParty WHERE PartyType = 1 AND (deleted = false OR deleted IS NULL)`);
    const newSuppliers = await pool.query(`SELECT COUNT(*)::int AS suppliers FROM tblMasParty WHERE PartyType = 2 AND (deleted = false OR deleted IS NULL)`);
    
    console.log('Active customers (PartyType = 1):', newCustomers.rows[0].customers);
    console.log('Active suppliers (PartyType = 2):', newSuppliers.rows[0].suppliers);
    
    // Compare with old queries
    console.log('\n2. Old dashboard queries (without deleted filter):');
    const oldCustomers = await pool.query(`SELECT COUNT(*)::int AS customers FROM tblMasParty WHERE PartyType = 1`);
    const oldSuppliers = await pool.query(`SELECT COUNT(*)::int AS suppliers FROM tblMasParty WHERE PartyType = 2`);
    
    console.log('All customers (PartyType = 1):', oldCustomers.rows[0].customers);
    console.log('All suppliers (PartyType = 2):', oldSuppliers.rows[0].suppliers);
    
    // Show the difference
    console.log('\n3. Difference (deleted/inactive records):');
    const customerDiff = oldCustomers.rows[0].customers - newCustomers.rows[0].customers;
    const supplierDiff = oldSuppliers.rows[0].suppliers - newSuppliers.rows[0].suppliers;
    
    console.log(`Deleted/inactive customers: ${customerDiff}`);
    console.log(`Deleted/inactive suppliers: ${supplierDiff}`);
    
    // Check what CustomerPage would actually show
    console.log('\n4. What CustomerPage shows (all parties, filtered on frontend):');
    const allParties = await pool.query(`
      SELECT 
        COUNT(*) as total_parties,
        COUNT(CASE WHEN PartyType = 1 THEN 1 END) as customers_in_list,
        COUNT(CASE WHEN PartyType = 2 THEN 1 END) as suppliers_in_list
      FROM tblMasParty
    `);
    
    console.log('Total parties in CustomerPage:', allParties.rows[0]);
    
    // Check for deleted records specifically
    console.log('\n5. Deleted records analysis:');
    const deletedAnalysis = await pool.query(`
      SELECT 
        PartyType,
        COUNT(*) as total,
        COUNT(CASE WHEN deleted = true THEN 1 END) as deleted_true,
        COUNT(CASE WHEN deleted = false THEN 1 END) as deleted_false,
        COUNT(CASE WHEN deleted IS NULL THEN 1 END) as deleted_null
      FROM tblMasParty
      GROUP BY PartyType
      ORDER BY PartyType
    `);
    
    console.log('Deleted records by PartyType:', deletedAnalysis.rows);
    
    console.log('\n=== SUMMARY ===');
    console.log(`Dashboard will now show ${newCustomers.rows[0].customers} customers instead of ${oldCustomers.rows[0].customers}`);
    console.log(`This excludes ${customerDiff} deleted/inactive customer records`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

verifyCustomerCountFix();