const bcrypt = require('bcryptjs');
const pool = require('./db');

async function resetAdminPassword() {
  const newPassword = 'admin123'; // Change this to your desired password
  
  try {
    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update admin user password
    const result = await pool.query(
      'UPDATE sec_users SET user_password = $1, edited_date = now() WHERE username = $2 RETURNING user_id, username',
      [hashedPassword, 'admin']
    );
    
    if (result.rows.length > 0) {
      console.log('✅ Admin password reset successfully!');
      console.log(`Username: admin`);
      console.log(`New Password: ${newPassword}`);
      console.log('\nYou can now login with these credentials.');
    } else {
      console.log('❌ Admin user not found');
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Error resetting password:', err);
    process.exit(1);
  }
}

resetAdminPassword();
