const pool = require('./backend/db');

async function compareCustomerCounts() {
  try {
    console.log('=== COMPARING CUSTOMER COUNTS ===');
    
    // 1. Dashboard query (what dashboard shows)
    console.log('\n1. Dashboard customer count:');
    const dashboardCount = await pool.query(`
      SELECT COUNT(*)::int AS customers FROM tblmasparty WHERE partytype = 1
    `);
    console.log('Dashboard shows:', dashboardCount.rows[0].customers, 'customers');
    
    // 2. CustomerPage query (what CustomerPage gets from API)
    console.log('\n2. CustomerPage API data (/api/party/all):');
    const allParties = await pool.query(`
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
    
    // Simulate CustomerPage filtering
    const customersFromAPI = allParties.rows.filter(p => parseInt(p.partytype ?? 0, 10) === 1);
    console.log('Total parties from API:', allParties.rows.length);
    console.log('Customers after frontend filtering:', customersFromAPI.length);
    
    // 3. Check for data quality issues
    console.log('\n3. Data quality analysis:');
    
    // Check for customers with missing names
    const customersWithoutNames = customersFromAPI.filter(p => !p.partyname || p.partyname.trim() === '');
    console.log('Customers without names:', customersWithoutNames.length);
    
    // Check for duplicate names
    const nameGroups = {};
    customersFromAPI.forEach(p => {
      const name = (p.partyname || '').trim().toLowerCase();
      if (name) {
        nameGroups[name] = (nameGroups[name] || 0) + 1;
      }
    });
    const duplicateNames = Object.entries(nameGroups).filter(([name, count]) => count > 1);
    console.log('Duplicate customer names:', duplicateNames.length);
    if (duplicateNames.length > 0) {
      console.log('Sample duplicates:', duplicateNames.slice(0, 5));
    }
    
    // Check for test/dummy data
    const testCustomers = customersFromAPI.filter(p => {
      const name = (p.partyname || '').toLowerCase();
      return name.includes('test') || name.includes('dummy') || name.includes('sample') || name.includes('demo');
    });
    console.log('Test/dummy customers:', testCustomers.length);
    if (testCustomers.length > 0) {
      console.log('Test customers:', testCustomers.map(p => ({ id: p.partyid, name: p.partyname })));
    }
    
    // 4. Check recent additions
    console.log('\n4. Recent customer additions:');
    const recentCustomers = customersFromAPI
      .filter(p => p.created_date)
      .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
      .slice(0, 10);
    
    console.log('Last 10 customers added:');
    recentCustomers.forEach(p => {
      console.log(`- ID: ${p.partyid}, Name: ${p.partyname}, Added: ${new Date(p.created_date).toLocaleDateString()}`);
    });
    
    // 5. Summary
    console.log('\n=== SUMMARY ===');
    console.log(`Dashboard count: ${dashboardCount.rows[0].customers}`);
    console.log(`CustomerPage count: ${customersFromAPI.length}`);
    console.log(`Difference: ${dashboardCount.rows[0].customers - customersFromAPI.length}`);
    
    if (dashboardCount.rows[0].customers === customersFromAPI.length) {
      console.log('✅ Counts match! The dashboard is showing the correct number.');
      console.log('If you think there should be fewer customers, you may need to:');
      console.log('- Remove test/dummy data');
      console.log('- Clean up duplicate entries');
      console.log('- Archive old/inactive customers');
    } else {
      console.log('❌ Counts do not match! There may be a data consistency issue.');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

compareCustomerCounts();