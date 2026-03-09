const pool = require('./db');

(async () => {
  const client = await pool.connect();
  
  console.log('Looking for sales-related tables...\n');
  
  const result = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND (table_name LIKE '%sale%' OR table_name LIKE '%invoice%')
    ORDER BY table_name
  `);
  
  console.log('Sales/Invoice tables:');
  result.rows.forEach(r => console.log('  -', r.table_name));
  
  client.release();
  process.exit(0);
})();
