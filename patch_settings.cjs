const fs = require('fs');
let content = fs.readFileSync('components/Settings.tsx', 'utf-8');

content = content.replace(
  'const addTeacher = context?.addTeacher || (async () => {});',
  'const addTeacher = context?.addTeacher || ((n: string) => 0);'
);
content = content.replace(
  'const addHalaqa = context?.addHalaqa || (async () => {});',
  'const addHalaqa = context?.addHalaqa || ((h: any) => 0);'
);
content = content.replace(
  'const addStudent = context?.addStudent || (async () => {});',
  'const addStudent = context?.addStudent || ((s: any) => 0);'
);

fs.writeFileSync('components/Settings.tsx', content, 'utf-8');
