const pool = require('./db');
const fs = require('fs');

async function runMigration() {
  try {
    console.log('Running debit note tables migration...');
    const sql = fs.readFileSync('./migrations/create_debit_note_tables.sql', 'utf8');
    await pool.query(sql);
    console.log('✅ Debit note tables created successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();