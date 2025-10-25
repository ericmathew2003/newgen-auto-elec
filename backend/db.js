const { Pool, types } = require('pg');

// Load environment variables
require('dotenv').config();

// Globally parse NUMERIC (1700) and MONEY (790) to JS numbers
// MONEY comes formatted with currency symbols; strip non-numeric chars
types.setTypeParser(1700, (val) => (val === null ? null : parseFloat(val)));
types.setTypeParser(790, (val) => (val === null ? null : parseFloat(val.replace(/[^0-9.-]+/g, ''))));

// Database configuration
const isProduction = process.env.NODE_ENV === 'production';
const databaseUrl = process.env.DATABASE_URL;

let poolConfig;

if (databaseUrl) {
  // Use DATABASE_URL if provided (for hosting platforms)
  poolConfig = {
    connectionString: databaseUrl,
    ssl: isProduction ? { rejectUnauthorized: false } : false
  };
  console.log('🔗 Using DATABASE_URL connection string');
} else {
  // Use individual environment variables or defaults
  poolConfig = {
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'newgen',
    password: process.env.DB_PASSWORD || 'eric@123',
    port: parseInt(process.env.DB_PORT) || 5433,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
  };
  console.log('🔧 Using individual database configuration');
  console.log(`   Host: ${poolConfig.host}:${poolConfig.port}`);
  console.log(`   Database: ${poolConfig.database}`);
}

const pool = new Pool(poolConfig);

pool.connect()
  .then(client => {
    console.log('✅ PostgreSQL database connected successfully.');
    client.release();
  })
  .catch(err => {
    console.error('❌ PostgreSQL connection error:', err.message);

    if (err.code === 'ECONNREFUSED' && !isProduction) {
      console.error('');
      console.error('🔧 Local PostgreSQL Setup Required:');
      console.error('1. Edit C:\\Program Files\\PostgreSQL\\17\\data\\postgresql.conf');
      console.error('   Uncomment: listen_addresses = \'localhost\'');
      console.error('2. Edit C:\\Program Files\\PostgreSQL\\17\\data\\pg_hba.conf');
      console.error('   Add: host    all             all             127.0.0.1/32            md5');
      console.error('3. Restart PostgreSQL: Restart-Service postgresql-x64-17');
      console.error('');
      console.error('Or use a cloud database by setting DATABASE_URL in .env');
    }
  });

module.exports = pool;
