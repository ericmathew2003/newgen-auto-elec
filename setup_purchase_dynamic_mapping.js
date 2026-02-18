const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database configuration
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'your_database',
  password: process.env.DB_PASSWORD || 'your_password',
  port: process.env.DB_PORT || 5432,
});

async function runMigration(filePath, description) {
  try {
    console.log(`\n🔄 Running: ${description}`);
    const sql = fs.readFileSync(filePath, 'utf8');
    const result = await pool.query(sql);
    console.log(`✅ Completed: ${description}`);
    return result;
  } catch (error) {
    console.error(`❌ Error in ${description}:`, error.message);
    throw error;
  }
}

async function setupPurchaseDynamicMapping() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Setting up Purchase Dynamic Mapping...\n');
    
    // 1. Setup Chart of Accounts with proper account natures
    await runMigration(
      path.join(__dirname, 'backend/migrations/insert_coa_account_natures.sql'),
      'Setting up Chart of Accounts with account natures'
    );
    
    // 2. Setup transaction mappings for purchase invoices
    await runMigration(
      path.join(__dirname, 'backend/migrations/insert_purchase_transaction_mappings.sql'),
      'Setting up transaction mappings for purchase invoices'
    );
    
    console.log('\n🎉 Purchase Dynamic Mapping setup completed successfully!');
    console.log('\n📋 Summary:');
    console.log('- Chart of Accounts updated with proper account natures');
    console.log('- Transaction mappings created for Purchase');
    console.log('- Purchase posting will now use dynamic journal entry generation');
    
    // Display the mappings
    console.log('\n📊 Transaction Mappings Created:');
    const mappings = await client.query(`
      SELECT entry_sequence, account_nature, debit_credit, value_source, description_template
      FROM con_transaction_mapping 
      WHERE transaction_type = 'Purchase' 
      ORDER BY entry_sequence
    `);
    
    mappings.rows.forEach(mapping => {
      console.log(`${mapping.entry_sequence}. ${mapping.debit_credit === 'D' ? 'Dr' : 'Cr'} ${mapping.account_nature} (${mapping.value_source})`);
    });
    
    console.log('\n📊 Chart of Accounts with Account Natures:');
    const accounts = await client.query(`
      SELECT account_code, account_name, account_nature, account_type
      FROM acc_mas_coa 
      WHERE account_nature IN ('INVENTORY', 'INPUT_CGST', 'INPUT_SGST', 'INPUT_IGST', 
                              'TRANSPORT_EXPENSE', 'LABOUR_EXPENSE', 'MISC_EXPENSE', 'ACCOUNTS_PAYABLE')
      ORDER BY account_code
    `);
    
    accounts.rows.forEach(account => {
      console.log(`${account.account_code} - ${account.account_name} (${account.account_nature})`);
    });
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the setup
setupPurchaseDynamicMapping();