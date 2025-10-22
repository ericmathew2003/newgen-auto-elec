const bcrypt = require('bcryptjs');

async function hashPassword() {
  const password = 'Veliamthod@123'; // or any secure password
  const hashed = await bcrypt.hash(password, 10);
  console.log('Hashed password:', hashed);
}

hashPassword();