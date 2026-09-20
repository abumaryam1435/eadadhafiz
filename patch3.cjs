const fs = require('fs');
let code = fs.readFileSync('components/EvaluationForm.tsx', 'utf8');

code = code.replace(/<span className="text-xl">\+<\/span> إضافة متن آخر/,
'<span className="text-xl">+</span> تقييم المتن التالي');

fs.writeFileSync('components/EvaluationForm.tsx', code);
