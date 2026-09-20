import re

with open("components/EvaluationEditForm.tsx", "r") as f:
    content = f.read()

replacement = """    const range = ayahRange.split('-').map(n => n.trim());
    let finalFromAyah: any = range[0] || null;
    let finalToAyah: any = range[1] || range[0] || null;

    if (initialEvaluation.subject === 'mutoon' && (attendance === AttendanceStatus.PRESENT || attendance === AttendanceStatus.LATE)) {
        if (pages !== 'review' && pages !== 'not_ready' && pages !== '') {
            const p = (context?.evaluations || []).filter(ev => ev.studentId === student.id && ev.subject === 'mutoon' && ev.evaluationType === 'memorization' && ev.id !== initialEvaluation.id && ev.surahs?.includes(selectedSurahs[0])).reduce((sum, ev) => sum + (ev.pages || 0), 0);
            finalFromAyah = p + 1;
            finalToAyah = p + Number(pages);
        } else {
            finalFromAyah = null;
            finalToAyah = null;
        }
    }

    const updated: any = {
      ...initialEvaluation,
      attendance,
      absenceReason: attendance === AttendanceStatus.ABSENT ? absenceReason : null,
      evaluationType: (attendance === AttendanceStatus.PRESENT || attendance === AttendanceStatus.LATE) && !initialEvaluation.isTest ? finalEvalType : null,
      pages: finalPages,
      newMemorizedPages: ((attendance === AttendanceStatus.PRESENT || attendance === AttendanceStatus.LATE) && evaluationType === EvaluationType.MEMORIZATION && initialEvaluation.subject !== 'mutoon') ? selectionState.allActivePages : undefined,
      fromAyah: finalFromAyah,
      toAyah: finalToAyah,"""

content = re.sub(
    r"    const range = ayahRange.split\('-\'\).map\(n => n.trim\(\)\);\n    const updated: any = \{\n      ...initialEvaluation,\n      attendance,\n      absenceReason: attendance === AttendanceStatus.ABSENT \? absenceReason : null,\n      evaluationType: \(attendance === AttendanceStatus.PRESENT \|\| attendance === AttendanceStatus.LATE\) && !initialEvaluation.isTest \? finalEvalType : null,\n      pages: finalPages,\n      newMemorizedPages: \(\(attendance === AttendanceStatus.PRESENT \|\| attendance === AttendanceStatus.LATE\) && evaluationType === EvaluationType.MEMORIZATION && initialEvaluation.subject !== 'mutoon'\) \? selectionState.allActivePages : undefined,\n      fromAyah: range\[0\] \|\| null,\n      toAyah: range\[1\] \|\| range\[0\] \|\| null,",
    replacement,
    content
)

with open("components/EvaluationEditForm.tsx", "w") as f:
    f.write(content)
