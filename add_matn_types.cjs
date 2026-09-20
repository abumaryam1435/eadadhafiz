const fs = require('fs');
let code = fs.readFileSync('types.ts', 'utf-8');

const matnType = `export interface Matn {
  id: number;
  name: string;
  linesCount: number;
  updatedAt?: number;
}

`;

code = code.replace(
  'export interface FullBackupData {',
  matnType + 'export interface FullBackupData {'
);

code = code.replace(
  'studentBehaviors?: StudentBehavior[];',
  'studentBehaviors?: StudentBehavior[];\n  matns?: Matn[];'
);

fs.writeFileSync('types.ts', code, 'utf-8');
console.log('Added Matn type');
