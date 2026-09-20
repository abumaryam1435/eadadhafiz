const fs = require('fs');
const content = fs.readFileSync('components/SupervisorSuggestionsView.tsx', 'utf-8');

let braceCount = 0;
let parenthesisCount = 0;
let bracketCount = 0;

for (let i = 0; i < content.length; i++) {
  const c = content[i];
  if (c === '{') braceCount++;
  if (c === '}') braceCount--;
  if (c === '(') parenthesisCount++;
  if (c === ')') parenthesisCount--;
  if (c === '[') bracketCount++;
  if (c === ']') bracketCount--;
}

console.log('Brace count:', braceCount);
console.log('Parenthesis count:', parenthesisCount);
console.log('Bracket count:', bracketCount);
