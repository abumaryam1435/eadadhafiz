import re

with open("components/StudentProgressInfo.tsx", "r") as f:
    content = f.read()

replacement = """  if (subject === 'mutoon' && mutoonProgress) {
      const mutoonKeys = Object.keys(mutoonProgress);
      return (
        <div className="flex flex-col gap-2 mt-2 mb-4 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
            <h4 className="font-bold text-xs text-gray-500 dark:text-gray-400 mb-1">معلومات تقدم الطالب في المتون</h4>
            <div className="w-full mt-1 space-y-1.5">
                <div className="bg-blue-100 text-blue-800 p-2.5 rounded-md font-bold dark:bg-blue-900/50 dark:text-blue-200 border border-blue-200 dark:border-blue-800 text-xs leading-relaxed break-words whitespace-normal space-y-1.5">
                    <div className="flex items-center gap-1.5 pb-1 border-b border-blue-200/70 dark:border-blue-800/70">
                        <span className="font-extrabold text-blue-950 dark:text-blue-100">✨ الأبيات المحفوظة</span>
                    </div>
                    {mutoonKeys.length > 0 ? (
                        <ul className="space-y-1 mt-1">
                            {mutoonKeys.map(matnName => {
                                const matn = matns?.find(m => m.name === matnName);
                                const total = matn ? matn.linesCount : '?';
                                return (
                                    <li key={matnName}>
                                        <span className="text-blue-900 dark:text-blue-100 underline decoration-blue-300 dark:decoration-blue-700 underline-offset-4 ml-1">{matnName}:</span>
                                        {mutoonProgress[matnName]} أبيات (من مجموع {total} أبيات)
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <div>لا يوجد حفظ متون مسجل حتى الآن.</div>
                    )}
                </div>
            </div>
        </div>
      );
  }"""

content = re.sub(
    r"  if \(subject === 'mutoon' && mutoonProgress\) \{[\s\S]*?      \);\n  \}",
    replacement,
    content
)

with open("components/StudentProgressInfo.tsx", "w") as f:
    f.write(content)
