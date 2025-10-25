// Build script for Vercel deployment
const { execSync } = require('child_process');

console.log('Building React app...');
execSync('npm run build', { stdio: 'inherit' });
console.log('Build completed successfully!');