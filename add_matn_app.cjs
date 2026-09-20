const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf-8');

// AppContext context type
code = code.replace(
  'studentBehaviors: StudentBehavior[];',
  'studentBehaviors: StudentBehavior[];\n  matns: Matn[];\n  addMatn: (matn: Omit<Matn, "id" | "updatedAt">) => void;\n  updateMatn: (matn: Matn) => void;\n  deleteMatn: (id: number) => void;'
);

// App state
code = code.replace(
  'studentBehaviors: StudentBehavior[];\n  }>',
  'studentBehaviors: StudentBehavior[];\n    matns: Matn[];\n  }>'
);
code = code.replace(
  'studentBehaviors: [] });',
  'studentBehaviors: [], matns: [] });'
);

// Initialization
code = code.replace(
  'studentBehaviors: loadedConfig.studentBehaviors || [],',
  'studentBehaviors: loadedConfig.studentBehaviors || [],\n        matns: loadedConfig.matns || [],'
);

// Local storage backup
code = code.replace(
  'suggestions: data.suggestions, studentBehaviors: data.studentBehaviors,',
  'suggestions: data.suggestions, studentBehaviors: data.studentBehaviors, matns: data.matns,'
);

// Firebase sync
code = code.replace(
  "syncTable('studentBehaviors', 'data/studentBehaviors');",
  "syncTable('studentBehaviors', 'data/studentBehaviors');\n        syncTable('matns', 'data/matns');"
);
code = code.replace(
  "db.ref('data/studentBehaviors').off();",
  "db.ref('data/studentBehaviors').off();\n            db.ref('data/matns').off();"
);

// Methods
code = code.replace(
  "const addStudentBehavior = (s: any) => {",
  `const addMatn = (m: any) => {
    const id = generateId();
    writeData(\`data/matns/\${id}\`, { ...m, id, updatedAt: id });
  };
  const updateMatn = (m: any) => writeData(\`data/matns/\${m.id}\`, { ...m, updatedAt: Date.now() });
  const deleteMatn = (id: number) => writeData(\`data/matns/\${id}\`, null);

  const addStudentBehavior = (s: any) => {`
);

// Context Provider
code = code.replace(
  "suggestions: data.suggestions, studentBehaviors: data.studentBehaviors,",
  "suggestions: data.suggestions, studentBehaviors: data.studentBehaviors, matns: data.matns,"
);
code = code.replace(
  "addSuggestion, updateSuggestion, deleteSuggestion,",
  "addSuggestion, updateSuggestion, deleteSuggestion, addMatn, updateMatn, deleteMatn,"
);


// We also need to add Matn to types.ts but we did that already. Let's make sure it's exported in App.tsx
if (!code.includes('import {') || !code.includes('Matn')) {
    code = code.replace(
        "import { Evaluation, Student, Halaqa, User, UserRole, AttendanceStatus, PerformanceLevel, MaghribAttendance, Suggestion, StudentBehavior, FullBackupData, PeriodicReviewStatus, EvaluationType } from './types';",
        "import { Evaluation, Student, Halaqa, User, UserRole, AttendanceStatus, PerformanceLevel, MaghribAttendance, Suggestion, StudentBehavior, FullBackupData, PeriodicReviewStatus, EvaluationType, Matn } from './types';"
    );
}


fs.writeFileSync('App.tsx', code, 'utf-8');
console.log('Added Matn to App.tsx');
