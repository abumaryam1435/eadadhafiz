import re

with open("components/EvaluationForm.tsx", "r") as f:
    content = f.read()

replacement = """          const p = evaluations.filter(e => e.studentId === selectedStudent! && e.subject === 'mutoon' && e.evaluationType === 'memorization' && e.surahs?.includes(mEval.matnName)).reduce((sum, e) => sum + (e.pages || 0), 0);
          let fromAyahVal: number | undefined = undefined;
          let toAyahVal: number | undefined = undefined;
          if (mEval.lines !== 'not_ready' && mEval.lines !== 'review' && mEval.lines !== '') {
              fromAyahVal = p + 1;
              toAyahVal = p + Number(mEval.lines);
          }

          addEvaluation({
            id: Date.now() + Math.random(),
            studentId: selectedStudent!,
            studentName: students.find(s => s.id === selectedStudent)?.name || '',
            subject: 'mutoon',
            weekNumber: selectedWeek,
            attendance: attendance!,
            absenceReason: absenceReason || null,
            evaluationType: mEval.lines === 'review' ? EvaluationType.REVIEW : EvaluationType.MEMORIZATION,
            pages: (mEval.lines === 'not_ready' || mEval.lines === 'review') ? 0 : Number(mEval.lines),
            fromAyah: fromAyahVal,
            toAyah: toAyahVal,
            surahs: [mEval.matnName],"""

content = re.sub(
    r"          addEvaluation\(\{\n            id: Date\.now\(\) \+ Math\.random\(\),\n            studentId: selectedStudent!,\n            studentName: students\.find\(s => s\.id === selectedStudent\)\?\.name \|\| '',\n            subject: 'mutoon',\n            weekNumber: selectedWeek,\n            attendance: attendance!,\n            absenceReason: absenceReason \|\| null,\n            evaluationType: mEval\.lines === 'review' \? EvaluationType\.REVIEW : EvaluationType\.MEMORIZATION,\n            pages: \(mEval\.lines === 'not_ready' \|\| mEval\.lines === 'review'\) \? 0 : Number\(mEval\.lines\),\n            surahs: \[mEval\.matnName\],",
    replacement,
    content
)

with open("components/EvaluationForm.tsx", "w") as f:
    f.write(content)
