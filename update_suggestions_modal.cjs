const fs = require('fs');
let content = fs.readFileSync('components/SuggestionsModal.tsx', 'utf-8');

content = content.replace(
  "const { currentUser, suggestions, addSuggestion, updateSuggestion, deleteSuggestion, showToast } = context;",
  "const { currentUser, suggestions, addSuggestion, updateSuggestion, deleteSuggestion, showToast, students, addStudentBehavior } = context;"
);

content = content.replace(
  "const [activeTab, setActiveTab] = useState<'list' | 'add'>('add');",
  "const [activeTab, setActiveTab] = useState<'list' | 'add' | 'behavior'>('add');\n  const [behaviorStudentId, setBehaviorStudentId] = useState<number | ''>('');\n  const [behaviorContent, setBehaviorContent] = useState('');\n  const [studentSearchTerm, setStudentSearchTerm] = useState('');"
);

const newTabs = `
      <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-2xl mb-3 border border-gray-200 dark:border-slate-700 shadow-sm flex-wrap gap-2">
        <button
          onClick={() => setActiveTab('add')}
          className={\`flex-1 min-w-[100px] py-2.5 text-center rounded-xl font-black text-xs sm:text-sm transition-all \${
            activeTab === 'add'
              ? 'bg-white shadow-sm text-green-700 dark:bg-slate-700 dark:text-green-400'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }\`}
        >
          {editingSuggestion ? 'تعديل الاقتراح' : 'تقديم اقتراح جديد'}
        </button>
        <button
          onClick={() => setActiveTab('behavior')}
          className={\`flex-1 min-w-[100px] py-2.5 text-center rounded-xl font-black text-xs sm:text-sm transition-all \${
            activeTab === 'behavior'
              ? 'bg-white shadow-sm text-green-700 dark:bg-slate-700 dark:text-green-400'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }\`}
        >
          سلوك الطالب
        </button>
        <button
          onClick={() => {
            setActiveTab('list');
            resetForm();
          }}
          className={\`flex-1 min-w-[100px] py-2.5 text-center rounded-xl font-black text-xs sm:text-sm transition-all \${
            activeTab === 'list'
              ? 'bg-white shadow-sm text-green-700 dark:bg-slate-700 dark:text-green-400'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }\`}
        >
          الاقتراحات المرسلة ({mySuggestions.length})
        </button>
      </div>
`;

content = content.replace(/<div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-2xl mb-3 border border-gray-200 dark:border-slate-700 shadow-sm">[\s\S]*?<\/div>/, newTabs.trim());

const behaviorTabHtml = `
      {activeTab === 'behavior' ? (
        <form onSubmit={(e) => {
          e.preventDefault();
          if (!behaviorStudentId || !behaviorContent.trim()) {
            showToast('الرجاء اختيار الطالب وكتابة السلوك', 'error');
            return;
          }
          const student = students.find(s => s.id === Number(behaviorStudentId));
          if (!student) return;
          addStudentBehavior({
            studentId: student.id,
            studentName: student.name,
            teacherId: currentUser.id,
            teacherName: currentUser.name,
            content: behaviorContent.trim(),
            createdAt: Date.now()
          });
          showToast('تم إرسال سلوك الطالب بنجاح', 'success');
          setBehaviorStudentId('');
          setBehaviorContent('');
          setStudentSearchTerm('');
        }} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-black text-gray-700 dark:text-gray-300">بحث واختيار الطالب</label>
            <input
              type="text"
              placeholder="ابحث عن اسم الطالب..."
              value={studentSearchTerm}
              onChange={(e) => setStudentSearchTerm(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-bold text-sm focus:border-green-500 outline-none transition-all"
            />
            <div className="max-h-40 overflow-y-auto bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-2 mt-2 space-y-1">
              {students
                .filter(s => s.name.includes(studentSearchTerm))
                .slice(0, 50)
                .map(s => (
                <div
                  key={s.id}
                  onClick={() => setBehaviorStudentId(s.id)}
                  className={\`cursor-pointer px-3 py-2 rounded-lg text-sm font-bold transition-all \${behaviorStudentId === s.id ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' : 'hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300'}\`}
                >
                  {s.name}
                </div>
              ))}
              {students.filter(s => s.name.includes(studentSearchTerm)).length === 0 && (
                <div className="text-center py-2 text-xs text-gray-500">لا يوجد طلاب مطابقين للبحث</div>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-black text-gray-700 dark:text-gray-300">السلوك</label>
            <textarea
              value={behaviorContent}
              onChange={(e) => setBehaviorContent(e.target.value)}
              placeholder="اكتب تفاصيل السلوك هنا..."
              rows={4}
              className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-bold text-sm focus:border-green-500 outline-none transition-all resize-none"
            />
          </div>
          <button type="submit" className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-black shadow-lg transition-all active:scale-95">
            إرسال السلوك
          </button>
        </form>
      ) : activeTab === 'list' ? (
`;

content = content.replace("{activeTab === 'list' ? (", behaviorTabHtml.trim());

fs.writeFileSync('components/SuggestionsModal.tsx', content, 'utf-8');
console.log('updated SuggestionsModal');
