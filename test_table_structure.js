const pool = require('./backend/db');

async function testTableStructure() {
  try {
    console.log('=== TESTING TABLE STRUCTURE ===');
    
    // Test if tblmasparty table exists and check its structure
    console.log('\n1. Testing tblmasparty table access...');
    try {
      const result = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'tblmasparty'
        ORDER BY ordinal_position
      `);
      console.log('✅ tblmasparty columns:', result.rows);
    } catch (error) {
      console.log('❌ tblmasparty structure check failed:', error.message);
    }
    
    // Test simple count query
    console.log('\n2. Testing simple count query...');
    try {
      const result = await pool.query('SELECT COUNT(*) as total FROM tblmasparty');
      console.log('✅ Total records in tblmasparty:', result.rows[0]);
    } catch (error) {
      console.log('❌ Simple count failed:', error.message);
    }
    
    // Test partytype values
    console.log('\n3. Testing partytype distribution...');
    try {
      const result = await pool.query(`
        SELECT partytype, COUNT(*) as count 
        FROM tblmasparty 
        GROUP BY partytype 
        ORDER BY partytype
      `);
      console.log('✅ PartyType distribution:', result.rows);
    } catch (error) {
      console.log('❌ PartyType query failed:', error.message);
    }
    
    // Test the exact dashboard queries
    console.log('\n4. Testing exact dashboard queries...');
    try {
      const suppliers = await pool.query('SELECT COUNT(*)::int AS suppliers FROM tblmasparty WHERE partytype = 2');
      console.log('✅ Suppliers count:', suppliers.rows[0]);
      
      const customers = await pool.query('SELECT COUNT(*)::int AS customers FROM tblmasparty WHERE partytype = 1');
      console.log('✅ Customers count:', customers.rows[0]);
    } catch (error) {
      console.log('❌ Dashboard queries failed:', error.message);
    }
    
  } catch (error) {
    console.error('Overall error:', error);
  } finally {
    process.exit(0);
  }
}

testTableStructure();