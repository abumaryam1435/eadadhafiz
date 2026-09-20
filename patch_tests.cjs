const fs = require('fs');
let content = fs.readFileSync('components/TestsReportTable.tsx', 'utf-8');

// Insert if (!context) return null; right before return (
content = content.replace(
  '  return (\n    <div className="bg-white',
  '  if (!context) return null;\n  return (\n    <div className="bg-white'
);

fs.writeFileSync('components/TestsReportTable.tsx', content, 'utf-8');
