const fs = require('fs');
let content = fs.readFileSync('components/SuggestionsModal.tsx', 'utf-8');

// 1. Update activeTab type and initial state if needed
content = content.replace(
  "const [activeTab, setActiveTab] = useState<'list' | 'add' | 'behavior' | 'behavior_list'>('add');",
  "const [activeTab, setActiveTab] = useState<'list' | 'add' | 'behavior' | 'behavior_list' | 'behavior_all'>('add');\n  const [isBehaviorAuth, setIsBehaviorAuth] = useState(false);\n  const [behaviorAuthPass, setBehaviorAuthPass] = useState('');\n  const [behaviorAllSearchTerm, setBehaviorAllSearchTerm] = useState('');"
);

// 2. Add the tab button
const oldTabButtons = `        <button
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
      </div>`;

const newTabButtons = `        <button
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
        {currentUser.canViewBehaviors && (
          <button
            onClick={() => {
              setActiveTab('behavior_all');
              resetForm();
            }}
            className={\`flex-1 min-w-[100px] py-2.5 text-center rounded-xl font-black text-xs sm:text-sm transition-all \${
              activeTab === 'behavior_all'
                ? 'bg-white shadow-sm text-indigo-700 dark:bg-slate-700 dark:text-indigo-400'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }\`}
          >
            سلوكيات الطلاب
          </button>
        )}
      </div>`;

content = content.replace(oldTabButtons, newTabButtons);

// 3. Add the tab content
const behaviorAllContent = `      {activeTab === 'behavior_all' ? (
        <div className="space-y-4">
          {!isBehaviorAuth ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 p-8 text-center shadow-sm max-w-sm mx-auto mt-4">
              <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/40 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 mx-auto mb-4">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-xl font-black text-gray-800 dark:text-gray-200 mb-2">تسجيل الدخول مطلوب</h3>
              <p className="text-sm text-gray-500 dark:text-slate-400 font-bold mb-6">يرجى إدخال كلمة المرور المخصصة للاطلاع على سجل سلوكيات الطلاب.</p>
              
              <form onSubmit={(e) => {
                e.preventDefault();
                if (behaviorAuthPass === currentUser.behaviorsPassword) {
                  setIsBehaviorAuth(true);
                  showToast('تم تسجيل الدخول بنجاح', 'success');
                } else {
                  showToast('كلمة المرور غير صحيحة', 'error');
                }
              }} className="space-y-4">
                <input
                  type="password"
                  placeholder="كلمة المرور..."
                  value={behaviorAuthPass}
                  onChange={(e) => setBehaviorAuthPass(e.target.value)}
                  className="w-full text-center px-4 py-3 rounded-2xl border-2 border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-white font-bold focus:border-indigo-500 outline-none transition-all"
                />
                <button
                  type="submit"
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl transition-all shadow-md active:scale-95 text-sm"
                >
                  دخول
                </button>
              </form>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-gray-100 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="text-xl font-black text-indigo-900 dark:text-indigo-400 mb-1">سجل سلوكيات الطلاب ({studentBehaviors?.length || 0})</h3>
                  <p className="text-sm text-gray-500 dark:text-slate-400 font-bold">عرض جميع السلوكيات المسجلة للطلاب من قبل جميع المعلمين.</p>
                </div>
                <div className="relative w-full sm:w-64">
                  <input
                    type="text"
                    value={behaviorAllSearchTerm}
                    onChange={(e) => setBehaviorAllSearchTerm(e.target.value)}
                    placeholder="بحث..."
                    className="w-full pl-4 pr-10 py-2.5 rounded-xl border-2 border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-white text-sm outline-none focus:border-indigo-500 transition-all font-bold"
                  />
                  <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>

              {(!studentBehaviors || studentBehaviors.length === 0) ? (
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 p-12 text-center shadow-sm">
                  <svg className="w-16 h-16 mx-auto text-gray-300 dark:text-slate-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="text-xl font-black text-gray-800 dark:text-gray-200 mb-2">لا توجد سلوكيات</h3>
                  <p className="text-sm text-gray-500 dark:text-slate-400 font-bold">لم يتم تسجيل أي سلوكيات للطلاب حتى الآن.</p>
                </div>
              ) : (
                [...studentBehaviors]
                  .sort((a, b) => b.createdAt - a.createdAt)
                  .filter(b => {
                    if (!behaviorAllSearchTerm) return true;
                    const searchWords = behaviorAllSearchTerm.toLowerCase().split(/\s+/).filter(Boolean);
                    const textToSearch = \`\${b.studentName} \${b.teacherName} \${b.content}\`.toLowerCase();
                    return searchWords.every(word => textToSearch.includes(word));
                  })
                  .map((b) => (
                    <div key={b.id} className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-gray-100 dark:border-slate-800 shadow-sm">
                      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-3">
                        <div>
                          <h4 className="font-black text-gray-900 dark:text-white flex items-center gap-2">
                            الطالب: {b.studentName}
                          </h4>
                          <span className="text-xs text-gray-500 dark:text-slate-400 font-bold">
                            المعلم: {b.teacherName} • {new Date(b.createdAt).toLocaleString('ar-SA', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>
                      <div className="bg-gray-50 dark:bg-slate-950/50 p-4 rounded-2xl border border-gray-100 dark:border-slate-800">
                        <p className="text-sm font-bold text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">{b.content}</p>
                      </div>
                    </div>
                  ))
              )}
            </div>
          )}
        </div>
      ) : activeTab === 'behavior_list' ? (`;

content = content.replace("{activeTab === 'behavior_list' ? (", behaviorAllContent);

// Reset behaviorAuthPass when modal closes/resets
content = content.replace(
  "setIsRecording(false);",
  "setIsRecording(false);\n    setIsBehaviorAuth(false);\n    setBehaviorAuthPass('');"
);

fs.writeFileSync('components/SuggestionsModal.tsx', content, 'utf-8');
console.log('updated SuggestionsModal with behavior_all tab');
