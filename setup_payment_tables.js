const pool = require('./backend/db');
const fs = require('fs');

async function setupPaymentTables() {
  console.log('=== Setting Up Payment Voucher Tables ===\n');
  
  const client = await pool.connect();
  try {
    const sql = fs.readFileSync('./setup_payment_tables.sql', 'utf8');
    await client.query(sql);
    
    console.log('✅ Payment tables created successfully!\n');
    
    const tablesCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('acc_trn_payment_voucher', 'acc_trn_payment_allocation', 'acc_trn_cheque')
      ORDER BY table_name
    `);
    
    console.log('Tables created:');
    tablesCheck.rows.forEach(row => {
      console.log(`  ✓ ${row.table_name}`);
    });
    
    console.log('\n✅ Setup complete!');
    console.log('\nNext steps:');
    console.log('1. Restart your backend server');
    console.log('2. Navigate to Accounts → Transactions → Payment Voucher');
    console.log('3. Start creating payments!');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

setupPaymentTables();
