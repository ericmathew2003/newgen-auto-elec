const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'accounts_db',
  user: 'postgres',
  password: 'Lotus@123'
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('=== Starting Value Source Migration ===\n');
    
    // Start transaction
    await client.query('BEGIN');
    
    // Clear existing data
    console.log('1. Clearing existing data...');
    await client.query('TRUNCATE TABLE con_acc_value_source');
    console.log('   ✓ Table truncated\n');
    
    // Insert all value sources
    console.log('2. Inserting value sources...\n');
    
    const valueSources = [
      // PURCHASE MODULE
      { code: 'PURCHASE_TAXABLE_AMOUNT', name: 'Purchase Taxable Amount', module: 'PURCHASE', desc: 'Total taxable amount before taxes in purchase transactions' },
      { code: 'PURCHASE_CGST_AMOUNT', name: 'Purchase CGST Amount', module: 'PURCHASE', desc: 'Central GST amount in purchase transactions' },
      { code: 'PURCHASE_SGST_AMOUNT', name: 'Purchase SGST Amount', module: 'PURCHASE', desc: 'State GST amount in purchase transactions' },
      { code: 'PURCHASE_IGST_AMOUNT', name: 'Purchase IGST Amount', module: 'PURCHASE', desc: 'Integrated GST amount in purchase transactions' },
      { code: 'PURCHASE_TOTAL_AMOUNT', name: 'Purchase Total Amount', module: 'PURCHASE', desc: 'Total amount including all taxes in purchase transactions' },
      { code: 'PURCHASE_DISCOUNT_AMOUNT', name: 'Purchase Discount Amount', module: 'PURCHASE', desc: 'Discount amount in purchase transactions' },
      { code: 'PURCHASE_FREIGHT_AMOUNT', name: 'Purchase Freight Amount', module: 'PURCHASE', desc: 'Freight/shipping charges in purchase transactions' },
      
      // PURCHASE_RETURN MODULE
      { code: 'PURCHASE_RETURN_TAXABLE_AMOUNT', name: 'Purchase Return Taxable Amount', module: 'PURCHASE_RETURN', desc: 'Total taxable amount before taxes in purchase return transactions' },
      { code: 'PURCHASE_RETURN_CGST_AMOUNT', name: 'Purchase Return CGST Amount', module: 'PURCHASE_RETURN', desc: 'Central GST amount in purchase return transactions' },
      { code: 'PURCHASE_RETURN_SGST_AMOUNT', name: 'Purchase Return SGST Amount', module: 'PURCHASE_RETURN', desc: 'State GST amount in purchase return transactions' },
      { code: 'PURCHASE_RETURN_IGST_AMOUNT', name: 'Purchase Return IGST Amount', module: 'PURCHASE_RETURN', desc: 'Integrated GST amount in purchase return transactions' },
      { code: 'PURCHASE_RETURN_TOTAL_AMOUNT', name: 'Purchase Return Total Amount', module: 'PURCHASE_RETURN', desc: 'Total amount including all taxes in purchase return transactions' },
      { code: 'PURCHASE_RETURN_DISCOUNT_AMOUNT', name: 'Purchase Return Discount Amount', module: 'PURCHASE_RETURN', desc: 'Discount amount in purchase return transactions' },
      { code: 'PURCHASE_RETURN_FREIGHT_AMOUNT', name: 'Purchase Return Freight Amount', module: 'PURCHASE_RETURN', desc: 'Freight/shipping charges in purchase return transactions' },
      
      // SALES MODULE
      { code: 'SALES_TAXABLE_AMOUNT', name: 'Sales Taxable Amount', module: 'SALES', desc: 'Total taxable amount before taxes in sales transactions' },
      { code: 'SALES_CGST_AMOUNT', name: 'Sales CGST Amount', module: 'SALES', desc: 'Central GST amount in sales transactions' },
      { code: 'SALES_SGST_AMOUNT', name: 'Sales SGST Amount', module: 'SALES', desc: 'State GST amount in sales transactions' },
      { code: 'SALES_IGST_AMOUNT', name: 'Sales IGST Amount', module: 'SALES', desc: 'Integrated GST amount in sales transactions' },
      { code: 'SALES_TOTAL_AMOUNT', name: 'Sales Total Amount', module: 'SALES', desc: 'Total amount including all taxes in sales transactions' },
      { code: 'SALES_DISCOUNT_AMOUNT', name: 'Sales Discount Amount', module: 'SALES', desc: 'Discount amount in sales transactions' },
      
      // SALES_RETURN MODULE
      { code: 'SALES_RETURN_TAXABLE_AMOUNT', name: 'Sales Return Taxable Amount', module: 'SALES_RETURN', desc: 'Total taxable amount before taxes in sales return transactions' },
      { code: 'SALES_RETURN_CGST_AMOUNT', name: 'Sales Return CGST Amount', module: 'SALES_RETURN', desc: 'Central GST amount in sales return transactions' },
      { code: 'SALES_RETURN_SGST_AMOUNT', name: 'Sales Return SGST Amount', module: 'SALES_RETURN', desc: 'State GST amount in sales return transactions' },
      { code: 'SALES_RETURN_IGST_AMOUNT', name: 'Sales Return IGST Amount', module: 'SALES_RETURN', desc: 'Integrated GST amount in sales return transactions' },
      { code: 'SALES_RETURN_TOTAL_AMOUNT', name: 'Sales Return Total Amount', module: 'SALES_RETURN', desc: 'Total amount including all taxes in sales return transactions' },
      { code: 'SALES_RETURN_DISCOUNT_AMOUNT', name: 'Sales Return Discount Amount', module: 'SALES_RETURN', desc: 'Discount amount in sales return transactions' },
      
      // JOURNAL MODULE
      { code: 'JOURNAL_AMOUNT', name: 'Journal Entry Amount', module: 'JOURNAL', desc: 'General amount for journal entries' },
      { code: 'JOURNAL_DEBIT_AMOUNT', name: 'Journal Debit Amount', module: 'JOURNAL', desc: 'Debit amount in journal entries' },
      { code: 'JOURNAL_CREDIT_AMOUNT', name: 'Journal Credit Amount', module: 'JOURNAL', desc: 'Credit amount in journal entries' },
      
      // PAYMENT & RECEIPT MODULE
      { code: 'PAYMENT_AMOUNT', name: 'Payment Amount', module: 'PAYMENT', desc: 'Amount in payment transactions' },
      { code: 'RECEIPT_AMOUNT', name: 'Receipt Amount', module: 'RECEIPT', desc: 'Amount in receipt transactions' },
      
      // INVENTORY MODULE
      { code: 'INVENTORY_VALUE', name: 'Inventory Value', module: 'INVENTORY', desc: 'Value of inventory items' },
      { code: 'COST_OF_GOODS_SOLD', name: 'Cost of Goods Sold', module: 'INVENTORY', desc: 'Cost of goods sold in sales transactions' },
      
      // BANKING MODULE
      { code: 'BANK_CHARGES', name: 'Bank Charges', module: 'BANKING', desc: 'Bank charges and fees' },
      { code: 'INTEREST_AMOUNT', name: 'Interest Amount', module: 'BANKING', desc: 'Interest amount in banking transactions' },
      
      // GENERAL MODULE
      { code: 'ROUND_OFF_AMOUNT', name: 'Round Off Amount', module: 'GENERAL', desc: 'Decimal round-off adjustment amount (can be used in all transaction types)' },
      { code: 'CUSTOM_AMOUNT', name: 'Custom Amount', module: 'GENERAL', desc: 'Custom/miscellaneous amount field' }
    ];
    
    let insertCount = 0;
    for (const vs of valueSources) {
      await client.query(
        `INSERT INTO con_acc_value_source (value_code, display_name, module_tag, description, is_active) 
         VALUES ($1, $2, $3, $4, true)`,
        [vs.code, vs.name, vs.module, vs.desc]
      );
      insertCount++;
      if (insertCount % 5 === 0) {
        console.log(`   Inserted ${insertCount}/${valueSources.length} records...`);
      }
    }
    
    console.log(`   ✓ Inserted all ${insertCount} value sources\n`);
    
    // Commit transaction
    await client.query('COMMIT');
    console.log('3. Transaction committed\n');
    
    // Verify the data
    console.log('4. Verifying data...\n');
    
    const countResult = await client.query('SELECT COUNT(*) as total FROM con_acc_value_source');
    console.log(`   Total records: ${countResult.rows[0].total}`);
    
    const moduleResult = await client.query(`
      SELECT module_tag, COUNT(*) as count 
      FROM con_acc_value_source 
      GROUP BY module_tag 
      ORDER BY module_tag
    `);
    
    console.log('\n   Records by module:');
    moduleResult.rows.forEach(row => {
      console.log(`     ${row.module_tag.padEnd(20)} : ${row.count} entries`);
    });
    
    console.log('\n✅ Migration completed successfully!');
    console.log('\nNext steps:');
    console.log('  1. Restart your backend server');
    console.log('  2. Go to Dynamic Transaction Mapping page');
    console.log('  3. Check the Value Source dropdown - it should now include PURCHASE_RETURN and SALES_RETURN');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error.message);
    console.error('Transaction rolled back');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(console.error);
