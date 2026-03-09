const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'newgen',
  password: 'karthik',
  port: 5432,
});

async function calculateAvgCost() {
  const client = await pool.connect();
  
  try {
    console.log('Checking items with avg_cost...\n');
    
    // Check current avg_cost values
    const checkResult = await client.query(`
      SELECT 
        itemcode,
        itemname,
        avgcost,
        salerate
      FROM tblmasitem
      WHERE avgcost IS NULL OR avgcost = 0
      LIMIT 10
    `);
    
    console.log(`Found ${checkResult.rows.length} items with zero or null avg_cost (showing first 10):`);
    checkResult.rows.forEach(item => {
      console.log(`  Item ${item.itemcode}: ${item.itemname} - AvgCost: ${item.avgcost}, SaleRate: ${item.salerate}`);
    });
    
    // Calculate avg_cost from stock ledger for items that don't have it
    console.log('\nCalculating avg_cost from stock ledger...');
    
    const updateResult = await client.query(`
      UPDATE tblmasitem i
      SET avgcost = COALESCE((
        SELECT AVG(s.rate)
        FROM acc_trn_stock_ledger s
        WHERE s.item_code = i.itemcode
          AND s.tran_type IN ('PUR', 'PURCHASE')
          AND s.rate > 0
      ), i.salerate * 0.7, 0)
      WHERE i.avgcost IS NULL OR i.avgcost = 0
      RETURNING itemcode, itemname, avgcost
    `);
    
    console.log(`\nUpdated ${updateResult.rows.length} items with calculated avg_cost:`);
    updateResult.rows.slice(0, 10).forEach(item => {
      console.log(`  Item ${item.itemcode}: ${item.itemname} - New AvgCost: ${item.avgcost}`);
    });
    
    // Show summary
    const summaryResult = await client.query(`
      SELECT 
        COUNT(*) as total_items,
        COUNT(CASE WHEN avgcost > 0 THEN 1 END) as items_with_cost,
        COUNT(CASE WHEN avgcost IS NULL OR avgcost = 0 THEN 1 END) as items_without_cost
      FROM tblmasitem
    `);
    
    console.log('\n=== Summary ===');
    console.log(`Total items: ${summaryResult.rows[0].total_items}`);
    console.log(`Items with avg_cost: ${summaryResult.rows[0].items_with_cost}`);
    console.log(`Items without avg_cost: ${summaryResult.rows[0].items_without_cost}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

calculateAvgCost();
