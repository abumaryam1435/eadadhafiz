const fs = require('fs');
let content = fs.readFileSync('components/ReportsTable.tsx', 'utf-8');

// Insert if (!context) return null; after all the hooks.
// We can insert it right before return (
content = content.replace(
  '  return (\n    <div className="bg-white',
  '  if (!context) return null;\n  return (\n    <div className="bg-white'
);

fs.writeFileSync('components/ReportsTable.tsx', content, 'utf-8');
