const fs = require('fs');
let code = fs.readFileSync('utils/exportSheetTemplate.ts', 'utf8');
code = code.replace(/\\\$\\{fileName\\}/g, '${fileName}');
code = code.replace(/\\\`/g, '`');
fs.writeFileSync('utils/exportSheetTemplate.ts', code);
