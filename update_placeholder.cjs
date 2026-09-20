const fs = require('fs');
let code = fs.readFileSync('components/MutoonManager.tsx', 'utf-8');

code = code.replace('placeholder="مثال: 50"', 'placeholder="مثال: 77 بيتا"');

fs.writeFileSync('components/MutoonManager.tsx', code, 'utf-8');
console.log('Updated placeholder in MutoonManager.tsx');
