const pool = require('./db');

async function testSupplierItems() {
  try {
    // First, let's check what suppliers exist
    console.log('Checking suppliers...');
    const suppliers = await pool.query(`
      SELECT DISTINCT p.partyid, party.partyname, COUNT(*) as purchase_count
      FROM tblTrnPurchase p
      JOIN tblMasParty party ON p.partyid = party.partyid
      GROUP BY p.partyid, party.partyname
      ORDER BY party.partyname
    `);
    
    console.log('\nSuppliers with purchases:');
    suppliers.rows.forEach(s => {
      console.log(`  - ${s.partyname} (ID: ${s.partyid}) - ${s.purchase_count} purchases`);
    });
    
    // Now test the actual query for CONTINENTAL MOTORS
    console.log('\n\nTesting supplier items query...');
    const continentalResult = await pool.query(`
      SELECT p.partyid, party.partyname
      FROM tblTrnPurchase p
      JOIN tblMasParty party ON p.partyid = party.partyid
      WHERE UPPER(party.partyname) LIKE '%CONTINENTAL%'
      LIMIT 1
    `);
    
    if (continentalResult.rows.length === 0) {
      console.log('CONTINENTAL MOTORS not found');
      process.exit(0);
    }
    
    const partyId = continentalResult.rows[0].partyid;
    console.log(`Found CONTINENTAL MOTORS with PartyID: ${partyId}`);
    
    // Test the actual items query
    const result = await pool.query(
      `SELECT DISTINCT ON (pd.itemcode)
        pd.itemcode,
        i.itemname,
        i.unit,
        i.cost,
        i.cgst,
        i.sgst,
        i.igst,
        p.suppinvno,
        p.suppinvdt,
        pd.qty,
        p.tranid,
        p.trdate
       FROM tblTrnPurchaseDet pd
       INNER JOIN tblTrnPurchase p ON pd.tranmasid = p.tranid
       INNER JOIN tblMasItem i ON pd.itemcode = i.itemcode
       WHERE p.partyid = $1
         AND p.is_cancelled IS NOT TRUE
       ORDER BY pd.itemcode, p.trdate DESC`,
      [partyId]
    );
    
    console.log(`\nFound ${result.rows.length} items for CONTINENTAL MOTORS:`);
    result.rows.forEach(item => {
      console.log(`  - ${item.itemname} (Code: ${item.itemcode}) - Supp Inv: ${item.suppinvno}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testSupplierItems();