const pool = require('./backend/db');

async function verifyJamesPermissions() {
  try {
    console.log('=== VERIFYING JAMES PERMISSIONS ===');
    
    // Check James user (with capital J)
    const jamesUser = await pool.query('SELECT user_id, username, full_name, is_active FROM sec_users WHERE username = $1', ['James']);
    
    if (jamesUser.rows.length === 0) {
      console.log('❌ James user not found!');
      return;
    }
    
    console.log('✅ James user found:', jamesUser.rows[0]);
    
    // Check James's roles
    const jamesRoles = await pool.query(`
      SELECT u.username, r.role_name 
      FROM sec_users u 
      JOIN sec_user_roles ur ON u.user_id = ur.user_id 
      JOIN sec_roles r ON ur.role_id = r.role_id 
      WHERE u.username = $1
    `, ['James']);
    
    console.log('✅ James roles:', jamesRoles.rows);
    
    // Check James's report permissions specifically
    const jamesReportPerms = await pool.query(`
      SELECT 
          u.username,
          r.role_name,
          p.permission_id,
          p.module_name,
          p.form_name,
          p.action_name,
          p.permission_code
      FROM sec_users u
      JOIN sec_user_roles ur ON u.user_id = ur.user_id
      JOIN sec_roles r ON ur.role_id = r.role_id
      JOIN sec_role_permissions rp ON r.role_id = rp.role_id
      JOIN sec_permissions p ON rp.permission_id = p.permission_id
      WHERE u.username = $1 
      AND (p.form_name = 'REPORT_GST_INVOICE' OR p.form_name = 'REPORT_SALES_PURCHASE')
      ORDER BY p.permission_id
    `, ['James']);
    
    console.log('✅ James report permissions:', jamesReportPerms.rows);
    
    // Check all James's permissions
    const allJamesPerms = await pool.query(`
      SELECT 
          p.module_name,
          p.form_name,
          p.action_name,
          p.permission_code
      FROM sec_users u
      JOIN sec_user_roles ur ON u.user_id = ur.user_id
      JOIN sec_roles r ON ur.role_id = r.role_id
      JOIN sec_role_permissions rp ON r.role_id = rp.role_id
      JOIN sec_permissions p ON rp.permission_id = p.permission_id
      WHERE u.username = $1
      ORDER BY p.module_name, p.form_name, p.action_name
    `, ['James']);
    
    console.log('✅ All James permissions count:', allJamesPerms.rows.length);
    console.log('Sample permissions:', allJamesPerms.rows.slice(0, 10));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

verifyJamesPermissions();