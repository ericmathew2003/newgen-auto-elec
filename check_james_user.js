const pool = require('./backend/db');

async function checkJames() {
  try {
    console.log('=== CHECKING JAMES USER ===');
    
    // Check if James exists
    const jamesUser = await pool.query('SELECT user_id, username, full_name, is_active FROM sec_users WHERE username = $1', ['james']);
    
    console.log('James user:', jamesUser.rows);
    
    // Check all roles
    const roles = await pool.query('SELECT role_id, role_name FROM sec_roles ORDER BY role_name');
    console.log('Available roles:', roles.rows);
    
    // Check James's current roles
    if (jamesUser.rows.length > 0) {
      const jamesRoles = await pool.query('SELECT u.username, r.role_name FROM sec_users u JOIN sec_user_roles ur ON u.user_id = ur.user_id JOIN sec_roles r ON ur.role_id = r.role_id WHERE u.username = $1', ['james']);
      console.log('James current roles:', jamesRoles.rows);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

checkJames();