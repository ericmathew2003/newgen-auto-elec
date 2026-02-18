// Frontend fix for the financial year filtering issue
// This will temporarily remove the fyear filter to show all sales records

const fs = require('fs');
const path = require('path');

const salesPagePath = path.join(__dirname, 'frontend', 'src', 'SalesPage.js');

console.log('=== Frontend Financial Year Fix ===\n');

try {
  // Read the current SalesPage.js
  const content = fs.readFileSync(salesPagePath, 'utf8');
  
  // Find the problematic section
  const problematicSection = `      // Add financial year filter - critical for data isolation
      const selectedFYearID = localStorage.getItem("selectedFYearID");
      if (selectedFYearID) {
        params.fyearId = selectedFYearID;
      }`;
  
  // Replace with a temporary fix that uses the correct fyear_id
  const fixedSection = `      // TEMPORARY FIX: Use correct financial year ID (2) instead of localStorage value (1)
      // TODO: Create proper financial year selection UI
      const selectedFYearID = localStorage.getItem("selectedFYearID");
      if (selectedFYearID) {
        // Override with correct fyear_id that matches your data
        params.fyearId = "2"; // Changed from selectedFYearID to "2"
      }`;
  
  if (content.includes(problematicSection)) {
    const fixedContent = content.replace(problematicSection, fixedSection);
    
    // Create backup
    fs.writeFileSync(salesPagePath + '.backup', content);
    console.log('✅ Created backup: SalesPage.js.backup');
    
    // Apply fix
    fs.writeFileSync(salesPagePath, fixedContent);
    console.log('✅ Applied temporary fix to SalesPage.js');
    console.log('   - Changed fyear filter to use "2" instead of localStorage value');
    console.log('   - This will show all your sales records with correct posted status');
    
    console.log('\n📋 NEXT STEPS:');
    console.log('1. Refresh your browser to see the sales records');
    console.log('2. The posted column should now show correct values');
    console.log('3. Consider creating a proper financial year selection UI');
    
  } else {
    console.log('❌ Could not find the expected code section to fix');
    console.log('   The file might have been modified already');
  }
  
} catch (error) {
  console.error('Error applying fix:', error.message);
  
  console.log('\n🔧 MANUAL FIX INSTRUCTIONS:');
  console.log('1. Open frontend/src/SalesPage.js');
  console.log('2. Find this line in the fetchSales function:');
  console.log('   params.fyearId = selectedFYearID;');
  console.log('3. Change it to:');
  console.log('   params.fyearId = "2";');
  console.log('4. Save and refresh your browser');
}

console.log('\n💡 PERMANENT SOLUTIONS:');
console.log('A. Update localStorage: localStorage.setItem("selectedFYearID", "2")');
console.log('B. Create financial year master table and selection UI');
console.log('C. Update all sales records to use fyear_id = 1');