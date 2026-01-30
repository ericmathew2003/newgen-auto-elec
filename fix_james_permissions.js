const pool = require('./backend/db');

async function fixJamesPermissions() {
  try {
    console.log('=== CHECKING JAMES USER ===');
    
    // Check if James exists
    const jamesUser = await pool.query('SELECT user_id, username, full_name, is_active FROM sec_users WHERE username = $1', ['james']);
    
    if (jamesUser.rows.length === 0) {
      console.log('❌ James user does not exist!');
      return;
    }
    
    console.log('✅ James user found:', jamesUser.rows[0]);
    
    // Check if Accountant role exists
    const accountantRole = await pool.query('SELECT role_id, role_name FROM sec_roles WHERE role_name = $1', ['Accountant']);
    
    if (accountantRole.rows.length === 0) {
      console.log('❌ Accountant role does not exist!');
      return;
    }
    
    console.log('✅ Accountant role found:', accountantRole.rows[0]);
    
    // Check if James already has the Accountant role
    const existingRole = await pool.query('SELECT ur.user_id, ur.role_id FROM sec_user_roles ur WHERE ur.user_id = $1 AND ur.role_id = $2', [jamesUser.rows[0].user_id, accountantRole.rows[0].role_id]);
    
    if (existingRole.rows.length > 0) {
      console.log('✅ James already has Accountant role');
    } else {
      console.log('⚠️ James does not have Accountant role. Assigning...');
      
      // Assign Accountant role to James
      await pool.query('INSERT INTO sec_user_roles (user_id, role_id) VALUES ($1, $2)', [jamesUser.rows[0].user_id, accountantRole.rows[0].role_id]);
      
      console.log('✅ Accountant role assigned to James');
    }
    
    // Verify James now has the report permissions
    console.log('\n=== VERIFYING JAMES PERMISSIONS ===');
    const jamesPerms = await pool.query(`
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
      WHERE u.username = $1 AND p.permission_id BETWEEN 69 AND 72
      ORDER BY p.permission_id
    `, ['james']);
    
    console.log('James report permissions:', jamesPerms.rows);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

fixJamesPermissions();