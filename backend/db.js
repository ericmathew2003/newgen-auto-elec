const { Pool, types } = require('pg');

// Globally parse NUMERIC (1700) and MONEY (790) to JS numbers
// MONEY comes formatted with currency symbols; strip non-numeric chars
types.setTypeParser(1700, (val) => (val === null ? null : parseFloat(val)));
types.setTypeParser(790, (val) => (val === null ? null : parseFloat(val.replace(/[^0-9.-]+/g, ''))));

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'newgen',
  password: 'eric@123',
  port: 5433,
});

pool.connect()
  .then(client => {
    console.log('✅ PostgreSQL database connected successfully.');
    client.release(); // release the client back to the pool
  })
  .catch(err => {
    console.error('❌ PostgreSQL connection error:', err.message);
  });

module.exports = pool;
