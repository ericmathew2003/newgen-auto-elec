const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'postgres',
  password: 'eric@123',
  port: 5432,
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('Connection error:', err);
    return;
  }
  console.log('Connected successfully!');
  release();
  pool.end();
});