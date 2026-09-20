const fs = require('fs');
let content = fs.readFileSync('components/EvaluationEditForm.tsx', 'utf-8');

content = content.replace(
  '    toVerse: number | string;\n  } | null>(null);',
  '    toVerse: number | string;\n    prevFromVerse?: number;\n    prevToVerse?: number;\n  } | null>(null);'
);

content = content.replace(
  '                                                        const p = (context?.evaluations || []).filter(ev => ev.studentId === student.id && ev.subject === \'mutoon\' && ev.evaluationType === \'memorization\' && ev.id !== initialEvaluation.id && ev.surahs?.includes(selectedSurahs[0])).reduce((sum, ev) => sum + (ev.pages || 0), 0);\n                                                        setViewingVersesModal({\n                                                            isOpen: true,\n                                                            matnName: selectedSurahs[0],\n                                                            fromVerse: p + 1,\n                                                            toVerse: p + Number(pages),\n                                                        });',
  `                                                        const pastEvals = (context?.evaluations || []).filter(ev => ev.studentId === student.id && ev.subject === 'mutoon' && ev.evaluationType === 'memorization' && ev.id !== initialEvaluation.id && ev.surahs?.includes(selectedSurahs[0]));
                                                        pastEvals.sort((a, b) => b.weekNumber - a.weekNumber);
                                                        const p = pastEvals.reduce((sum, ev) => sum + (ev.pages || 0), 0);
                                                        let prevFrom, prevTo;
                                                        if (pastEvals.length > 0 && pastEvals[0].pages) {
                                                            prevTo = p;
                                                            prevFrom = p - pastEvals[0].pages + 1;
                                                        }
                                                        setViewingVersesModal({
                                                            isOpen: true,
                                                            matnName: selectedSurahs[0],
                                                            fromVerse: p + 1,
                                                            toVerse: p + Number(pages),
                                                            prevFromVerse: prevFrom,
                                                            prevToVerse: prevTo
                                                        });`
);

content = content.replace(
  '          toVerse={viewingVersesModal.toVerse}\n          matns={matns}\n        />',
  '          toVerse={viewingVersesModal.toVerse}\n          matns={matns}\n          prevFromVerse={viewingVersesModal.prevFromVerse}\n          prevToVerse={viewingVersesModal.prevToVerse}\n        />'
);

fs.writeFileSync('components/EvaluationEditForm.tsx', content, 'utf-8');
