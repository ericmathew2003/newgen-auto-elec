
const fs = require('fs');
const path = require('path');

const salesPagePath = path.join(__dirname, 'frontend', 'src', 'SalesPage.js');
const backupPath = salesPagePath + '.checkbox-backup';

try {
  if (fs.existsSync(backupPath)) {
    const backupContent = fs.readFileSync(backupPath, 'utf8');
    fs.writeFileSync(salesPagePath, backupContent);
    console.log('✅ Restored original checkbox from backup');
    fs.unlinkSync(backupPath);
    console.log('✅ Removed backup file');
  } else {
    console.log('❌ No backup file found');
  }
} catch (error) {
  console.error('Error restoring:', error.message);
}
