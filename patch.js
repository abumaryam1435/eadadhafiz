const fs = require('fs');
let code = fs.readFileSync('components/EvaluationForm.tsx', 'utf8');

code = code.replace(/onDelete=\{\(\) \=\> \{\s*deleteEvaluation\(currentEval\.id\);\s*onFormSubmit\('delete'\);\s*setUiMode\('new'\);\s*setSelectedStudent\(null\);\s*lastCheckedRef\.current = "";\s*setSurahSearch\(''\);\s*setPrimarySearch\(''\);\s*setGuestSearch\(''\);\s*\}\}/, 
`onDelete={() => { 
            if (subject === 'mutoon') {
               const allMutoonForWeek = evaluations.filter(e => e.studentId === activeStudent?.id && e.subject === 'mutoon' && e.weekNumber === selectedWeek);
               allMutoonForWeek.forEach(e => deleteEvaluation(e.id));
            } else {
               deleteEvaluation(currentEval.id); 
            }
            onFormSubmit('delete'); 
            setUiMode('new'); 
            setSelectedStudent(null); 
            lastCheckedRef.current = "";
            setSurahSearch('');
            setPrimarySearch('');
            setGuestSearch('');
          }}`);

code = code.replace(/onDelete=\{\(\) \=\> \{\s*deleteEvaluation\(currentEval\.id\);\s*onFormSubmit\('delete'\);\s*setSelectedStudent\(null\);\s*lastCheckedRef\.current = "";\s*setSurahSearch\(''\);\s*setPrimarySearch\(''\);\s*setGuestSearch\(''\);\s*\}\}/,
`onDelete={() => { 
            if (subject === 'mutoon') {
               const allMutoonForWeek = evaluations.filter(e => e.studentId === activeStudent?.id && e.subject === 'mutoon' && e.weekNumber === selectedWeek);
               allMutoonForWeek.forEach(e => deleteEvaluation(e.id));
            } else {
               deleteEvaluation(currentEval.id); 
            }
            onFormSubmit('delete'); 
            setUiMode('new');
            setSelectedStudent(null); 
            lastCheckedRef.current = "";
            setSurahSearch('');
            setPrimarySearch('');
            setGuestSearch('');
          }}`);

fs.writeFileSync('components/EvaluationForm.tsx', code);
