const pool = require('./backend/db');

async function checkPermissions() {
  try {
    console.log('=== CHECKING PERMISSIONS 69-72 ===');
    
    const reportPerms = await pool.query('SELECT permission_id, module_name, form_name, action_name, permission_code FROM sec_permissions WHERE permission_id BETWEEN 69 AND 72');
    
    console.log('Permissions 69-72:', reportPerms.rows);
    
    console.log('\n=== CHECKING JAMES ROLE ===');
    const jamesRole = await pool.query('SELECT u.username, r.role_name FROM sec_users u JOIN sec_user_roles ur ON u.user_id = ur.user_id JOIN sec_roles r ON ur.role_id = r.role_id WHERE u.username = $1', ['james']);
    
    console.log('James role:', jamesRole.rows);
    
    console.log('\n=== CHECKING ACCOUNTANT ROLE PERMISSIONS ===');
    const accountantPerms = await pool.query('SELECT r.role_name, p.permission_id, p.module_name, p.form_name, p.action_name, p.permission_code FROM sec_roles r JOIN sec_role_permissions rp ON r.role_id = rp.role_id JOIN sec_permissions p ON rp.permission_id = p.permission_id WHERE r.role_name = $1 AND p.permission_id BETWEEN 69 AND 72', ['Accountant']);
    
    console.log('Accountant role permissions (69-72):', accountantPerms.rows);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

checkPermissions();