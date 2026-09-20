const fs = require('fs');

let form = fs.readFileSync('components/EvaluationForm.tsx', 'utf-8');
form = form.replace(
  "{subject === 'mutoon' ? 'من البيت كذا إلى كذا (مثلاً 1-10)' : 'الآيات (مثلاً 1-10)'}",
  "{subject === 'mutoon' ? 'اسم المتن والأبيات' : 'الآيات (مثلاً 1-10)'}"
);
fs.writeFileSync('components/EvaluationForm.tsx', form, 'utf-8');

let editForm = fs.readFileSync('components/EvaluationEditForm.tsx', 'utf-8');
editForm = editForm.replace(
  "{initialEvaluation.subject === 'mutoon' ? 'الأبيات' : 'الآيات'}",
  "{initialEvaluation.subject === 'mutoon' ? 'اسم المتن والأبيات' : 'الآيات'}"
);
fs.writeFileSync('components/EvaluationEditForm.tsx', editForm, 'utf-8');

console.log('Updated labels');
