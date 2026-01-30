const pool = require('./backend/db');

async function fixCustomerCount() {
  try {
    console.log('=== ANALYZING CUSTOMER COUNT ISSUE ===');
    
    // Check PartyType distribution
    console.log('\n1. PartyType distribution in tblMasParty:');
    const partyTypes = await pool.query(`
      SELECT 
        PartyType,
        COUNT(*) as count,
        STRING_AGG(DISTINCT PartyName, ', ' ORDER BY PartyName LIMIT 3) as sample_names
      FROM tblMasParty 
      GROUP BY PartyType 
      ORDER BY PartyType
    `);
    
    console.log('PartyType distribution:', partyTypes.rows);
    
    // Check what CustomerPage actually shows
    console.log('\n2. Checking what CustomerPage would show (all parties):');
    const allParties = await pool.query(`
      SELECT 
        PartyType,
        COUNT(*) as count
      FROM tblMasParty 
      GROUP BY PartyType
    `);
    console.log('All parties by type:', allParties.rows);
    
    // Check if there are deleted records
    console.log('\n3. Checking for deleted/inactive records:');
    const deletedCheck = await pool.query(`
      SELECT 
        PartyType,
        COUNT(*) as total_records,
        COUNT(CASE WHEN deleted = true THEN 1 END) as deleted_records,
        COUNT(CASE WHEN deleted = false OR deleted IS NULL THEN 1 END) as active_records
      FROM tblMasParty
      GROUP BY PartyType
      ORDER BY PartyType
    `);
    console.log('Record status by PartyType:', deletedCheck.rows);
    
    // Current dashboard queries
    console.log('\n4. Current dashboard queries:');
    const dashboardCustomers = await pool.query(`SELECT COUNT(*)::int AS customers FROM tblMasParty WHERE PartyType = 1`);
    const dashboardSuppliers = await pool.query(`SELECT COUNT(*)::int AS suppliers FROM tblMasParty WHERE PartyType = 2`);
    
    console.log('Dashboard customers (PartyType = 1):', dashboardCustomers.rows[0].customers);
    console.log('Dashboard suppliers (PartyType = 2):', dashboardSuppliers.rows[0].suppliers);
    
    // Check what the CustomerPage actually filters and displays
    console.log('\n5. What CustomerPage should show (customers only):');
    // CustomerPage sets PartyType to "1" for customers, so let's see what that means
    const customerPageData = await pool.query(`
      SELECT COUNT(*) as customer_count 
      FROM tblMasParty 
      WHERE PartyType = 1 
      AND (deleted = false OR deleted IS NULL)
    `);
    console.log('Active customers (PartyType = 1):', customerPageData.rows[0]);
    
    // Check some sample customer records
    console.log('\n6. Sample customer records (PartyType = 1):');
    const sampleCustomers = await pool.query(`
      SELECT PartyID, PartyName, PartyType, Address1, ContactNo 
      FROM tblMasParty 
      WHERE PartyType = 1
      AND (deleted = false OR deleted IS NULL)
      ORDER BY PartyID 
      LIMIT 5
    `);
    console.log('Sample customers:', sampleCustomers.rows);
    
    // Check some sample supplier records
    console.log('\n7. Sample supplier records (PartyType = 2):');
    const sampleSuppliers = await pool.query(`
      SELECT PartyID, PartyName, PartyType, Address1, ContactNo 
      FROM tblMasParty 
      WHERE PartyType = 2
      AND (deleted = false OR deleted IS NULL)
      ORDER BY PartyID 
      LIMIT 5
    `);
    console.log('Sample suppliers:', sampleSuppliers.rows);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

fixCustomerCount();