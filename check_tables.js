const pool = require('./backend/db');

(async () => {
  try {
    const client = await pool.connect();
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%year%'
      ORDER BY table_name
    `);
    console.log('Tables containing "year":');
    result.rows.forEach(row => {
      console.log('- ' + row.table_name);
    });
    
    // Also check for any fyear related columns in existing tables
    const colResult = await client.query(`
      SELECT table_name, column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND column_name LIKE '%fyear%'
      ORDER BY table_name, column_name
    `);
    console.log('\nColumns containing "fyear":');
    colResult.rows.forEach(row => {
      console.log('- ' + row.table_name + '.' + row.column_name);
    });
    
    client.release();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();