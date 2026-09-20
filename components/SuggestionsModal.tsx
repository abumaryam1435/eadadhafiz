import React, { useState, useEffect, useRef, useContext } from 'react';
import { AppContext } from '../App';
import { Suggestion } from '../types';
import Modal from './Modal';

interface SuggestionsModalProps {
  onClose: () => void;
}

export const SuggestionsModal: React.FC<SuggestionsModalProps> = ({ onClose }) => {
  const context = useContext(AppContext);

  const currentUser = context?.currentUser;
  const suggestions = context?.suggestions || [];
  const addSuggestion = context?.addSuggestion || (async () => {});
  const updateSuggestion = context?.updateSuggestion || (async () => {});
  const deleteSuggestion = context?.deleteSuggestion || (async () => {});
  const showToast = context?.showToast || (() => {});
  const students = context?.students || [];
  const addStudentBehavior = context?.addStudentBehavior || (async () => {});
  const studentBehaviors = context?.studentBehaviors || [];
  const deleteStudentBehavior = context?.deleteStudentBehavior || (async () => {});
  const updateStudentBehavior = context?.updateStudentBehavior || (async () => {});

  const [activeTab, setActiveTab] = useState<'list' | 'add' | 'behavior' | 'behavior_list' | 'behavior_all'>('add');
  const [isBehaviorAuth, setIsBehaviorAuth] = useState(false);
  const [behaviorAuthPass, setBehaviorAuthPass] = useState('');
  const [behaviorAllSearchTerm, setBehaviorAllSearchTerm] = useState('');
  const [behaviorStudentId, setBehaviorStudentId] = useState<number | ''>('');
  const [behaviorContent, setBehaviorContent] = useState('');
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [suggestionType, setSuggestionType] = useState<'text' | 'voice'>('text');
  const [textContent, setTextContent] = useState('');
  
  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Attachments state
  const [attachments, setAttachments] = useState<{ name: string; type: string; data: string }[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Edit mode state
  const [editingSuggestion, setEditingSuggestion] = useState<Suggestion | null>(null);
  const [editingBehavior, setEditingBehavior] = useState<any>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [behaviorDeleteConfirmId, setBehaviorDeleteConfirmId] = useState<number | null>(null);

  // Filter suggestions to show only this teacher's suggestions
  const mySuggestions = suggestions && currentUser
    ? suggestions.filter((s) => s.teacherId === currentUser.id).sort((a, b) => b.createdAt - a.createdAt)
    : [];
  const myBehaviors = studentBehaviors && currentUser
    ? studentBehaviors.filter((b) => b.teacherId === currentUser.id).sort((a, b) => b.createdAt - a.createdAt)
    : [];

  // Recording timer effect
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setRecordingTime(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  // Clean up recording URL
  useEffect(() => {
    return () => {
      if (audioUrl && audioUrl.startsWith('blob:')) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  // Audio recording control functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const options = { mimeType: 'audio/webm' };
      
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, options);
      } catch (e) {
        recorder = new MediaRecorder(stream);
      }
      
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        
        // Stop all audio tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setIsRecording(true);
      setAudioBlob(null);
      setAudioUrl(null);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      showToast('⚠️ تعذر تشغيل الميكروفون. يرجى إعطاء صلاحية الميكروفون أو تشغيل التطبيق في نافذة مستقلة.', 'error');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    setIsBehaviorAuth(false);
    setBehaviorAuthPass('');
    }
  };

  // Convert Blob to Base64
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // File attachments handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      Array.from(e.target.files).forEach((file: any) => {
        addFile(file);
      });
    }
  };

  const addFile = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = reader.result as string;
      setAttachments((prev) => [
        ...prev,
        {
          name: file.name,
          type: file.type,
          data: base64Data,
        },
      ]);
    };
    reader.readAsDataURL(file);
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      Array.from(e.dataTransfer.files).forEach((file: any) => {
        addFile(file);
      });
    }
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (suggestionType === 'text' && !textContent.trim()) {
      showToast('⚠️ يرجى كتابة نص الاقتراح أولاً', 'error');
      return;
    }

    if (suggestionType === 'voice' && !audioBlob && !editingSuggestion?.audioUrl) {
      showToast('⚠️ يرجى تسجيل اقتراح صوتي أولاً', 'error');
      return;
    }

    try {
      let finalAudioUrl = editingSuggestion?.audioUrl || '';
      if (suggestionType === 'voice' && audioBlob) {
        finalAudioUrl = await blobToBase64(audioBlob);
      }

      const suggestionData = {
        teacherId: currentUser.id,
        teacherName: currentUser.name,
        type: suggestionType,
        content: suggestionType === 'text' ? textContent : '',
        audioUrl: suggestionType === 'voice' ? finalAudioUrl : '',
        attachments: attachments,
        createdAt: editingSuggestion?.createdAt || Date.now(),
      };

      if (editingSuggestion) {
        updateSuggestion({
          ...editingSuggestion,
          ...suggestionData,
        });
        showToast('✅ تم تعديل الاقتراح بنجاح!', 'success');
      } else {
        addSuggestion(suggestionData);
        showToast('✅ تم إرسال الاقتراح للمشرف بنجاح!', 'success');
      }

      resetForm();
      setActiveTab('list');
    } catch (err) {
      console.error(err);
      showToast('⚠️ حدث خطأ أثناء حفظ الاقتراح.', 'error');
    }
  };

  const resetForm = () => {
    setTextContent('');
    setAudioBlob(null);
    setAudioUrl(null);
    setAttachments([]);
    setEditingSuggestion(null);
    setEditingBehavior(null);
    setIsRecording(false);
  };

  // Check if suggestion can be edited (within 24 hours)
  const canEditOrDelete = (createdAt: number) => {
    const hours = (Date.now() - createdAt) / (1000 * 60 * 60);
    return hours < 24;
  };

  // Format time (MM:SS)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  
  const handleEditBehavior = (b: any) => {
    setEditingBehavior(b);
    setBehaviorStudentId(b.studentId);
    setBehaviorContent(b.content);
    const student = students.find(s => s.id === b.studentId);
    if (student) setStudentSearchTerm(student.name);
    setActiveTab('behavior');
  };

  const handleEditClick = (s: Suggestion) => {
    setEditingSuggestion(s);
    setSuggestionType(s.type);
    if (s.type === 'text') {
      setTextContent(s.content || '');
    } else {
      setAudioUrl(s.audioUrl || null);
    }
    setAttachments(s.attachments || []);
    setActiveTab('add');
  };

  const handleDeleteClick = (id: number) => {
    setDeleteConfirmId(id);
  };

  const confirmDelete = () => {
    if (deleteConfirmId !== null) {
      deleteSuggestion(deleteConfirmId);
      setDeleteConfirmId(null);
      showToast('🗑️ تم حذف الاقتراح بنجاح.', 'success');
    }
  };

  return (
    <Modal title={editingSuggestion ? 'تعديل الاقتراح' : 'مقترحات المعلم'} onClose={onClose} hideDefaultCloseButton={true}>
      {/* Tab Selectors */}
      <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-2xl mb-3 border border-gray-200 dark:border-slate-700 shadow-sm flex-wrap gap-2">
        <button
          onClick={() => setActiveTab('add')}
          className={`flex-1 min-w-[100px] py-2.5 text-center rounded-xl font-black text-xs sm:text-sm transition-all ${
            activeTab === 'add'
              ? 'bg-white shadow-sm text-green-700 dark:bg-slate-700 dark:text-green-400'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          {editingSuggestion ? 'تعديل الاقتراح' : 'تقديم اقتراح جديد'}
        </button>
        <button
          onClick={() => setActiveTab('behavior')}
          className={`flex-1 min-w-[100px] py-2.5 text-center rounded-xl font-black text-xs sm:text-sm transition-all ${
            activeTab === 'behavior'
              ? 'bg-white shadow-sm text-green-700 dark:bg-slate-700 dark:text-green-400'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          {editingBehavior ? 'تعديل السلوك' : 'تسجيل سلوك'}
        </button>
        <button
          onClick={() => {
            setActiveTab('list');
            resetForm();
          }}
          className={`flex-1 min-w-[100px] py-2.5 text-center rounded-xl font-black text-xs sm:text-sm transition-all ${
            activeTab === 'list'
              ? 'bg-white shadow-sm text-green-700 dark:bg-slate-700 dark:text-green-400'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          الاقتراحات ({mySuggestions.length})
        </button>
        <button
          onClick={() => {
            setActiveTab('behavior_list');
            resetForm();
          }}
          className={`flex-1 min-w-[100px] py-2.5 text-center rounded-xl font-black text-xs sm:text-sm transition-all ${
            activeTab === 'behavior_list'
              ? 'bg-white shadow-sm text-green-700 dark:bg-slate-700 dark:text-green-400'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          السلوكيات ({myBehaviors.length})
        </button>
        {currentUser.canViewBehaviors && (
          <button
            onClick={() => {
              setActiveTab('behavior_all');
              resetForm();
            }}
            className={`flex-1 min-w-[100px] py-2.5 text-center rounded-xl font-black text-xs sm:text-sm transition-all ${
              activeTab === 'behavior_all'
                ? 'bg-white shadow-sm text-indigo-700 dark:bg-slate-700 dark:text-indigo-400'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            سلوكيات الطلاب
          </button>
        )}
      </div>

            {activeTab === 'behavior_all' ? (
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
                  .sort((a, b) => a.studentName.localeCompare(b.studentName, 'ar') || b.createdAt - a.createdAt)
                  .filter(b => {
                    if (!behaviorAllSearchTerm) return true;
                    const searchWords = behaviorAllSearchTerm.toLowerCase().split(/\s+/).filter(Boolean);
                    const textToSearch = `${b.studentName} ${b.teacherName} ${b.content}`.toLowerCase();
                    return searchWords.every(word => textToSearch.includes(word));
                  })
                  .map((b) => {
                    const isRead = b.teacherReadBy?.includes(currentUser.id) || false;
                    
                    return (
                      <div key={b.id} className={`bg-white dark:bg-slate-900 rounded-3xl p-5 border-2 ${!isRead ? 'border-indigo-200 dark:border-indigo-900/50 shadow-md' : 'border-gray-100 dark:border-slate-800 shadow-sm opacity-80'} transition-all hover:opacity-100`}>
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-4">
                          <div>
                            <h4 className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
                              الطالب: {b.studentName}
                              {isRead && <span className="text-xs bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded-lg">مقروء</span>}
                            </h4>
                            <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-slate-400 font-bold mt-1">
                              <span className="flex items-center gap-1">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                المعلم: {b.teacherName}
                              </span>
                              <span className="flex items-center gap-1">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                {new Date(b.createdAt).toLocaleString('ar-SA', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 w-full sm:w-auto">
                            <button
                              onClick={() => {
                                const readBy = b.teacherReadBy || [];
                                const newReadBy = isRead 
                                  ? readBy.filter(id => id !== currentUser.id)
                                  : [...readBy, currentUser.id];
                                  
                                updateStudentBehavior({
                                  ...b,
                                  teacherReadBy: newReadBy
                                });
                              }}
                              className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${isRead ? 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md'}`}
                            >
                              {isRead ? 'تحديد كغير مقروء' : 'تمت القراءة'}
                            </button>
                          </div>
                        </div>
                        <div className="bg-gray-50 dark:bg-slate-950/50 p-4 rounded-2xl border border-gray-100 dark:border-slate-800">
                          <p className="text-sm font-bold text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">{b.content}</p>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          )}
        </div>
      ) : activeTab === 'behavior_list' ? (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-gray-100 dark:border-slate-800 shadow-sm mb-4">
            <h3 className="text-xl font-black text-green-900 dark:text-green-400 mb-1">السلوكيات المسجلة ({myBehaviors.length})</h3>
            <p className="text-sm text-gray-500 dark:text-slate-400 font-bold">هنا يمكنك متابعة السلوكيات التي قمت بتدوينها للطلاب وتعديلها أو حذفها خلال 24 ساعة من كتابتها.</p>
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
              </div>
            ))
          )}
        </div>
      ) : activeTab === 'behavior' ? (
        <form onSubmit={(e) => {
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
              {[...students]
                .filter(s => s.name.toLowerCase().includes(studentSearchTerm.trim().toLowerCase()))
                .sort((a, b) => a.name.localeCompare(b.name, 'ar'))
                .map(s => (
                <div
                  key={s.id}
                  onClick={() => setBehaviorStudentId(s.id)}
                  className={`cursor-pointer px-3 py-2 rounded-lg text-sm font-bold transition-all ${behaviorStudentId === s.id ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' : 'hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300'}`}
                >
                  {s.name}
                </div>
              ))}
              {students.filter(s => s.name.toLowerCase().includes(studentSearchTerm.trim().toLowerCase())).length === 0 && (
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
            {editingBehavior ? 'تحديث السلوك' : 'إرسال السلوك'}
          </button>
        </form>
      ) : activeTab === 'list' ? (
        <div className="space-y-4">
          {mySuggestions.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-slate-400 font-medium">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              لا توجد اقتراحات مرسلة بعد.
            </div>
          ) : (
            mySuggestions.map((s, index) => {
              const editable = canEditOrDelete(s.createdAt);
              const formattedDate = new Date(s.createdAt).toLocaleString('ar-SA', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div key={s.id} className="p-4 sm:p-5 bg-gray-50 dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm relative overflow-hidden group">
                  <div className="flex justify-between items-start mb-3 gap-2">
                    <span className="text-xs font-bold text-gray-400 dark:text-slate-500 flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {formattedDate}
                    </span>
                    <span className="text-xs font-black text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-950/40 px-2.5 py-1 rounded-full">
                      #{mySuggestions.length - index}
                    </span>
                  </div>

                  {/* Suggestion Content */}
                  <div className="mb-4">
                    {s.type === 'text' ? (
                      <p className="text-sm text-gray-800 dark:text-slate-200 font-bold whitespace-pre-wrap leading-relaxed">
                        {s.content}
                      </p>
                    ) : (
                      <div className="bg-white dark:bg-slate-900 p-2.5 rounded-2xl border dark:border-slate-700 flex flex-col gap-2">
                        <div className="text-xs font-black text-amber-600 dark:text-amber-400 flex items-center gap-1">
                          <svg className="w-4 h-4 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                          </svg>
                          تسجيل صوتي
                        </div>
                        <audio src={s.audioUrl || undefined} controls className="w-full h-10 outline-none" />
                      </div>
                    )}
                  </div>

                  {/* Attachments Section */}
                  {s.attachments && s.attachments.length > 0 && (
                    <div className="mb-4 pt-3 border-t dark:border-slate-700">
                      <div className="text-[11px] font-black text-gray-400 mb-2">المرفقات:</div>
                      <div className="flex flex-wrap gap-2">
                        {s.attachments.map((file, fIdx) => (
                          <a
                            key={fIdx}
                            href={file.data}
                            download={file.name}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl text-xs font-bold text-gray-700 dark:text-slate-300 hover:text-green-600 dark:hover:text-green-400 transition-all shadow-sm"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                            </svg>
                            <span className="truncate max-w-[120px]">{file.name}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions Section */}
                  <div className="flex justify-between items-center pt-3 border-t border-gray-100 dark:border-slate-700/60 mt-3">
                    {editable && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditClick(s)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-yellow-50 hover:bg-yellow-100 text-yellow-700 dark:bg-yellow-950/20 dark:hover:bg-yellow-950/40 dark:text-yellow-400 rounded-xl text-xs font-black transition-all"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          تعديل
                        </button>
                        <button
                          onClick={() => handleDeleteClick(s.id)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-950/20 dark:hover:bg-red-950/40 dark:text-red-400 rounded-xl text-xs font-black transition-all"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          حذف
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Suggestion Type Selection */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setSuggestionType('text');
                resetForm();
                if (editingSuggestion) {
                  setEditingSuggestion(editingSuggestion);
                  setSuggestionType('text');
                  setTextContent(editingSuggestion.content || '');
                  setAttachments(editingSuggestion.attachments || []);
                }
              }}
              className={`flex-1 py-2.5 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-2 border transition-all ${
                suggestionType === 'text'
                  ? 'bg-green-700 border-green-700 text-white shadow-md'
                  : 'bg-white border-gray-200 text-gray-700 dark:bg-slate-950 dark:border-slate-800 dark:text-slate-300'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              اقتراح مكتوب
            </button>
            <button
              type="button"
              onClick={() => {
                setSuggestionType('voice');
                resetForm();
                if (editingSuggestion) {
                  setEditingSuggestion(editingSuggestion);
                  setSuggestionType('voice');
                  setAudioUrl(editingSuggestion.audioUrl || null);
                  setAttachments(editingSuggestion.attachments || []);
                }
              }}
              className={`flex-1 py-2.5 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-2 border transition-all ${
                suggestionType === 'voice'
                  ? 'bg-green-700 border-green-700 text-white shadow-md'
                  : 'bg-white border-gray-200 text-gray-700 dark:bg-slate-950 dark:border-slate-800 dark:text-slate-300'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              اقتراح صوتي
            </button>
          </div>

          {/* Form Content */}
          {suggestionType === 'text' ? (
            <div className="space-y-1.5">
              <label className="text-xs font-black text-gray-700 dark:text-slate-300">نص الاقتراح</label>
              <textarea
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="اكتب فكرة الاقتراح أو الملاحظة التي تريد إرسالها للمشرف..."
                className="w-full h-24 px-3 py-2.5 rounded-xl border-2 border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-gray-900 dark:text-white text-xs outline-none focus:border-green-600 transition-all font-bold placeholder:text-gray-400 placeholder:font-medium resize-none"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-xs font-black text-gray-700 dark:text-slate-300">تسجيل الصوت</label>
              <div className="bg-gray-50 dark:bg-slate-950 rounded-xl p-4 border-2 border-dashed border-gray-200 dark:border-slate-800 text-center flex flex-col items-center justify-center gap-3">
                {isRecording ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-red-500 animate-ping flex items-center justify-center text-white font-bold text-[10px]">
                      تسجيل
                    </div>
                    <div className="text-lg font-mono font-bold text-red-600 dark:text-red-400 animate-pulse">
                      {formatTime(recordingTime)}
                    </div>
                    <button
                      type="button"
                      onClick={stopRecording}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-full transition-all flex items-center gap-1.5 text-xs shadow-sm"
                    >
                      <span className="w-2 h-2 bg-white rounded-full"></span>
                      إيقاف وحفظ
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 w-full">
                    {audioUrl ? (
                      <div className="w-full space-y-3">
                        <div className="text-[11px] font-black text-green-700 dark:text-green-400">تم تسجيل الصوت بنجاح!</div>
                        <audio src={audioUrl || undefined} controls className="mx-auto w-full max-w-xs h-8" />
                        <button
                          type="button"
                          onClick={startRecording}
                          className="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-slate-800 dark:text-white rounded-lg text-[10px] font-bold transition-all"
                        >
                          إعادة تسجيل الصوت
                        </button>
                      </div>
                    ) : (
                      <div className="py-2">
                        <button
                          type="button"
                          onClick={startRecording}
                          className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400 flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-sm"
                        >
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                          </svg>
                        </button>
                        <div className="text-[10px] font-bold text-gray-500 mt-2">اضغط للبدء بتسجيل صوتك</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Attachments Section */}
          <div className="space-y-1.5">
            <label className="text-xs font-black text-gray-700 dark:text-slate-300">مرفقات اختيارية (مستندات أو صور توضيحية)</label>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`p-3 rounded-xl border-2 border-dashed text-center transition-all cursor-pointer ${
                isDragging
                  ? 'border-green-600 bg-green-50/50 dark:bg-green-950/20'
                  : 'border-gray-200 hover:border-green-500 dark:border-slate-800 dark:hover:border-slate-700 bg-white dark:bg-slate-950'
              }`}
            >
              <input
                type="file"
                multiple
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center justify-center py-1">
                <svg className="w-6 h-6 text-gray-400 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <div className="text-[11px] font-black text-gray-700 dark:text-slate-300">اسحب وأفلت الملفات هنا، أو اضغط للتصفح</div>
                <div className="text-[9px] text-gray-400 mt-0.5">يدعم الصور والمستندات بحد أقصى</div>
              </label>
            </div>

            {/* Selected Attachments List */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {attachments.map((file, index) => (
                  <div key={index} className="flex items-center gap-1 px-2.5 py-1 bg-gray-50 dark:bg-slate-800 rounded-lg text-[10px] font-bold border border-gray-100 dark:border-slate-700 shadow-sm max-w-[180px]">
                    <span className="truncate flex-1">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      className="p-0.5 hover:text-red-500 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700 transition-all"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex gap-3 pt-3 border-t dark:border-slate-800">
            <button
              type="submit"
              className="flex-1 py-3 bg-green-700 text-white rounded-xl hover:bg-green-800 transition-all font-black text-sm shadow-md active:scale-95 flex items-center justify-center gap-2"
            >
              <span>{editingSuggestion ? 'تحديث الاقتراح' : 'إرسال الاقتراح'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-all font-black text-sm active:scale-95 flex items-center justify-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span>إغلاق</span>
            </button>
          </div>
        </form>
      )}

            {behaviorDeleteConfirmId !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full border border-gray-100 dark:border-slate-800 shadow-2xl text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-red-100 dark:bg-red-950/35 rounded-full flex items-center justify-center text-red-600 dark:text-red-400 mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h4 className="text-lg font-black text-gray-900 dark:text-white mb-2">تأكيد حذف السلوك</h4>
            <p className="text-sm text-gray-500 dark:text-slate-400 font-bold mb-6">هل أنت متأكد من رغبتك في حذف هذا السلوك نهائياً؟ لا يمكن التراجع عن هذا الإجراء.</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  deleteStudentBehavior(behaviorDeleteConfirmId);
                  setBehaviorDeleteConfirmId(null);
                  showToast('🗑️ تم حذف السلوك بنجاح.', 'success');
                }}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl transition-all shadow-lg text-sm active:scale-95"
              >
                تأكيد الحذف
              </button>
              <button
                type="button"
                onClick={() => setBehaviorDeleteConfirmId(null)}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 font-black rounded-2xl transition-all text-sm active:scale-95"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
      
      {deleteConfirmId !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full border border-gray-100 dark:border-slate-800 shadow-2xl text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-red-100 dark:bg-red-950/35 rounded-full flex items-center justify-center text-red-600 dark:text-red-400 mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h4 className="text-lg font-black text-gray-900 dark:text-white mb-2">تأكيد حذف المقترح</h4>
            <p className="text-sm text-gray-500 dark:text-slate-400 font-bold mb-6">هل أنت متأكد من رغبتك في حذف هذا الاقتراح نهائياً؟ لا يمكن التراجع عن هذا الإجراء.</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={confirmDelete}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl transition-all shadow-lg text-sm active:scale-95"
              >
                تأكيد الحذف
              </button>
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 font-black rounded-2xl transition-all text-sm active:scale-95"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};
