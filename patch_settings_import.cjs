const fs = require('fs');
let content = fs.readFileSync('components/Settings.tsx', 'utf-8');

const targetContent = `              if (!halaqaName || !studentName) continue;
              let teacher = users.find(
                (u) => u.name === teacherName && u.role === UserRole.TEACHER,
              );
              if (!teacher && teacherName) addTeacher(teacherName);
              let halaqa = halaqas.find((h) => h.name === halaqaName);
              let targetHalaqaId: number;
              if (!halaqa) {
                const newHalaqaId =
                  Date.now() + Math.floor(Math.random() * 1000);
                addHalaqa({ name: halaqaName, teacherId: teacher?.id || 0 });
                targetHalaqaId = newHalaqaId;
              } else {
                targetHalaqaId = halaqa.id;
              }`;

const replacementContent = `              if (!halaqaName || !studentName) continue;
              let teacher = localUsers.find(
                (u) => u.name === teacherName && u.role === UserRole.TEACHER,
              );
              let teacherId = teacher?.id || 0;
              if (!teacher && teacherName) {
                teacherId = addTeacher(teacherName) as number;
                localUsers.push({ id: teacherId, name: teacherName, role: UserRole.TEACHER } as any);
              }
              let halaqa = localHalaqas.find((h) => h.name === halaqaName);
              let targetHalaqaId: number;
              if (!halaqa) {
                targetHalaqaId = addHalaqa({ name: halaqaName, teacherId }) as number;
                localHalaqas.push({ id: targetHalaqaId, name: halaqaName, teacherId } as any);
              } else {
                targetHalaqaId = halaqa.id;
              }`;

content = content.replace(targetContent, replacementContent);
content = content.replace('let addedCount = 0;', 'let addedCount = 0;\n            const localUsers = [...users];\n            const localHalaqas = [...halaqas];');

fs.writeFileSync('components/Settings.tsx', content, 'utf-8');
