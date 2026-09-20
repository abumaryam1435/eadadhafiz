const fs = require('fs');
const cp = require('child_process');

const files = [
    'components/MaghribDashboard.tsx',
    'components/SupervisorChoiceScreen.tsx',
    'components/MaghribProgramForm.tsx',
    'components/LoginScreen.tsx',
    'components/MaghribReportTable.tsx',
    'components/HelpModal.tsx',
    'components/StudentProgressInfo.tsx'
];

for (const file of files) {
    if (!fs.existsSync(file)) continue;
    let content = fs.readFileSync(file, 'utf-8');
    content = content.replace(/  if \(!context\) return null;\n/g, '');
    
    // Add it before the main return
    if (content.includes('return (')) {
        content = content.replace(/  return \(\n/g, '  if (!context) return null;\n  return (\n');
    } else {
        content = content.replace(/  return </g, '  if (!context) return null;\n  return <');
    }
    
    fs.writeFileSync(file, content, 'utf-8');
}
