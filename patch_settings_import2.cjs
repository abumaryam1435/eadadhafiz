const fs = require('fs');
let content = fs.readFileSync('components/Settings.tsx', 'utf-8');

// Also fix the context default function
content = content.replace(
  'const addSardHalaqa = context?.addSardHalaqa || (async () => {});',
  'const addSardHalaqa = context?.addSardHalaqa || ((h: any) => 0);'
);


const targetContent = `          const newTeacherId = Date.now() + Math.floor(Math.random() * 1000);
          addTeacher(tName);
          teacherNameToId.set(tKey, newTeacherId);
          teacherId = newTeacherId;
          importedTeachersCount++;`;

const replacementContent = `          const newTeacherId = addTeacher(tName) as number;
          teacherNameToId.set(tKey, newTeacherId);
          teacherId = newTeacherId;
          importedTeachersCount++;`;

const targetContent2 = `          const newHalaqaId = Date.now() + Math.floor(Math.random() * 1000);
          if (isSard) {
            addSardHalaqa({ name: hName, teacherId: teacherId || 0 });
          } else {
            addHalaqa({ name: hName, teacherId: teacherId || 0 });
          }
          halaqaNameToId.set(hKey, newHalaqaId);
          targetHalaqaId = newHalaqaId;
          importedHalaqasCount++;`;

const replacementContent2 = `          const newHalaqaId = (isSard ? addSardHalaqa({ name: hName, teacherId: teacherId || 0 }) : addHalaqa({ name: hName, teacherId: teacherId || 0 })) as number;
          halaqaNameToId.set(hKey, newHalaqaId);
          targetHalaqaId = newHalaqaId;
          importedHalaqasCount++;`;

content = content.replace(targetContent, replacementContent);
content = content.replace(targetContent2, replacementContent2);

fs.writeFileSync('components/Settings.tsx', content, 'utf-8');
