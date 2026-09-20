const fs = require('fs');

function patchFile(filename) {
    if (!fs.existsSync(filename)) return;
    let content = fs.readFileSync(filename, 'utf-8');

    // Context fixes
    content = content.replace(
      'const addTeacher = context?.addTeacher || (async () => {});',
      'const addTeacher = context?.addTeacher || ((n: string) => 0);'
    );
    content = content.replace(
      'const addHalaqa = context?.addHalaqa || (async () => {});',
      'const addHalaqa = context?.addHalaqa || ((h: any) => 0);'
    );
    content = content.replace(
      'const addSardHalaqa = context?.addSardHalaqa || (async () => {});',
      'const addSardHalaqa = context?.addSardHalaqa || ((h: any) => 0);'
    );

    // Teacher fix
    const targetTeacher = `                    const newTeacherId = Date.now() + Math.floor(Math.random() * 1000);
                    addTeacher(tName);
                    teacherNameToId.set(tKey, newTeacherId);
                    teacherId = newTeacherId;`;
    const replaceTeacher = `                    const newTeacherId = addTeacher(tName) as number;
                    teacherNameToId.set(tKey, newTeacherId);
                    teacherId = newTeacherId;`;
    
    // Halaqa fix
    const targetHalaqa = `                    const newHalaqaId = Date.now() + Math.floor(Math.random() * 1000);
                    addHalaqa({ name: hName, teacherId: teacherId || 0 });
                    halaqaNameToId.set(hKey, newHalaqaId);
                    targetHalaqaId = newHalaqaId;`;
    const replaceHalaqa = `                    const newHalaqaId = addHalaqa({ name: hName, teacherId: teacherId || 0 }) as number;
                    halaqaNameToId.set(hKey, newHalaqaId);
                    targetHalaqaId = newHalaqaId;`;

    // SardHalaqa fix
    const targetSardHalaqa = `                    const newHalaqaId = Date.now() + Math.floor(Math.random() * 1000);
                    addSardHalaqa({ name: hName, teacherId: teacherId || 0 });
                    halaqaNameToId.set(hKey, newHalaqaId);
                    targetHalaqaId = newHalaqaId;`;
    const replaceSardHalaqa = `                    const newHalaqaId = addSardHalaqa({ name: hName, teacherId: teacherId || 0 }) as number;
                    halaqaNameToId.set(hKey, newHalaqaId);
                    targetHalaqaId = newHalaqaId;`;

    content = content.replace(targetTeacher, replaceTeacher);
    content = content.replace(targetHalaqa, replaceHalaqa);
    content = content.replace(targetSardHalaqa, replaceSardHalaqa);

    fs.writeFileSync(filename, content, 'utf-8');
}

patchFile('components/StudentManagement.tsx');
patchFile('components/SardManagement.tsx');
