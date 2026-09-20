const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf-8');

const oldCheck = `  const initiateLogoutCheck = () => {
    if (currentUser?.role === UserRole.TEACHER && lastUsedWeek && !isTestActiveState) {
      const teacherHalaqaIds = data.halaqas.filter(h => h.teacherId === currentUser.id).map(h => h.id);
      const teacherStudents = data.students.filter(s => teacherHalaqaIds.includes(s.halaqaId));
      const evaluatedStudentIds = new Set(data.evaluations.filter(e => e.weekNumber === lastUsedWeek).map(e => e.studentId));
      const unevaluated = teacherStudents.filter(s => !evaluatedStudentIds.has(s.id));
      if (unevaluated.length > 0) { setUnevaluatedStudentNames(unevaluated.map(s => s.name)); setUnevaluatedStudentsModalOpen(true); } else handleLogout();
    } else handleLogout();
  };`;

const newCheck = `  const initiateLogoutCheck = () => {
    if (currentUser?.role === UserRole.TEACHER && lastUsedWeek && !isTestActiveState) {
      const teacherHalaqaIds = data.halaqas.filter(h => h.teacherId === currentUser.id).map(h => h.id);
      const teacherStudents = data.students.filter(s => teacherHalaqaIds.includes(s.halaqaId));
      
      const quranEvaluatedIds = new Set(data.evaluations.filter(e => e.weekNumber === lastUsedWeek && e.subject !== 'mutoon').map(e => e.studentId));
      const mutoonEvaluatedIds = new Set(data.evaluations.filter(e => e.weekNumber === lastUsedWeek && e.subject === 'mutoon').map(e => e.studentId));
      
      const unevaluated = teacherStudents.filter(s => {
          const missingQuran = !quranEvaluatedIds.has(s.id);
          const missingMutoon = s.isAlAmeen ? !mutoonEvaluatedIds.has(s.id) : false;
          return missingQuran || missingMutoon;
      });
      
      if (unevaluated.length > 0) { 
          const namesWithReason = unevaluated.map(s => {
              const missingQuran = !quranEvaluatedIds.has(s.id);
              const missingMutoon = s.isAlAmeen ? !mutoonEvaluatedIds.has(s.id) : false;
              let suffix = '';
              if (missingQuran && missingMutoon) suffix = ' (قرآن ومتون)';
              else if (missingQuran) suffix = ' (قرآن)';
              else if (missingMutoon) suffix = ' (متون)';
              return s.name + suffix;
          });
          setUnevaluatedStudentNames(namesWithReason); 
          setUnevaluatedStudentsModalOpen(true); 
      } else {
          handleLogout();
      }
    } else handleLogout();
  };`;

code = code.replace(oldCheck, newCheck);
fs.writeFileSync('App.tsx', code, 'utf-8');
console.log('Updated logout check');
