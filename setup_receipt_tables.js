const pool = require('./backend/db');
const fs = require('fs');

async function setupReceiptTables() {
  console.log('Setting up receipt voucher tables...\n');
  
  try {
    const sql = fs.readFileSync('./setup_receipt_tables.sql', 'utf8');
    await pool.query(sql);
    
    console.log('✓ Receipt voucher tables created successfully');
    
  } catch (error) {
    console.error('❌ Error setting up tables:', error.message);
  } finally {
    await pool.end();
  }
}

setupReceiptTables();
