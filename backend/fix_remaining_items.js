const fs = require('fs');

function fixRemainingItems() {
  console.log('Creating fixed import for remaining items...');
  
  const csvContent = fs.readFileSync('item.csv', 'utf8');
  const lines = csvContent.split('\n').filter(line => line.trim());
  
  let sqlContent = '-- Fixed import for remaining items\n';
  let processed = 0;
  
  lines.forEach((line, index) => {
    try {
      const columns = line.split(',');
      
      const itemcode = parseInt(columns[0]) || 0;
      const groupid = parseInt(columns[1]) || null;
      const makeid = parseInt(columns[2]) || null;
      const brandid = parseInt(columns[3]) || null;
      
      // Fix item name - truncate if too long
      let itemname = (columns[4] || '').replace(/^"/, '').replace(/"$/, '').replace(/'/g, "''");
      if (itemname.length > 200) itemname = itemname.substring(0, 197) + '...';
      
      const cost = parseFloat(columns[7]) || 0;
      const avgcost = parseFloat(columns[8]) || 0;
      const curstock = parseFloat(columns[9]) || 0;
      const sprice = parseFloat(columns[10]) || 0;
      const mrp = parseFloat(columns[11]) || 0;
      
      // Fix unit - truncate to 6 characters max
      let unit = (columns[12] || 'PCS').replace(/"/g, '');
      if (unit.length > 6) unit = unit.substring(0, 6);
      
      // Fix suppref - truncate to 10 characters max
      let suppref = (columns[13] || '').replace(/"/g, '');
      if (suppref.length > 10) suppref = suppref.substring(0, 10);
      
      // Fix model - truncate to 100 characters max
      let model = (columns[14] || '').replace(/"/g, '');
      if (model.length > 100) model = model.substring(0, 97) + '...';
      
      // Fix tax rates - cap at 99.99%
      let cgst = parseFloat(columns[15]) || 0;
      let sgst = parseFloat(columns[16]) || 0;
      if (cgst > 99.99) cgst = 18.00;
      if (sgst > 99.99) sgst = 18.00;
      
      const partyid = parseInt(columns[19]) || null;
      const isexpence = columns[20] === 't';
      const deleted = columns[21] === 't';
      const billable = columns[24] === 't';
      
      // Use INSERT with ON CONFLICT DO NOTHING to skip existing items
      sqlContent += `INSERT INTO tblmasitem (itemcode, groupid, makeid, brandid, itemname, cost, avgcost, curstock, sprice, mrp, unit, suppref, model, cgst, sgst, igst, partyid, isexpence, deleted, billable, created_date, edited_date) VALUES (${itemcode}, ${groupid}, ${makeid}, ${brandid}, '${itemname}', ${cost}, ${avgcost}, ${curstock}, ${sprice}, ${mrp}, '${unit}', '${suppref}', '${model}', ${cgst}, ${sgst}, ${cgst}, ${partyid}, ${isexpence}, ${deleted}, ${billable}, NOW(), NOW()) ON CONFLICT (itemcode) DO NOTHING;\n`;
      
      processed++;
      
    } catch (error) {
      console.error(`Error on line ${index + 1}: ${error.message}`);
    }
  });
  
  sqlContent += '\n-- Check final count\nSELECT COUNT(*) as total_items FROM tblmasitem;\n';
  
  fs.writeFileSync('fixed_items_import.sql', sqlContent);
  console.log(`Created fixed_items_import.sql with ${processed} items`);
  console.log('This will add missing items and skip existing ones');
}

fixRemainingItems();