const fs = require('fs');
let content = fs.readFileSync('components/SuggestionsModal.tsx', 'utf-8');

// 1. Add editingBehavior state
content = content.replace(
  "const [editingSuggestion, setEditingSuggestion] = useState<Suggestion | null>(null);",
  "const [editingSuggestion, setEditingSuggestion] = useState<Suggestion | null>(null);\n  const [editingBehavior, setEditingBehavior] = useState<any>(null);"
);

// 2. Add handleEditBehavior
const newFunctions = `
  const handleEditBehavior = (b: any) => {
    setEditingBehavior(b);
    setBehaviorStudentId(b.studentId);
    setBehaviorContent(b.content);
    const student = students.find(s => s.id === b.studentId);
    if (student) setStudentSearchTerm(student.name);
    setActiveTab('behavior');
  };
`;
content = content.replace("const handleEditClick = (s: Suggestion) => {", newFunctions + "\n  const handleEditClick = (s: Suggestion) => {");

// 3. Update the description text in behavior_list
content = content.replace(
  "هنا يمكنك متابعة السلوكيات التي قمت بتدوينها للطلاب ومعرفة ما إذا تمت قراءتها من المشرف.",
  "هنا يمكنك متابعة السلوكيات التي قمت بتدوينها للطلاب وتعديلها أو حذفها خلال 24 ساعة من كتابتها."
);

// 4. Remove colored line and read status, add edit button if within 24 hours
const oldBehaviorCard = `              <div key={b.id} className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-gray-100 dark:border-slate-800 shadow-sm relative overflow-hidden">
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
                      onClick={() => setBehaviorDeleteConfirmId(b.id)}
                      className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-950/20 dark:hover:bg-red-950/40 dark:text-red-400 rounded-xl text-xs font-black transition-all active:scale-95 shadow-sm"
                    >
                      حذف
                    </button>
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-slate-950/50 p-4 rounded-2xl border border-gray-100 dark:border-slate-800">
                  <p className="text-sm font-bold text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">{b.content}</p>
                </div>
              </div>`;

const newBehaviorCard = `              <div key={b.id} className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-gray-100 dark:border-slate-800 shadow-sm relative overflow-hidden">
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
                  <div className="flex items-center gap-2 pt-3 border-t sm:border-0 border-gray-100 dark:border-slate-800 w-full sm:w-auto mt-2 sm:mt-0">
                    {canEditOrDelete(b.createdAt) && (
                      <>
                        <button
                          onClick={() => handleEditBehavior(b)}
                          className="flex-1 sm:flex-none items-center justify-center gap-1 px-3 py-1.5 bg-yellow-50 hover:bg-yellow-100 text-yellow-700 dark:bg-yellow-950/20 dark:hover:bg-yellow-950/40 dark:text-yellow-400 rounded-xl text-xs font-black transition-all inline-flex"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          تعديل
                        </button>
                        <button
                          onClick={() => setBehaviorDeleteConfirmId(b.id)}
                          className="flex-1 sm:flex-none items-center justify-center gap-1 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-950/20 dark:hover:bg-red-950/40 dark:text-red-400 rounded-xl text-xs font-black transition-all inline-flex"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          حذف
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-slate-950/50 p-4 rounded-2xl border border-gray-100 dark:border-slate-800">
                  <p className="text-sm font-bold text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">{b.content}</p>
                </div>
              </div>`;

content = content.replace(oldBehaviorCard, newBehaviorCard);

// 5. Update form submission for behavior to handle editing
const oldBehaviorSubmit = `        <form onSubmit={(e) => {
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
        }} className="space-y-4">`;

const newBehaviorSubmit = `        <form onSubmit={(e) => {
          e.preventDefault();
          if (!behaviorStudentId || !behaviorContent.trim()) {
            showToast('الرجاء اختيار الطالب وكتابة السلوك', 'error');
            return;
          }
          const student = students.find(s => s.id === Number(behaviorStudentId));
          if (!student) return;
          if (editingBehavior) {
            updateStudentBehavior({
              ...editingBehavior,
              studentId: student.id,
              studentName: student.name,
              content: behaviorContent.trim(),
              updatedAt: Date.now()
            });
            showToast('تم تحديث السلوك بنجاح', 'success');
          } else {
            addStudentBehavior({
              studentId: student.id,
              studentName: student.name,
              teacherId: currentUser.id,
              teacherName: currentUser.name,
              content: behaviorContent.trim(),
              createdAt: Date.now()
            });
            showToast('تم إرسال سلوك الطالب بنجاح', 'success');
          }
          setBehaviorStudentId('');
          setBehaviorContent('');
          setStudentSearchTerm('');
          setEditingBehavior(null);
          setActiveTab('behavior_list');
        }} className="space-y-4">`;

content = content.replace(oldBehaviorSubmit, newBehaviorSubmit);

// 6. Update the 'تسجيل سلوك' tab to show 'تعديل السلوك' when editingBehavior
content = content.replace(
  "تسجيل سلوك",
  "{editingBehavior ? 'تعديل السلوك' : 'تسجيل سلوك'}"
);

// 7. Update resetForm to also reset editingBehavior
const oldResetForm = `  const resetForm = () => {
    setTextContent('');
    setAudioBlob(null);
    setAudioUrl(null);
    setAttachments([]);
    setEditingSuggestion(null);
    setIsRecording(false);
  };`;

const newResetForm = `  const resetForm = () => {
    setTextContent('');
    setAudioBlob(null);
    setAudioUrl(null);
    setAttachments([]);
    setEditingSuggestion(null);
    setEditingBehavior(null);
    setIsRecording(false);
  };`;

content = content.replace(oldResetForm, newResetForm);

// Update submit button text in behavior form
content = content.replace(
  "إرسال السلوك",
  "{editingBehavior ? 'تحديث السلوك' : 'إرسال السلوك'}"
);

fs.writeFileSync('components/SuggestionsModal.tsx', content, 'utf-8');
console.log('updated SuggestionsModal_behavior');
