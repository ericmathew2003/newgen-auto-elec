const pool = require('./db');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const migrationFile = path.join(__dirname, 'migrations', 'add_is_deleted_to_purchase_return.sql');
  
  try {
    const sql = fs.readFileSync(migrationFile, 'utf8');
    console.log('Running migration: add_is_deleted_to_purchase_return.sql');
    
    await pool.query(sql);
    
    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();