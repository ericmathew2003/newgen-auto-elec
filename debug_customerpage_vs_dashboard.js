const pool = require('./backend/db');

async function debugCustomerPageVsDashboard() {
  try {
    console.log('=== DEBUGGING CUSTOMERPAGE VS DASHBOARD DISCREPANCY ===');
    
    // 1. Get the exact same data that CustomerPage gets from /api/party/all
    console.log('\n1. CustomerPage API data (/api/party/all):');
    const customerPageQuery = `
      SELECT 
        p.partyid as partyid, 
        p.partycode as partycode, 
        p.partytype as partytype, 
        p.partyname as partyname, 
        p.contactno as contactno, 
        p.address1 as address1, 
        p.accountid as accountid, 
        p.gstnum as gstnum, 
        p.address2 as address2, 
        p.created_date, 
        p.edited_date,
        a.account_name, 
        a.account_code
      FROM tblmasparty p
      LEFT JOIN acc_mas_account a ON p.accountid = a.account_id
      ORDER BY p.partyid
    `;
    
    const allParties = await pool.query(customerPageQuery);
    console.log('Total parties from CustomerPage API:', allParties.rows.length);
    
    // 2. Apply CustomerPage filtering logic exactly
    console.log('\n2. Applying CustomerPage filtering:');
    
    // Filter 1: partytype = 1 (customers)
    const customersOnly = allParties.rows.filter(p => {
      const partytype = parseInt(p.partytype ?? 0, 10);
      return partytype === 1;
    });
    console.log('After partytype = 1 filter:', customersOnly.length);
    
    // Check if there are any records with problematic partytype values
    const partytypeAnalysis = {};
    allParties.rows.forEach(p => {
      const type = p.partytype;
      const parsed = parseInt(p.partytype ?? 0, 10);
      const key = `${type} (parsed: ${parsed})`;
      partytypeAnalysis[key] = (partytypeAnalysis[key] || 0) + 1;
    });
    console.log('PartyType analysis:', partytypeAnalysis);
    
    // 3. Check what dashboard query returns
    console.log('\n3. Dashboard query result:');
    const dashboardQuery = `
      SELECT COUNT(*) as customers 
      FROM (
        SELECT p.partyid, p.partytype
        FROM tblmasparty p
        LEFT JOIN acc_mas_account a ON p.accountid = a.account_id
      ) subq 
      WHERE CAST(COALESCE(subq.partytype, 0) AS INTEGER) = 1
    `;
    
    const dashboardResult = await pool.query(dashboardQuery);
    console.log('Dashboard count:', dashboardResult.rows[0].customers);
    
    // 4. Compare the results
    console.log('\n4. Comparison:');
    console.log(`CustomerPage shows: ${customersOnly.length} customers`);
    console.log(`Dashboard shows: ${dashboardResult.rows[0].customers} customers`);
    console.log(`Difference: ${Math.abs(customersOnly.length - dashboardResult.rows[0].customers)}`);
    
    // 5. Find the discrepancy
    if (customersOnly.length !== dashboardResult.rows[0].customers) {
      console.log('\n5. Finding the discrepancy:');
      
      // Check if there are customers that might be filtered out by CustomerPage
      const allCustomersFromDB = await pool.query(`
        SELECT partyid, partyname, partytype, accountid
        FROM tblmasparty 
        WHERE partytype = 1 
        ORDER BY partyid
      `);
      
      console.log('All customers from DB (partytype = 1):', allCustomersFromDB.rows.length);
      
      // Find customers that are in DB but not in CustomerPage result
      const customerPageIds = new Set(customersOnly.map(c => c.partyid));
      const dbCustomerIds = new Set(allCustomersFromDB.rows.map(c => c.partyid));
      
      const missingFromCustomerPage = allCustomersFromDB.rows.filter(c => !customerPageIds.has(c.partyid));
      const extraInCustomerPage = customersOnly.filter(c => !dbCustomerIds.has(c.partyid));
      
      if (missingFromCustomerPage.length > 0) {
        console.log('\nCustomers in DB but missing from CustomerPage:');
        missingFromCustomerPage.forEach(c => {
          console.log(`- ID: ${c.partyid}, Name: ${c.partyname}, Type: ${c.partytype}`);
        });
      }
      
      if (extraInCustomerPage.length > 0) {
        console.log('\nCustomers in CustomerPage but not in simple DB query:');
        extraInCustomerPage.forEach(c => {
          console.log(`- ID: ${c.partyid}, Name: ${c.partyname}, Type: ${c.partytype}`);
        });
      }
      
      // Check if JOIN affects the results
      console.log('\n6. Checking JOIN impact:');
      const withoutJoin = await pool.query('SELECT COUNT(*) as count FROM tblmasparty WHERE partytype = 1');
      const withJoin = await pool.query(`
        SELECT COUNT(*) as count 
        FROM tblmasparty p
        LEFT JOIN acc_mas_account a ON p.accountid = a.account_id
        WHERE p.partytype = 1
      `);
      
      console.log('Without JOIN:', withoutJoin.rows[0].count);
      console.log('With JOIN:', withJoin.rows[0].count);
      
      if (withoutJoin.rows[0].count !== withJoin.rows[0].count) {
        console.log('⚠️ JOIN is affecting the count!');
        
        // Find records that might be affected by JOIN
        const joinIssues = await pool.query(`
          SELECT p.partyid, p.partyname, p.accountid, a.account_id
          FROM tblmasparty p
          LEFT JOIN acc_mas_account a ON p.accountid = a.account_id
          WHERE p.partytype = 1 AND (p.accountid IS NULL OR a.account_id IS NULL)
        `);
        
        console.log('Records with JOIN issues:', joinIssues.rows.length);
        if (joinIssues.rows.length > 0) {
          joinIssues.rows.slice(0, 5).forEach(r => {
            console.log(`- ID: ${r.partyid}, Name: ${r.partyname}, AccountID: ${r.accountid}`);
          });
        }
      }
    }
    
    console.log('\n=== SUMMARY ===');
    if (customersOnly.length === 50) {
      console.log('✅ CustomerPage filtering correctly shows 50 customers');
      console.log('❌ Dashboard needs to use the same filtering logic');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

debugCustomerPageVsDashboard();