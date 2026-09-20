const fs = require('fs');
let code = fs.readFileSync('components/EvaluationForm.tsx', 'utf-8');

// Update FormStep type
code = code.replace(
  "type FormStep = 'selectHalaqa' | 'selectWeek' | 'selectStudent' |",
  "type FormStep = 'selectHalaqa' | 'selectWeek' | 'selectSubject' | 'selectStudent' |"
);

// Add subject, linesCount, matns, lineRange state
code = code.replace(
  "const [selectedWeek, setSelectedWeek] = useState<number | null>(null);",
  "const [selectedWeek, setSelectedWeek] = useState<number | null>(null);\n  const [subject, setSubject] = useState<'quran' | 'mutoon'>('quran');\n  const [linesCount, setLinesCount] = useState<number | ''>('');\n  const [matns, setMatns] = useState<string[]>([]);\n  const [lineRange, setLineRange] = useState('');\n  const [matnSearch, setMatnSearch] = useState('');\n"
);

// Update selectWeek 'Next' button transition
code = code.replace(
  "setCurrentStep('selectStudent');",
  "setCurrentStep('selectSubject');"
);

// Update selectWeek back button if needed (no change)

fs.writeFileSync('components/EvaluationForm.tsx', code, 'utf-8');
console.log('Done Form Step & States');
