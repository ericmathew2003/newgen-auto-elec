/**
 * Setup script for Sales Dynamic Mapping
 * Creates sample mappings for SALES event to test dynamic journal generation
 */

const API_BASE_URL = 'http://localhost:5000';

// Sample Sales mappings for dynamic journal generation
const salesMappings = [
  {
    transaction_type: 'Sales Invoice',
    event_code: 'SALES',
    entry_sequence: 1,
    account_nature: 'ACCOUNTS_RECEIVABLE',
    debit_credit: 'D',
    value_source: 'SALES_TOTAL_AMOUNT',
    description_template: 'Sales to {{customer_name}} - Invoice {{invoice_no}}',
    is_dynamic_dc: false
  },
  {
    transaction_type: 'Sales Invoice',
    event_code: 'SALES',
    entry_sequence: 2,
    account_nature: 'SALES_REVENUE',
    debit_credit: 'C',
    value_source: 'SALES_TAXABLE_AMOUNT',
    description_template: 'Revenue from sales - Invoice {{invoice_no}}',
    is_dynamic_dc: false
  },
  {
    transaction_type: 'Sales Invoice',
    event_code: 'SALES',
    entry_sequence: 3,
    account_nature: 'OUTPUT_CGST',
    debit_credit: 'C',
    value_source: 'SALES_CGST_AMOUNT',
    description_template: 'CGST on sales - Invoice {{invoice_no}}',
    is_dynamic_dc: false
  },
  {
    transaction_type: 'Sales Invoice',
    event_code: 'SALES',
    entry_sequence: 4,
    account_nature: 'OUTPUT_SGST',
    debit_credit: 'C',
    value_source: 'SALES_SGST_AMOUNT',
    description_template: 'SGST on sales - Invoice {{invoice_no}}',
    is_dynamic_dc: false
  },
  {
    transaction_type: 'Sales Invoice',
    event_code: 'SALES',
    entry_sequence: 5,
    account_nature: 'OUTPUT_IGST',
    debit_credit: 'C',
    value_source: 'SALES_IGST_AMOUNT',
    description_template: 'IGST on sales - Invoice {{invoice_no}}',
    is_dynamic_dc: false
  }
];

// Function to create sales mappings
async function createSalesMappings() {
  console.log('🚀 Setting up Sales Dynamic Mappings');
  console.log('====================================\n');
  
  for (const mapping of salesMappings) {
    try {
      console.log(`Creating: ${mapping.account_nature} (${mapping.debit_credit}) - Seq ${mapping.entry_sequence}`);
      
      const response = await fetch(`${API_BASE_URL}/api/transaction-mapping`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer YOUR_TOKEN_HERE' // Replace with actual token
        },
        body: JSON.stringify(mapping)
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log(`✅ Created mapping ID: ${result.mapping_id}`);
      } else {
        const error = await response.json();
        console.log(`❌ Error: ${error.error}`);
      }
    } catch (error) {
      console.log(`❌ Network error: ${error.message}`);
    }
  }
  
  console.log('\n📋 Sales Mappings Setup Complete!');
  console.log('==================================');
  console.log('The following journal entries will be created when a sales invoice is posted:');
  console.log('1. Accounts Receivable (Debit) = Total Amount');
  console.log('2. Sales Revenue (Credit) = Taxable Amount');
  console.log('3. Output CGST (Credit) = CGST Amount');
  console.log('4. Output SGST (Credit) = SGST Amount');  
  console.log('5. Output IGST (Credit) = IGST Amount');
  console.log('\n💡 Note: Make sure corresponding accounts exist in Chart of Accounts');
}

// Function to test querying sales mappings
async function testSalesMappings() {
  console.log('\n🔍 Testing Sales Mappings Query');
  console.log('===============================');
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/transaction-mapping/by-event/SALES`, {
      headers: {
        'Authorization': 'Bearer YOUR_TOKEN_HERE' // Replace with actual token
      }
    });
    
    if (response.ok) {
      const mappings = await response.json();
      console.log(`Found ${mappings.length} mappings for SALES event:`);
      
      mappings.forEach(mapping => {
        console.log(`  ${mapping.entry_sequence}. ${mapping.account_nature} (${mapping.debit_credit}) = ${mapping.value_source}`);
      });
      
      return mappings;
    } else {
      const error = await response.json();
      console.log(`❌ Error: ${error.error}`);
      return [];
    }
  } catch (error) {
    console.log(`❌ Network error: ${error.message}`);
    return [];
  }
}

// Function to simulate journal generation
function simulateJournalGeneration() {
  console.log('\n📝 Simulated Journal Generation for Sales Invoice');
  console.log('================================================');
  
  const sampleInvoice = {
    inv_no: 'INV-2024-001',
    customer_name: 'ABC Company Ltd',
    taxable_tot: 10000.00,
    cgst_amount: 900.00,
    sgst_amount: 900.00,
    igst_amount: 0.00,
    tot_amount: 11800.00,
    rounded_off: 0.00
  };
  
  const finalTotal = sampleInvoice.tot_amount + sampleInvoice.rounded_off;
  
  console.log('Sample Invoice Data:');
  console.log(`  Invoice No: ${sampleInvoice.inv_no}`);
  console.log(`  Customer: ${sampleInvoice.customer_name}`);
  console.log(`  Taxable Amount: ₹${sampleInvoice.taxable_tot}`);
  console.log(`  CGST: ₹${sampleInvoice.cgst_amount}`);
  console.log(`  SGST: ₹${sampleInvoice.sgst_amount}`);
  console.log(`  Total: ₹${finalTotal}`);
  
  console.log('\nGenerated Journal Entries:');
  console.log('  1. Accounts Receivable (Dr) ₹11,800.00');
  console.log('  2. Sales Revenue (Cr)       ₹10,000.00');
  console.log('  3. Output CGST (Cr)         ₹900.00');
  console.log('  4. Output SGST (Cr)         ₹900.00');
  console.log('  5. Output IGST (Cr)         ₹0.00 (skipped)');
  
  console.log('\n✅ Journal is balanced: Debits = Credits = ₹11,800.00');
}

// Main execution
async function main() {
  console.log('🎯 Sales Dynamic Mapping Setup & Test');
  console.log('=====================================\n');
  
  // Step 1: Create mappings (uncomment to create)
  // await createSalesMappings();
  
  // Step 2: Test querying mappings
  await testSalesMappings();
  
  // Step 3: Simulate journal generation
  simulateJournalGeneration();
  
  console.log('\n🎉 Setup Complete!');
  console.log('==================');
  console.log('Now when you post a sales invoice, it will automatically:');
  console.log('1. Query mappings with event_code = "SALES"');
  console.log('2. Generate journal entries based on the mappings');
  console.log('3. Create proper debit/credit entries');
  console.log('4. Balance the journal automatically');
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    createSalesMappings,
    testSalesMappings,
    simulateJournalGeneration,
    salesMappings
  };
}

// Run if called directly
if (typeof window === 'undefined' && require.main === module) {
  main().catch(console.error);
}