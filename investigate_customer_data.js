const pool = require('./backend/db');

async function investigateCustomerData() {
  try {
    console.log('=== INVESTIGATING CUSTOMER DATA ===');
    
    // Check total count by partytype
    console.log('\n1. Total count by partytype:');
    const partyTypeCounts = await pool.query(`
      SELECT 
        partytype,
        COUNT(*) as count
      FROM tblmasparty 
      GROUP BY partytype 
      ORDER BY partytype
    `);
    console.log('PartyType distribution:', partyTypeCounts.rows);
    
    // Check what the CustomerPage would actually show
    console.log('\n2. What CustomerPage shows (all parties):');
    const allParties = await pool.query(`
      SELECT COUNT(*) as total_parties FROM tblmasparty
    `);
    console.log('Total parties in database:', allParties.rows[0]);
    
    // Sample customer records to understand the data
    console.log('\n3. Sample customer records (partytype = 1):');
    const sampleCustomers = await pool.query(`
      SELECT partyid, partyname, partytype, contactno, address1, created_date
      FROM tblmasparty 
      WHERE partytype = 1
      ORDER BY partyid 
      LIMIT 10
    `);
    console.log('Sample customers:', sampleCustomers.rows);
    
    // Sample supplier records to compare
    console.log('\n4. Sample supplier records (partytype = 2):');
    const sampleSuppliers = await pool.query(`
      SELECT partyid, partyname, partytype, contactno, address1, created_date
      FROM tblmasparty 
      WHERE partytype = 2
      ORDER BY partyid 
      LIMIT 10
    `);
    console.log('Sample suppliers:', sampleSuppliers.rows);
    
    // Check for any null or unusual partytype values
    console.log('\n5. Checking for null or unusual partytype values:');
    const unusualTypes = await pool.query(`
      SELECT 
        partytype,
        COUNT(*) as count,
        STRING_AGG(partyname, ', ' ORDER BY partyname LIMIT 3) as sample_names
      FROM tblmasparty 
      WHERE partytype IS NULL OR partytype NOT IN (1, 2)
      GROUP BY partytype
    `);
    console.log('Unusual partytype values:', unusualTypes.rows);
    
    // Check if there are any empty or test records
    console.log('\n6. Checking for potentially invalid customer records:');
    const suspiciousRecords = await pool.query(`
      SELECT partyid, partyname, partytype, contactno, address1
      FROM tblmasparty 
      WHERE partytype = 1 
      AND (
        partyname IS NULL 
        OR partyname = '' 
        OR partyname ILIKE '%test%' 
        OR partyname ILIKE '%dummy%'
        OR partyname ILIKE '%sample%'
      )
      ORDER BY partyid
    `);
    console.log('Potentially invalid customer records:', suspiciousRecords.rows);
    
    // Check recent additions
    console.log('\n7. Recent customer additions:');
    const recentCustomers = await pool.query(`
      SELECT partyid, partyname, partytype, created_date
      FROM tblmasparty 
      WHERE partytype = 1
      AND created_date IS NOT NULL
      ORDER BY created_date DESC 
      LIMIT 10
    `);
    console.log('Recent customers:', recentCustomers.rows);
    
    // Check what the actual CustomerPage filtering would show
    console.log('\n8. Simulating CustomerPage filtering:');
    // The CustomerPage gets all parties and filters on frontend
    const allPartiesForCustomerPage = await pool.query(`
      SELECT 
        COUNT(*) as total_all_parties,
        COUNT(CASE WHEN partytype = 1 THEN 1 END) as customers_in_all_parties,
        COUNT(CASE WHEN partytype = 2 THEN 1 END) as suppliers_in_all_parties
      FROM tblmasparty
    `);
    console.log('What CustomerPage sees:', allPartiesForCustomerPage.rows[0]);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

investigateCustomerData();