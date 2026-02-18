const fs = require('fs');

// Read the file
const filePath = 'frontend/src/PurchaseReturnForm.js';
let content = fs.readFileSync(filePath, 'utf8');

// Replace all instances of isEditMode with effectiveEditMode (except the declaration)
content = content.replace(
  /disabled={header\.IsPosted \|\| \(isEditMode && !canEdit\('INVENTORY', 'PURCHASE_RETURN'\)\) \|\| \(!isEditMode && !canCreate\('INVENTORY', 'PURCHASE_RETURN'\)\)}/g,
  "disabled={header.IsPosted || (effectiveEditMode && !canEdit('INVENTORY', 'PURCHASE_RETURN')) || (!effectiveEditMode && !canCreate('INVENTORY', 'PURCHASE_RETURN'))}"
);

content = content.replace(
  /!header\.IsPosted && \(\(isEditMode && canEdit\('INVENTORY', 'PURCHASE_RETURN'\)\) \|\| \(!isEditMode && canCreate\('INVENTORY', 'PURCHASE_RETURN'\)\)\)/g,
  "!header.IsPosted && ((effectiveEditMode && canEdit('INVENTORY', 'PURCHASE_RETURN')) || (!effectiveEditMode && canCreate('INVENTORY', 'PURCHASE_RETURN')))"
);

content = content.replace(
  /\(\(isEditMode && canEdit\('INVENTORY', 'PURCHASE_RETURN'\)\) \|\| \(!isEditMode && canCreate\('INVENTORY', 'PURCHASE_RETURN'\)\)\)/g,
  "((effectiveEditMode && canEdit('INVENTORY', 'PURCHASE_RETURN')) || (!effectiveEditMode && canCreate('INVENTORY', 'PURCHASE_RETURN')))"
);

// Write the file back
fs.writeFileSync(filePath, content, 'utf8');

console.log('✅ Updated all isEditMode references to effectiveEditMode in PurchaseReturnForm.js');
console.log('🎯 The Confirm button should now appear after saving a new purchase return!');