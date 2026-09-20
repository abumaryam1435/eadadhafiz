const fs = require('fs');
const code = fs.readFileSync('components/EvaluationEditForm.tsx', 'utf8');
const lines = code.split('\n');
let divStack = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  let m1 = line.match(/<div/g);
  let m2 = line.match(/<\/div/g);
  if (m1) {
    for (let j = 0; j < m1.length; j++) divStack.push(i + 1);
  }
  if (m2) {
    for (let j = 0; j < m2.length; j++) {
      if (divStack.length > 0) divStack.pop();
    }
  }
}
console.log("Unclosed divs at end:", divStack);
