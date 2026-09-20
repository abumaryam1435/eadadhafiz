const fs = require('fs');
let content = fs.readFileSync('components/SuggestionsModal.tsx', 'utf-8');

content = content.replace(
  "const { currentUser, suggestions, addSuggestion, updateSuggestion, deleteSuggestion, showToast, students, addStudentBehavior } = context;",
  "const { currentUser, suggestions, addSuggestion, updateSuggestion, deleteSuggestion, showToast, students, addStudentBehavior, studentBehaviors, deleteStudentBehavior } = context;"
);

content = content.replace(
  "const [activeTab, setActiveTab] = useState<'list' | 'add' | 'behavior'>('add');",
  "const [activeTab, setActiveTab] = useState<'list' | 'add' | 'behavior' | 'behavior_list'>('add');"
);

content = content.replace(
  "  const mySuggestions = suggestions\n    ? suggestions.filter((s) => s.teacherId === currentUser.id).sort((a, b) => b.createdAt - a.createdAt)\n    : [];",
  "  const mySuggestions = suggestions\n    ? suggestions.filter((s) => s.teacherId === currentUser.id).sort((a, b) => b.createdAt - a.createdAt)\n    : [];\n  const myBehaviors = studentBehaviors\n    ? studentBehaviors.filter((b) => b.teacherId === currentUser.id).sort((a, b) => b.createdAt - a.createdAt)\n    : [];"
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
          تسجيل سلوك
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
          الاقتراحات ({mySuggestions.length})
        </button>
        <button
          onClick={() => {
            setActiveTab('behavior_list');
            resetForm();
          }}
          className={\`flex-1 min-w-[100px] py-2.5 text-center rounded-xl font-black text-xs sm:text-sm transition-all \${
            activeTab === 'behavior_list'
              ? 'bg-white shadow-sm text-green-700 dark:bg-slate-700 dark:text-green-400'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }\`}
        >
          السلوكيات ({myBehaviors.length})
        </button>
      </div>
`;

content = content.replace(/<div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-2xl mb-3 border border-gray-200 dark:border-slate-700 shadow-sm flex-wrap gap-2">[\s\S]*?<\/div>/, newTabs.trim());

const formatDate = (timestamp) => {
  return new Date(timestamp).toLocaleString('ar-SA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const behaviorListTabHtml = `
      {activeTab === 'behavior_list' ? (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-gray-100 dark:border-slate-800 shadow-sm mb-4">
            <h3 className="text-xl font-black text-green-900 dark:text-green-400 mb-1">السلوكيات المسجلة ({myBehaviors.length})</h3>
            <p className="text-sm text-gray-500 dark:text-slate-400 font-bold">هنا يمكنك متابعة السلوكيات التي قمت بتدوينها للطلاب ومعرفة ما إذا تمت قراءتها من المشرف.</p>
          </div>
          {myBehaviors.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 p-12 text-center shadow-sm">
              <svg className="w-16 h-16 mx-auto text-gray-300 dark:text-slate-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-xl font-black text-gray-800 dark:text-gray-200 mb-2">لا توجد سلوكيات مسجلة</h3>
              <p className="text-sm text-gray-500 dark:text-slate-400 font-bold">لم تقم بتدوين أي سلوك لأي طالب حتى الآن.</p>
            </div>
          ) : (
            myBehaviors.map((b) => (
              <div key={b.id} className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-gray-100 dark:border-slate-800 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-2 h-full" style={{ backgroundColor: b.reviewed ? '#10B981' : '#F59E0B' }}></div>
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-3">
                  <div>
                    <h4 className="font-black text-gray-900 dark:text-white flex items-center gap-2">
                      الطالب: {b.studentName}
                    </h4>
                    <span className="text-xs text-gray-500 dark:text-slate-400 font-bold">
                      {new Date(b.createdAt).toLocaleString('ar-SA', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={\`px-3 py-1 text-xs font-black rounded-xl \${b.reviewed ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400'}\`}>
                      {b.reviewed ? 'تمت القراءة ✔️' : 'قيد الانتظار ⏳'}
                    </span>
                    <button
                      onClick={() => {
                        if(window.confirm('هل أنت متأكد من حذف هذا السلوك؟')) {
                          deleteStudentBehavior(b.id);
                        }
                      }}
                      className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-950/20 dark:hover:bg-red-950/40 dark:text-red-400 rounded-xl text-xs font-black transition-all"
                    >
                      حذف
                    </button>
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-slate-950/50 p-4 rounded-2xl border border-gray-100 dark:border-slate-800">
                  <p className="text-sm font-bold text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">{b.content}</p>
                </div>
              </div>
            ))
          )}
        </div>
      ) : activeTab === 'behavior' ? (
`;

content = content.replace("{activeTab === 'behavior' ? (", behaviorListTabHtml.trim());

fs.writeFileSync('components/SuggestionsModal.tsx', content, 'utf-8');
console.log('updated SuggestionsModal2');
