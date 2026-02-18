const pool = require('./backend/db');
const fs = require('fs');

(async () => {
  try {
    const client = await pool.connect();
    
    console.log('Running accounting tables migration...');
    const accountingSql = fs.readFileSync('./backend/migrations/create_accounting_tables.sql', 'utf8');
    await client.query(accountingSql);
    console.log('✅ Accounting tables created');
    
    console.log('Running purchase status migration...');
    const statusSql = fs.readFileSync('./backend/migrations/update_purchase_status.sql', 'utf8');
    await client.query(statusSql);
    console.log('✅ Purchase status column added');
    
    client.release();
    console.log('🎉 All migrations completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
})();