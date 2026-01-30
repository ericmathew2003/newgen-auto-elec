const pool = require('./backend/db');

async function checkCustomerCount() {
  try {
    console.log('=== CHECKING CUSTOMER COUNT ISSUE ===');
    
    // Check the structure and data in tblMasParty
    console.log('\n1. Checking tblMasParty table structure and PartyType values:');
    const partyTypes = await pool.query(`
      SELECT 
        PartyType,
        COUNT(*) as count,
        STRING_AGG(DISTINCT PartyName, ', ' ORDER BY PartyName) as sample_names
      FROM tblMasParty 
      GROUP BY PartyType 
      ORDER BY PartyType
    `);
    
    console.log('PartyType distribution:', partyTypes.rows);
    
    // Check what the dashboard is currently returning
    console.log('\n2. Current dashboard query (PartyType = 1):');
    const dashboardCustomers = await pool.query(`SELECT COUNT(*)::int AS customers FROM tblMasParty WHERE PartyType = 1`);
    console.log('Dashboard customer count:', dashboardCustomers.rows[0]);
    
    console.log('\n3. Alternative query (PartyType = 2):');
    const altCustomers = await pool.query(`SELECT COUNT(*)::int AS customers FROM tblMasParty WHERE PartyType = 2`);
    console.log('Alternative customer count:', altCustomers.rows[0]);
    
    // Check suppliers count too
    console.log('\n4. Current dashboard suppliers query (PartyType = 2):');
    const dashboardSuppliers = await pool.query(`SELECT COUNT(*)::int AS suppliers FROM tblMasParty WHERE PartyType = 2`);
    console.log('Dashboard supplier count:', dashboardSuppliers.rows[0]);
    
    console.log('\n5. Alternative suppliers query (PartyType = 1):');
    const altSuppliers = await pool.query(`SELECT COUNT(*)::int AS suppliers FROM tblMasParty WHERE PartyType = 1`);
    console.log('Alternative supplier count:', altSuppliers.rows[0]);
    
    // Check some sample records to understand the data
    console.log('\n6. Sample records from tblMasParty:');
    const sampleRecords = await pool.query(`
      SELECT PartyID, PartyName, PartyType, Address1, Phone1 
      FROM tblMasParty 
      ORDER BY PartyID 
      LIMIT 10
    `);
    console.log('Sample records:', sampleRecords.rows);
    
    // Check if there are any deleted/inactive records
    console.log('\n7. Checking for deleted/inactive records:');
    const deletedCheck = await pool.query(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(CASE WHEN deleted = true THEN 1 END) as deleted_records,
        COUNT(CASE WHEN deleted = false OR deleted IS NULL THEN 1 END) as active_records
      FROM tblMasParty
    `);
    console.log('Record status:', deletedCheck.rows[0]);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

checkCustomerCount();