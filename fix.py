import re

with open("components/EvaluationEditForm.tsx", "r") as f:
    content = f.read()

# We look for the start: "    } else {\n        finalPages =" 
# and the end: "      updatedAt: Date.now(),"
start_str = "    } else {\n        finalPages = ((attendance === AttendanceStatus.PRESENT || attendance === AttendanceStatus.LATE) && evaluationType === EvaluationType.MEMORIZATION) ? (selectionState.allActivePages.length > 0 ? selectionState.newPagesCount : null) : null;\n    }"
end_str = "      updatedAt: Date.now(),"

start_idx = content.find(start_str)
end_idx = content.find(end_str)

if start_idx != -1 and end_idx != -1:
    correct_block = """    } else {
        finalPages = ((attendance === AttendanceStatus.PRESENT || attendance === AttendanceStatus.LATE) && evaluationType === EvaluationType.MEMORIZATION) ? (selectionState.allActivePages.length > 0 ? selectionState.newPagesCount : null) : null;
    }

    const range = ayahRange.split('-').map(n => n.trim());
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
      toAyah: finalToAyah,
      surahs: ((attendance === AttendanceStatus.PRESENT || attendance === AttendanceStatus.LATE) && (evaluationType === EvaluationType.MEMORIZATION || finalEvalType === EvaluationType.REVIEW)) ? selectedSurahs : initialEvaluation.surahs,
      performance: ((attendance === AttendanceStatus.PRESENT || attendance === AttendanceStatus.LATE) && (evaluationType === EvaluationType.MEMORIZATION || finalEvalType === EvaluationType.REVIEW)) ? finalPerformance : null,
      periodicReview: ((attendance === AttendanceStatus.PRESENT || attendance === AttendanceStatus.LATE) && evaluationType === EvaluationType.MEMORIZATION) ? (periodicReview || null) : null,
      notes: notes || null,
"""
    new_content = content[:start_idx] + correct_block + content[end_idx:]
    with open("components/EvaluationEditForm.tsx", "w") as f:
        f.write(new_content)
else:
    print("Could not find start_idx or end_idx")
