const pool = require('./backend/db');

async function testDashboardEndpoint() {
  try {
    console.log('=== TESTING DASHBOARD ENDPOINT DIRECTLY ===');
    
    // Test the exact queries that the dashboard endpoint now uses
    console.log('\n1. Testing new customer count query:');
    const customerQuery = `
      SELECT COUNT(*) as customers 
      FROM (
        SELECT p.partyid, p.partytype
        FROM tblmasparty p
        LEFT JOIN acc_mas_account a ON p.accountid = a.account_id
      ) subq 
      WHERE CAST(COALESCE(subq.partytype, 0) AS INTEGER) = 1
    `;
    
    const customerResult = await pool.query(customerQuery);
    console.log('New customer count:', customerResult.rows[0].customers);
    
    // Test the old query for comparison
    console.log('\n2. Testing old customer count query:');
    const oldCustomerQuery = `SELECT COUNT(*)::int AS customers FROM tblmasparty WHERE partytype = 1`;
    const oldCustomerResult = await pool.query(oldCustomerQuery);
    console.log('Old customer count:', oldCustomerResult.rows[0].customers);
    
    // Test supplier count too
    console.log('\n3. Testing new supplier count query:');
    const supplierQuery = `
      SELECT COUNT(*) as suppliers 
      FROM (
        SELECT p.partyid, p.partytype
        FROM tblmasparty p
        LEFT JOIN acc_mas_account a ON p.accountid = a.account_id
      ) subq 
      WHERE CAST(COALESCE(subq.partytype, 0) AS INTEGER) = 2
    `;
    
    const supplierResult = await pool.query(supplierQuery);
    console.log('New supplier count:', supplierResult.rows[0].suppliers);
    
    // Check if there are any records with NULL partytype
    console.log('\n4. Checking for NULL partytype values:');
    const nullCheck = await pool.query(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(CASE WHEN partytype IS NULL THEN 1 END) as null_partytype,
        COUNT(CASE WHEN partytype = 1 THEN 1 END) as type_1_customers,
        COUNT(CASE WHEN partytype = 2 THEN 1 END) as type_2_suppliers
      FROM tblmasparty
    `);
    console.log('PartyType analysis:', nullCheck.rows[0]);
    
    // Check if the JOIN affects the count
    console.log('\n5. Checking if JOIN affects count:');
    const joinCheck = await pool.query(`
      SELECT 
        COUNT(*) as total_with_join,
        COUNT(CASE WHEN p.partytype = 1 THEN 1 END) as customers_with_join
      FROM tblmasparty p
      LEFT JOIN acc_mas_account a ON p.accountid = a.account_id
    `);
    console.log('JOIN analysis:', joinCheck.rows[0]);
    
    console.log('\n=== SUMMARY ===');
    if (customerResult.rows[0].customers === oldCustomerResult.rows[0].customers) {
      console.log('✅ New and old queries return the same count');
      console.log('The issue might be:');
      console.log('1. Backend server needs restart');
      console.log('2. Browser cache needs clearing');
      console.log('3. Frontend is still using cached data');
    } else {
      console.log('❌ New and old queries return different counts');
      console.log(`Difference: ${Math.abs(customerResult.rows[0].customers - oldCustomerResult.rows[0].customers)}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

testDashboardEndpoint();