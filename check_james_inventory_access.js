const pool = require('./backend/db');

async function checkJamesInventoryAccess() {
  try {
    console.log('=== CHECKING JAMES INVENTORY ACCESS ===');
    
    // Check James's report permissions
    const jamesReportPerms = await pool.query(`
      SELECT 
          u.username,
          r.role_name,
          p.permission_code,
          p.form_name,
          p.action_name
      FROM sec_users u
      JOIN sec_user_roles ur ON u.user_id = ur.user_id
      JOIN sec_roles r ON ur.role_id = r.role_id
      JOIN sec_role_permissions rp ON r.role_id = rp.role_id
      JOIN sec_permissions p ON rp.permission_id = p.permission_id
      WHERE u.username = $1 
      AND p.module_name = 'INVENTORY'
      AND (p.form_name = 'REPORT_GST_INVOICE' OR p.form_name = 'REPORT_SALES_PURCHASE')
      ORDER BY p.form_name, p.action_name
    `, ['James']);
    
    console.log('✅ James report permissions:', jamesReportPerms.rows);
    
    // Check if James has any inventory permissions that would show the Inventory menu
    const jamesInventoryPerms = await pool.query(`
      SELECT 
          p.form_name,
          p.action_name,
          p.permission_code
      FROM sec_users u
      JOIN sec_user_roles ur ON u.user_id = ur.user_id
      JOIN sec_roles r ON ur.role_id = r.role_id
      JOIN sec_role_permissions rp ON r.role_id = rp.role_id
      JOIN sec_permissions p ON rp.permission_id = p.permission_id
      WHERE u.username = $1 
      AND p.module_name = 'INVENTORY'
      AND p.form_name IN ('ITEM_MASTER', 'REPORT_GST_INVOICE', 'REPORT_SALES_PURCHASE', 'PURCHASE', 'PURCHASE_RETURN', 'SALES')
      ORDER BY p.form_name, p.action_name
    `, ['James']);
    
    console.log('✅ James inventory permissions that enable menu access:', jamesInventoryPerms.rows);
    
    // Summary
    const hasReportAccess = jamesReportPerms.rows.length > 0;
    const hasInventoryAccess = jamesInventoryPerms.rows.length > 0;
    
    console.log('\n=== SUMMARY ===');
    console.log(`James has report permissions: ${hasReportAccess}`);
    console.log(`James should see Inventory menu: ${hasInventoryAccess}`);
    
    if (hasInventoryAccess) {
      console.log('✅ James should now be able to see the Inventory section and access reports!');
    } else {
      console.log('❌ James still cannot see the Inventory section. Check role assignments.');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

checkJamesInventoryAccess();