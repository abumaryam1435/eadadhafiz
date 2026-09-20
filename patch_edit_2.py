import re

with open("components/EvaluationEditForm.tsx", "r") as f:
    content = f.read()

replacement = """                                    <div className="flex flex-col justify-end">
                                        <label className="text-[10px] font-black text-gray-400 mr-1 uppercase mb-1 block text-gray-500">عدد الأبيات</label>
                                        <div className="flex flex-col gap-2">
                                            <div className="flex items-center justify-center h-10 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200 rounded-xl font-bold border border-emerald-300 dark:border-emerald-700/60 w-full text-sm">
                                               مراجعة (أتم حفظ المتن)
                                            </div>
                                            <button type="button" onClick={() => setPages('')} className="text-xs text-blue-600 underline self-center">تعديل عدد الأبيات (إلغاء المراجعة)</button>
                                        </div>
                                    </div>"""

content = re.sub(
    r"                                    <div className=\"flex flex-col justify-end\">\n                                        <label className=\"text-\[10px\] font-black text-gray-400 mr-1 uppercase mb-1 block text-gray-500\">عدد الأبيات</label>\n                                        <div className=\"flex items-center justify-center h-10 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200 rounded-xl font-bold border border-emerald-300 dark:border-emerald-700/60 w-full text-sm\">\n                                           مراجعة \(أتم حفظ المتن\)\n                                        </div>\n                                    </div>",
    replacement,
    content
)

with open("components/EvaluationEditForm.tsx", "w") as f:
    f.write(content)
