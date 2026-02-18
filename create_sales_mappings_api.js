/**
 * Create SALES mappings via API
 * Run this script to create SALES event mappings for dynamic journal generation
 */

const API_BASE_URL = 'http://localhost:5000';

// SALES mappings for dynamic journal generation
const salesMappings = [
  {
    transaction_type: 'Sales Invoice',
    event_code: 'Sales',
    entry_sequence: 1,
    account_nature: 'ACCOUNTS_RECEIVABLE',
    debit_credit: 'D',
    value_source: 'SALES_TOTAL_AMOUNT',
    description_template: 'Sales to {{customer_name}} - Invoice {{invoice_no}}',
    is_dynamic_dc: false
  },
  {
    transaction_type: 'Sales Invoice',
    event_code: 'Sales',
    entry_sequence: 2,
    account_nature: 'SALES_REVENUE',
    debit_credit: 'C',
    value_source: 'SALES_TAXABLE_AMOUNT',
    description_template: 'Revenue from sales - Invoice {{invoice_no}}',
    is_dynamic_dc: false
  },
  {
    transaction_type: 'Sales Invoice',
    event_code: 'Sales',
    entry_sequence: 3,
    account_nature: 'OUTPUT_CGST',
    debit_credit: 'C',
    value_source: 'SALES_CGST_AMOUNT',
    description_template: 'CGST on sales - Invoice {{invoice_no}}',
    is_dynamic_dc: false
  },
  {
    transaction_type: 'Sales Invoice',
    event_code: 'Sales',
    entry_sequence: 4,
    account_nature: 'OUTPUT_SGST',
    debit_credit: 'C',
    value_source: 'SALES_SGST_AMOUNT',
    description_template: 'SGST on sales - Invoice {{invoice_no}}',
    is_dynamic_dc: false
  },
  {
    transaction_type: 'Sales Invoice',
    event_code: 'Sales',
    entry_sequence: 5,
    account_nature: 'OUTPUT_IGST',
    debit_credit: 'C',
    value_source: 'SALES_IGST_AMOUNT',
    description_template: 'IGST on sales - Invoice {{invoice_no}}',
    is_dynamic_dc: false
  }
];

// Function to create mappings
async function createSalesMappings() {
  console.log('🚀 Creating SALES Event Mappings');
  console.log('=================================\n');
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const mapping of salesMappings) {
    try {
      console.log(`Creating: ${mapping.account_nature} (${mapping.debit_credit}) - Seq ${mapping.entry_sequence}`);
      
      const response = await fetch(`${API_BASE_URL}/api/transaction-mapping`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
          // Note: Remove Authorization header if not using authentication
          // 'Authorization': 'Bearer YOUR_TOKEN_HERE'
        },
        body: JSON.stringify(mapping)
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log(`✅ Created mapping ID: ${result.mapping_id}`);
        successCount++;
      } else {
        const error = await response.json();
        console.log(`❌ Error: ${error.error}`);
        errorCount++;
      }
    } catch (error) {
      console.log(`❌ Network error: ${error.message}`);
      errorCount++;
    }
  }
  
  console.log(`\n📊 Summary: ${successCount} created, ${errorCount} failed`);
  
  if (successCount > 0) {
    console.log('\n✅ SALES mappings created successfully!');
    console.log('Now when you post a sales invoice, it will generate:');
    console.log('1. Accounts Receivable (Dr) = Total Amount');
    console.log('2. Sales Revenue (Cr) = Taxable Amount');
    console.log('3. Output CGST (Cr) = CGST Amount');
    console.log('4. Output SGST (Cr) = SGST Amount');
    console.log('5. Output IGST (Cr) = IGST Amount');
  }
}

// Function to verify mappings were created
async function verifySalesMappings() {
  console.log('\n🔍 Verifying SALES Mappings');
  console.log('===========================');
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/transaction-mapping/by-event/Sales`);
    
    if (response.ok) {
      const mappings = await response.json();
      console.log(`Found ${mappings.length} Sales mappings:`);
      
      mappings.forEach(mapping => {
        console.log(`  ${mapping.entry_sequence}. ${mapping.account_nature} (${mapping.debit_credit}) = ${mapping.value_source}`);
      });
      
      return mappings.length > 0;
    } else {
      console.log('❌ Could not fetch mappings');
      return false;
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return false;
  }
}

// Main function
async function main() {
  console.log('🎯 SALES Mappings Setup');
  console.log('=======================\n');
  
  // First check if mappings already exist
  const hasExisting = await verifySalesMappings();
  
  if (hasExisting) {
    console.log('\n✅ Sales mappings already exist!');
    console.log('You can now post sales invoices to generate journal entries.');
  } else {
    console.log('\n📝 No Sales mappings found. Creating them...');
    await createSalesMappings();
    
    // Verify they were created
    await verifySalesMappings();
  }
  
  console.log('\n🎉 Setup Complete!');
  console.log('==================');
  console.log('Next steps:');
  console.log('1. Ensure required accounts exist in Chart of Accounts');
  console.log('2. Try posting a confirmed sales invoice');
  console.log('3. Check server logs for journal creation details');
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    createSalesMappings,
    verifySalesMappings,
    salesMappings
  };
}

// Run if called directly
if (typeof window === 'undefined' && require.main === module) {
  main().catch(console.error);
}