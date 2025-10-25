const { Pool } = require('pg');

// Try different connection methods
const configs = [
  {
    user: 'postgres',
    host: 'localhost',
    database: 'postgres',
    password: 'eric@123',
    port: 5432,
  },
  {
    user: 'postgres',
    database: 'postgres',
    // No host/port - use local socket
  },
  {
    user: 'postgres',
    host: 'localhost',
    database: 'postgres',
    // No password - try trust auth
    port: 5432,
  }
];

async function testConnections() {
  for (let i = 0; i < configs.length; i++) {
    console.log(`\nTrying configuration ${i + 1}:`, configs[i]);
    const pool = new Pool(configs[i]);
    
    try {
      const client = await pool.connect();
      console.log('✅ Connection successful!');
      client.release();
      await pool.end();
      return configs[i];
    } catch (err) {
      console.log('❌ Failed:', err.message);
      await pool.end();
    }
  }
  console.log('\n❌ All connection attempts failed');
  return null;
}

testConnections().then(workingConfig => {
  if (workingConfig) {
    console.log('\n✅ Working configuration found:', workingConfig);
  }
  process.exit(workingConfig ? 0 : 1);
});