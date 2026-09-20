const fs = require('fs');
let code = fs.readFileSync('components/MushafReaderModal.tsx', 'utf8');

const targetStr = `                            {isNew && <span className="text-[9px] bg-green-500/20 text-green-400 px-1.5 rounded-sm">جديد</span>}
                            {isPrev && <span className="text-[9px] bg-amber-900/50 text-amber-500 px-1.5 rounded-sm">قديم</span>}`;

const replaceStr = `                            {isNew && <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-sm">حفظ جديد</span>}
                            {isPrev && <span className="text-[9px] bg-amber-900/50 text-amber-400 px-1.5 py-0.5 rounded-sm">حفظ قديم</span>}`;

if (code.includes(targetStr)) {
    code = code.replace(targetStr, replaceStr);
    fs.writeFileSync('components/MushafReaderModal.tsx', code);
    console.log("Patched dropdown labels 2.");
} else {
    console.log("Could not find target string to replace.");
}
