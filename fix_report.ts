import * as fs from 'fs';

const content = fs.readFileSync('components/TestsReportTable.tsx', 'utf8');

const regex = /interface SummaryRow \{[\s\S]*?^  };\n/m;
const match = regex.exec(content);

if (match) {
    let matrixCode = match[0];
    
    // remove from original location
    let newContent = content.replace(matrixCode, '');
    
    // modify matrix code to include students, halaqas, users, hijriAdjustments in props
    matrixCode = matrixCode.replace(/isCloudSynced: boolean;\n    handleSync: \(\) => void;\n  }> = \(\{/, 
        `isCloudSynced: boolean;
    handleSync: () => void;
    students: any[];
    halaqas: any[];
    users: any[];
    hijriAdjustments?: number;
  }> = ({`);
    
    matrixCode = matrixCode.replace(/handleSync \} \)/, `handleSync, students, halaqas, users, hijriAdjustments })`);

    matrixCode = matrixCode.replace(/isCloudSynced, handleSync \}\) => \{/, `isCloudSynced, handleSync, students, halaqas, users, hijriAdjustments }) => {`);

    // convert the <select> to custom dropdown
    const selectRegex = /<div className="flex items-center gap-2 justify-end">[\s\S]*?<\/div>\s*\)\s*:\s*isQuickEdit/m;
    
    matrixCode = matrixCode.replace(/const \[isQuickEdit, setIsQuickEdit\] = useState\(false\);/, 
        `const [isQuickEdit, setIsQuickEdit] = useState(false);
    const [openRankDropdownRowId, setOpenRankDropdownRowId] = useState<string | null>(null);`
    );

    const newTdContent = `<div className="flex items-center gap-2 justify-end">
    <span className="truncate">{row[h.key]}</span>
    <div className="relative inline-block text-right">
        <button
            onClick={() => setOpenRankDropdownRowId(openRankDropdownRowId === String(row.id) ? null : String(row.id))}
            className="text-[10px] py-1 px-2 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 outline-none flex items-center justify-between gap-1 w-[4.5rem] cursor-pointer hover:border-indigo-400 no-print transition-all font-bold"
        >
            <span>
                {manualRanks[String(row.id)] === 1 ? '١' : 
                 manualRanks[String(row.id)] === 2 ? '٢' : 
                 manualRanks[String(row.id)] === 3 ? '٣' : 
                 manualRanks[String(row.id)] === 0 ? 'بدون' : 
                 manualRanks[String(row.id)] === -1 ? 'إخفاء' : 'تلقائي'}
            </span>
            <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
        </button>
        {openRankDropdownRowId === String(row.id) && (
            <div className="absolute z-[70] mt-1 w-24 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-100 dark:border-gray-700 top-full left-0 overflow-hidden">
                {[
                    { val: '', label: 'تلقائي' },
                    { val: '1', label: '١' },
                    { val: '2', label: '٢' },
                    { val: '3', label: '٣' },
                    { val: '0', label: 'بدون' },
                    { val: '-1', label: 'إخفاء' }
                ].map(opt => (
                    <button
                        key={opt.val}
                        className="w-full text-right px-3 py-2 text-[10px] sm:text-xs font-bold hover:bg-indigo-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-colors"
                        onClick={() => {
                            const val = opt.val;
                            setManualRanks(prev => {
                                const next = {...prev};
                                if (val === '') {
                                    delete next[String(row.id)];
                                } else {
                                    next[String(row.id)] = parseInt(val);
                                }
                                return next;
                            });
                            setOpenRankDropdownRowId(null);
                        }}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>
        )}
    </div>
</div>
                                                ) : isQuickEdit`;
    matrixCode = matrixCode.replace(selectRegex, newTdContent);

    // Insert matrixCode back above export const TestsReportTable
    newContent = newContent.replace('export const TestsReportTable: React.FC = () => {', matrixCode + '\n\nexport const TestsReportTable: React.FC = () => {');
    
    // Add hijriAdjustments to the Component Call
    newContent = newContent.replace(/handleSync=\{handleSync\}\n\s*students=\{students\}\n\s*halaqas=\{halaqas\}\n\s*users=\{users\}\n\s*\/>/m, 
        `handleSync={handleSync}\n          students={students}\n          halaqas={halaqas}\n          users={users}\n          hijriAdjustments={hijriAdjustments}\n        />`);

    fs.writeFileSync('components/TestsReportTable.tsx', newContent);
    console.log("Migration done");
} else {
    console.log("Regex not matched");
}
