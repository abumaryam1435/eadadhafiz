const fs = require('fs');
let code = fs.readFileSync('components/ReportsTable.tsx', 'utf8');

code = code.replace(/\{ key: 'surahs', label: subjectFilter === 'mutoon' \? 'المتون' : 'السور', type: 'array' \},/,
"{ key: 'surahs', label: subjectFilter === 'mutoon' ? 'المتن' : 'السور', type: 'array' },");

code = code.replace(/\{ key: 'evalFathErrors', label: 'أخطاء الفتح' \},/,
"{ key: 'evalFathErrors', label: subjectFilter === 'mutoon' ? 'الأخطاء' : 'أخطاء الفتح' },");

code = code.replace(/const defaultExcludedKeys = useMemo\(\(\) => \[/,
`const defaultExcludedKeys = useMemo(() => {
    if (subjectFilter === 'mutoon') {
      return [
        'evaluatorName', 
        'evaluationDate', 
        'studentOriginalHalaqaName',
        'ayahRangeDisplay',
        'periodicReview',
        'oldMemorizedPagesStr',
        'newMemorizedPagesStr',
        'totalMemorizedPagesCount',
        'evalMemorizedPages',
        'evalTashkeelErrors',
        'evalTajweedErrors',
        'evalTotalErrors',
        'studentLevel'
      ];
    }
    return [`);

code = code.replace(/  \], \[\]\);/,
`  ]}, [subjectFilter]);`);

fs.writeFileSync('components/ReportsTable.tsx', code);
