import fs from 'fs';
let content = fs.readFileSync('components/MushafReaderModal.tsx', 'utf8');

const targetTotalErrors = `  // Live error calculation
  const totalErrors = useMemo(() => {
    if (isSardMode) {
      return calculateSardTotalErrors(evalFath, evalTashkeel, evalTajweed);
    }
    return Number(((evalFath || 0) + (evalTashkeel || 0) + ((evalTajweed || 0) * 0.5)).toFixed(1));
  }, [evalFath, evalTashkeel, evalTajweed, isSardMode]);`;

const replaceTotalErrors = `  // Live error calculation
  const currentEvalFath = sardGroupMode && selectedGroupStudentId ? (sardGroupErrors[selectedGroupStudentId]?.fath || 0) : (evalFath || 0);
  const currentEvalTashkeel = sardGroupMode && selectedGroupStudentId ? (sardGroupErrors[selectedGroupStudentId]?.tashkeel || 0) : (evalTashkeel || 0);
  const currentEvalTajweed = sardGroupMode && selectedGroupStudentId ? (sardGroupErrors[selectedGroupStudentId]?.tajweed || 0) : (evalTajweed || 0);

  const totalErrors = useMemo(() => {
    if (isSardMode) {
      return calculateSardTotalErrors(currentEvalFath, currentEvalTashkeel, currentEvalTajweed);
    }
    return Number((currentEvalFath + currentEvalTashkeel + (currentEvalTajweed * 0.5)).toFixed(1));
  }, [currentEvalFath, currentEvalTashkeel, currentEvalTajweed, isSardMode]);`;

content = content.replace(targetTotalErrors, replaceTotalErrors);

const targetTestMode = `                <span className={\`text-sm sm:text-base font-black \${Math.max(0, testScore - (evalFath * testDeductions.fath + evalTashkeel * testDeductions.tashkeel + evalTajweed * testDeductions.tajweed)) < testScore * 0.5 ? 'text-red-400' : 'text-emerald-400'}\`}>
                  {Math.max(0, testScore - (evalFath * testDeductions.fath + evalTashkeel * testDeductions.tashkeel + evalTajweed * testDeductions.tajweed))}
                </span>`;

const replaceTestMode = `                <span className={\`text-sm sm:text-base font-black \${Math.max(0, testScore - (currentEvalFath * testDeductions.fath + currentEvalTashkeel * testDeductions.tashkeel + currentEvalTajweed * testDeductions.tajweed)) < testScore * 0.5 ? 'text-red-400' : 'text-emerald-400'}\`}>
                  {Math.max(0, testScore - (currentEvalFath * testDeductions.fath + currentEvalTashkeel * testDeductions.tashkeel + currentEvalTajweed * testDeductions.tajweed))}
                </span>`;
content = content.replace(targetTestMode, replaceTestMode);

fs.writeFileSync('components/MushafReaderModal.tsx', content);
