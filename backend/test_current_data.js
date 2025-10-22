const db = require('./db');

async function testCurrentData() {
  console.log('🔍 Testing current database data...\n');

  try {
    // Test login table
    console.log('1. Testing login table:');
    const loginResult = await db.query('SELECT COUNT(*) as count FROM login');
    console.log(`   ✅ Login records: ${loginResult.rows[0].count}`);
  } catch (error) {
    console.log(`   ❌ Login table error: ${error.message}`);
  }

  try {
    // Test items table
    console.log('\n2. Testing items table:');
    const itemsResult = await db.query('SELECT COUNT(*) as count FROM tblmasitem');
    console.log(`   ✅ Total items: ${itemsResult.rows[0].count}`);
    
    if (itemsResult.rows[0].count > 0) {
      const sampleItems = await db.query('SELECT itemname, curstock, cost FROM tblmasitem LIMIT 3');
      console.log('   📦 Sample items:');
      sampleItems.rows.forEach(item => {
        console.log(`      - ${item.itemname || 'Unnamed'}: Stock=${item.curstock || 0}, Cost=${item.cost || 0}`);
      });
    }
  } catch (error) {
    console.log(`   ❌ Items table error: ${error.message}`);
  }

  try {
    // Test parties table
    console.log('\n3. Testing parties table:');
    const partiesResult = await db.query('SELECT COUNT(*) as count FROM tblmasparty');
    console.log(`   ✅ Total parties: ${partiesResult.rows[0].count}`);
    
    const suppliersResult = await db.query('SELECT COUNT(*) as count FROM tblmasparty WHERE partytype = 1');
    console.log(`   ✅ Suppliers: ${suppliersResult.rows[0].count}`);
    
    const customersResult = await db.query('SELECT COUNT(*) as count FROM tblmasparty WHERE partytype = 2');
    console.log(`   ✅ Customers: ${customersResult.rows[0].count}`);
  } catch (error) {
    console.log(`   ❌ Parties table error: ${error.message}`);
  }

  try {
    // Test purchases table
    console.log('\n4. Testing purchases table:');
    const purchasesResult = await db.query('SELECT COUNT(*) as count FROM tbltrnpurchase');
    console.log(`   ✅ Total purchases: ${purchasesResult.rows[0].count}`);
    
    if (purchasesResult.rows[0].count > 0) {
      const recentPurchases = await db.query('SELECT trdate, invamt FROM tbltrnpurchase ORDER BY trdate DESC LIMIT 3');
      console.log('   💰 Recent purchases:');
      recentPurchases.rows.forEach(purchase => {
        console.log(`      - Date: ${purchase.trdate}, Amount: ${purchase.invamt || 0}`);
      });
    }
  } catch (error) {
    console.log(`   ❌ Purchases table error: ${error.message}`);
  }

  try {
    // Test sales/invoice table
    console.log('\n5. Testing sales/invoice table:');
    const salesResult = await db.query('SELECT COUNT(*) as count FROM trn_invoice_master');
    console.log(`   ✅ Total sales: ${salesResult.rows[0].count}`);
  } catch (error) {
    console.log(`   ❌ Sales table error: ${error.message}`);
  }

  try {
    // Test brands table
    console.log('\n6. Testing brands table:');
    const brandsResult = await db.query('SELECT COUNT(*) as count FROM tblmasbrand');
    console.log(`   ✅ Total brands: ${brandsResult.rows[0].count}`);
  } catch (error) {
    console.log(`   ❌ Brands table error: ${error.message}`);
  }

  try {
    // Test groups table
    console.log('\n7. Testing groups table:');
    const groupsResult = await db.query('SELECT COUNT(*) as count FROM tblmasgroup');
    console.log(`   ✅ Total groups: ${groupsResult.rows[0].count}`);
  } catch (error) {
    console.log(`   ❌ Groups table error: ${error.message}`);
  }

  try {
    // Test makes table
    console.log('\n8. Testing makes table:');
    const makesResult = await db.query('SELECT COUNT(*) as count FROM tblmasmake');
    console.log(`   ✅ Total makes: ${makesResult.rows[0].count}`);
  } catch (error) {
    console.log(`   ❌ Makes table error: ${error.message}`);
  }

  console.log('\n🎯 Dashboard API Test:');
  try {
    // Test dashboard stats endpoint logic
    const stats = {};
    
    const itemsResult = await db.query('SELECT COUNT(*) as count FROM tblmasitem WHERE deleted = false OR deleted IS NULL');
    stats.totalItems = parseInt(itemsResult.rows[0].count) || 0;
    
    const suppliersResult = await db.query('SELECT COUNT(*) as count FROM tblmasparty WHERE partytype = 1');
    stats.totalSuppliers = parseInt(suppliersResult.rows[0].count) || 0;
    
    console.log(`   ✅ Dashboard will show: ${stats.totalItems} items, ${stats.totalSuppliers} suppliers`);
    
  } catch (error) {
    console.log(`   ❌ Dashboard API test failed: ${error.message}`);
  }

  console.log('\n✨ Test completed! Your dashboard should work with the current data.');
  console.log('🚀 Start your servers and visit http://localhost:3000/dashboard');
  
  process.exit(0);
}

testCurrentData().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});