const fs = require('fs');

const files = ['components/ReportsTable.tsx', 'components/OverviewTable.tsx', 'components/TestsReportTable.tsx'];

for (const file of files) {
    let content = fs.readFileSync(file, 'utf-8');
    content = content.replace(
      '  if (!context) return null;\n  return (\n    <div className="bg-white',
      '  return (\n    <div className="bg-white'
    );
    fs.writeFileSync(file, content, 'utf-8');
}
