const express = require('express');
const router = express.Router();

// Get all predefined value sources (no authentication required, like account natures)
router.get('/', async (req, res) => {
  try {
    console.log('Value sources endpoint called - no auth required');
    
    const { module_tag, is_active } = req.query;
    
    // Predefined value sources that can be used in transaction mappings
    let valueSources = [
      // Purchase Transaction Sources
      { value_code: 'PURCHASE_TAXABLE_AMOUNT', display_name: 'Purchase Taxable Amount', module_tag: 'PURCHASE' },
      { value_code: 'PURCHASE_CGST_AMOUNT', display_name: 'Purchase CGST Amount', module_tag: 'PURCHASE' },
      { value_code: 'PURCHASE_SGST_AMOUNT', display_name: 'Purchase SGST Amount', module_tag: 'PURCHASE' },
      { value_code: 'PURCHASE_IGST_AMOUNT', display_name: 'Purchase IGST Amount', module_tag: 'PURCHASE' },
      { value_code: 'PURCHASE_TOTAL_AMOUNT', display_name: 'Purchase Total Amount', module_tag: 'PURCHASE' },
      { value_code: 'PURCHASE_DISCOUNT_AMOUNT', display_name: 'Purchase Discount Amount', module_tag: 'PURCHASE' },
      { value_code: 'PURCHASE_FREIGHT_AMOUNT', display_name: 'Purchase Freight Amount', module_tag: 'PURCHASE' },
      
      // Sales Transaction Sources
      { value_code: 'SALES_TAXABLE_AMOUNT', display_name: 'Sales Taxable Amount', module_tag: 'SALES' },
      { value_code: 'SALES_CGST_AMOUNT', display_name: 'Sales CGST Amount', module_tag: 'SALES' },
      { value_code: 'SALES_SGST_AMOUNT', display_name: 'Sales SGST Amount', module_tag: 'SALES' },
      { value_code: 'SALES_IGST_AMOUNT', display_name: 'Sales IGST Amount', module_tag: 'SALES' },
      { value_code: 'SALES_TOTAL_AMOUNT', display_name: 'Sales Total Amount', module_tag: 'SALES' },
      { value_code: 'SALES_DISCOUNT_AMOUNT', display_name: 'Sales Discount Amount', module_tag: 'SALES' },
      
      // Journal Entry Sources
      { value_code: 'JOURNAL_AMOUNT', display_name: 'Journal Entry Amount', module_tag: 'JOURNAL' },
      { value_code: 'JOURNAL_DEBIT_AMOUNT', display_name: 'Journal Debit Amount', module_tag: 'JOURNAL' },
      { value_code: 'JOURNAL_CREDIT_AMOUNT', display_name: 'Journal Credit Amount', module_tag: 'JOURNAL' },
      
      // Payment Sources
      { value_code: 'PAYMENT_AMOUNT', display_name: 'Payment Amount', module_tag: 'PAYMENT' },
      { value_code: 'RECEIPT_AMOUNT', display_name: 'Receipt Amount', module_tag: 'RECEIPT' },
      
      // Inventory Sources
      { value_code: 'INVENTORY_VALUE', display_name: 'Inventory Value', module_tag: 'INVENTORY' },
      { value_code: 'COST_OF_GOODS_SOLD', display_name: 'Cost of Goods Sold', module_tag: 'INVENTORY' },
      
      // Other Common Sources
      { value_code: 'BANK_CHARGES', display_name: 'Bank Charges', module_tag: 'BANKING' },
      { value_code: 'INTEREST_AMOUNT', display_name: 'Interest Amount', module_tag: 'BANKING' },
      { value_code: 'ROUND_OFF_AMOUNT', display_name: 'Round Off Amount', module_tag: 'GENERAL' },
      { value_code: 'CUSTOM_AMOUNT', display_name: 'Custom Amount', module_tag: 'GENERAL' }
    ];

    // Apply filters if provided
    if (module_tag) {
      valueSources = valueSources.filter(source => source.module_tag === module_tag);
    }
    
    if (is_active === 'true') {
      // All predefined sources are considered active
      // No filtering needed as all are active
    }
    
    console.log(`Returning ${valueSources.length} value sources`);
    res.json(valueSources);
  } catch (err) {
    console.error('Error fetching value sources:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Get value source by code
router.get('/code/:code', async (req, res) => {
  try {
    const { code } = req.params;
    
    // Find the value source by code
    const valueSources = [
      { value_code: 'PURCHASE_TAXABLE_AMOUNT', display_name: 'Purchase Taxable Amount', module_tag: 'PURCHASE' },
      { value_code: 'PURCHASE_CGST_AMOUNT', display_name: 'Purchase CGST Amount', module_tag: 'PURCHASE' },
      { value_code: 'PURCHASE_SGST_AMOUNT', display_name: 'Purchase SGST Amount', module_tag: 'PURCHASE' },
      { value_code: 'PURCHASE_IGST_AMOUNT', display_name: 'Purchase IGST Amount', module_tag: 'PURCHASE' },
      { value_code: 'PURCHASE_TOTAL_AMOUNT', display_name: 'Purchase Total Amount', module_tag: 'PURCHASE' },
      { value_code: 'PURCHASE_DISCOUNT_AMOUNT', display_name: 'Purchase Discount Amount', module_tag: 'PURCHASE' },
      { value_code: 'PURCHASE_FREIGHT_AMOUNT', display_name: 'Purchase Freight Amount', module_tag: 'PURCHASE' },
      { value_code: 'SALES_TAXABLE_AMOUNT', display_name: 'Sales Taxable Amount', module_tag: 'SALES' },
      { value_code: 'SALES_CGST_AMOUNT', display_name: 'Sales CGST Amount', module_tag: 'SALES' },
      { value_code: 'SALES_SGST_AMOUNT', display_name: 'Sales SGST Amount', module_tag: 'SALES' },
      { value_code: 'SALES_IGST_AMOUNT', display_name: 'Sales IGST Amount', module_tag: 'SALES' },
      { value_code: 'SALES_TOTAL_AMOUNT', display_name: 'Sales Total Amount', module_tag: 'SALES' },
      { value_code: 'SALES_DISCOUNT_AMOUNT', display_name: 'Sales Discount Amount', module_tag: 'SALES' },
      { value_code: 'JOURNAL_AMOUNT', display_name: 'Journal Entry Amount', module_tag: 'JOURNAL' },
      { value_code: 'JOURNAL_DEBIT_AMOUNT', display_name: 'Journal Debit Amount', module_tag: 'JOURNAL' },
      { value_code: 'JOURNAL_CREDIT_AMOUNT', display_name: 'Journal Credit Amount', module_tag: 'JOURNAL' },
      { value_code: 'PAYMENT_AMOUNT', display_name: 'Payment Amount', module_tag: 'PAYMENT' },
      { value_code: 'RECEIPT_AMOUNT', display_name: 'Receipt Amount', module_tag: 'RECEIPT' },
      { value_code: 'INVENTORY_VALUE', display_name: 'Inventory Value', module_tag: 'INVENTORY' },
      { value_code: 'COST_OF_GOODS_SOLD', display_name: 'Cost of Goods Sold', module_tag: 'INVENTORY' },
      { value_code: 'BANK_CHARGES', display_name: 'Bank Charges', module_tag: 'BANKING' },
      { value_code: 'INTEREST_AMOUNT', display_name: 'Interest Amount', module_tag: 'BANKING' },
      { value_code: 'ROUND_OFF_AMOUNT', display_name: 'Round Off Amount', module_tag: 'GENERAL' },
      { value_code: 'CUSTOM_AMOUNT', display_name: 'Custom Amount', module_tag: 'GENERAL' }
    ];
    
    const valueSource = valueSources.find(source => source.value_code === code);
    
    if (!valueSource) {
      return res.status(404).json({ error: 'Value source not found' });
    }
    
    res.json(valueSource);
  } catch (err) {
    console.error('Error fetching value source:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get distinct module tags
router.get('/meta/module-tags', async (req, res) => {
  try {
    const moduleTags = ['PURCHASE', 'SALES', 'JOURNAL', 'PAYMENT', 'RECEIPT', 'INVENTORY', 'BANKING', 'GENERAL'];
    res.json(moduleTags);
  } catch (err) {
    console.error('Error fetching module tags:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;