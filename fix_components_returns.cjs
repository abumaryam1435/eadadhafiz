const fs = require('fs');

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
    // Ensure we don't have multiple `if (!context) return null;`
    const matches = content.match(/if \(\!context\) return null;/g);
    if (matches && matches.length > 1) {
        // keep only the last one
        let firstIndex = content.indexOf('if (!context) return null;');
        content = content.substring(0, firstIndex) + content.substring(firstIndex).replace('if (!context) return null;', '');
        fs.writeFileSync(file, content, 'utf-8');
    }
}
