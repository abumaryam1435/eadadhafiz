
import React, { useState, useContext } from 'react';
import { AppContext } from '../App';
import { exportSupervisorGuideWord } from '../utils/exportSupervisorGuideWord';
import { getDistributableHtmlString, generateAndDownloadDistributableZip } from '../utils/distributableApp';
import { FullBackupData } from '../types';

export const HelpModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const context = useContext(AppContext);
  const [downloadMessage, setDownloadMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'local' | 'publish'>('local');
  const [copyState, setCopyState] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle');


  const { isDistributable = false, firebaseConfig = null } = context || {};

  const handleDownloadSupervisorGuide = () => {
    exportSupervisorGuideWord();
    setDownloadMessage('✅ تم بدء تنزيل دليل المشرف.');
    setTimeout(() => setDownloadMessage(null), 4000);
  };

  const getCurrentSnapshot = (): FullBackupData => {
    return {
        users: context?.users || [],
        halaqas: context?.halaqas || [],
        students: context?.students || [],
        evaluations: context?.evaluations || [],
        deletedItems: [],
        customLogo: context?.customLogo || null,
        supervisorPassword: context?.supervisorPassword || '0000',
        appName: context?.appName || 'تطبيق الحلقات',
        firebaseConfig: context?.firebaseConfig || null,
        // Fix: configUpdatedAt is removed as it's not provided by AppContext
        isPublishedConnected: true,
        isDistributable: true
    };
  };

  const copyToClipboard = async (text: string) => {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (err) { console.error("Clipboard API failed:", err); }
    }
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    } catch (err) {
      console.error("Fallback copy failed:", err);
      return false;
    }
  };

  const handleCopyHtmlCode = async () => {
    if (copyState === 'copying') return;
    setCopyState('copying');
    try {
      const snapshot = getCurrentSnapshot();
      const htmlString = await getDistributableHtmlString(snapshot, 'snapshot');
      const success = await copyToClipboard(htmlString);
      if (success) {
        setCopyState('copied');
        setTimeout(() => setCopyState('idle'), 3000);
      } else { throw new Error("Copy failed"); }
    } catch (err) {
      console.error("HTML Copy failed:", err);
      setCopyState('error');
      setTimeout(() => setCopyState('idle'), 4000);
    }
  };

  const handleDownloadIndexHtml = async () => {
    try {
        const snapshot = getCurrentSnapshot();
        await generateAndDownloadDistributableZip(snapshot, 'snapshot');
        setDownloadMessage('✅ تم تنزيل ملف ZIP للنشر.');
        setTimeout(() => setDownloadMessage(null), 5000);
    } catch (error) { setDownloadMessage('❌ حدث خطأ أثناء التحميل.'); }
  };

  if (!context) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 md:p-10 max-w-4xl w-full max-h-[90vh] overflow-y-auto relative text-right" dir="rtl">
        <button onClick={onClose} className="absolute top-6 left-6 text-gray-400 hover:text-red-500 transition-colors">
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        <h3 className="text-3xl font-extrabold text-green-800 mb-6 border-b pb-4 dark:text-green-400">دليل الاستخدام والنشر</h3>

        {downloadMessage && <div className="p-4 mb-6 bg-green-50 border-r-4 border-green-500 text-green-800 rounded font-bold animate-fade-in">{downloadMessage}</div>}

        <div className="flex gap-2 mb-8 border-b dark:border-gray-700">
            <button onClick={() => setActiveTab('local')} className={`px-6 py-3 font-bold text-lg border-b-4 transition-all ${activeTab === 'local' ? 'border-green-600 text-green-700 dark:text-green-300' : 'border-transparent text-gray-400'}`}>العمل المحلي</button>
            <button onClick={() => setActiveTab('publish')} className={`px-6 py-3 font-bold text-lg border-b-4 transition-all ${activeTab === 'publish' ? 'border-purple-600 text-purple-700 dark:text-purple-300' : 'border-transparent text-gray-400'}`}>النشر والمشاركة</button>
        </div>

        <div className="space-y-6 text-gray-700 text-lg dark:text-gray-300">
            {activeTab === 'local' ? (
                <div className="animate-fade-in space-y-4">
                    <p>هذا التطبيق يعمل كـ <strong>تطبيق ويب مستقل</strong>. جميع بياناتك تُحفظ في متصفحك بشكل آمن وخاص.</p>
                    <div className="bg-yellow-50 border-r-4 border-yellow-500 p-4 rounded dark:bg-yellow-900/20">
                        <p className="font-bold text-yellow-800 dark:text-yellow-200">تنبيه:</p>
                        <p>مسح "بيانات المتصفح" قد يحذف سجلاتك. يرجى دائماً استخدام خيار <strong>"تصدير نسخة احتياطية"</strong> من الإعدادات بانتظام.</p>
                    </div>
                </div>
            ) : (
                <div className="animate-fade-in space-y-6">
                    <p>لمشاركة التطبيق مع المعلمين للعمل على نفس قاعدة البيانات:</p>
                    <div className="bg-purple-50 p-6 rounded-xl border border-purple-100 dark:bg-purple-900/20 dark:border-purple-800">
                        <h4 className="font-bold text-purple-800 mb-4 dark:text-purple-300">الخيار الموصى به: Netlify Drop</h4>
                        <ol className="list-decimal pr-6 space-y-3">
                            <li>قم بتنزيل النسخة المتصلة كملف ZIP: <button onClick={handleDownloadIndexHtml} className="px-3 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700">⬇️ تحميل ZIP</button></li>
                            <li>ارفع الملف في موقع <a href="https://app.netlify.com/drop" target="_blank" className="text-blue-600 underline">Netlify Drop</a> وسيكون لديك رابط عام فوراً.</li>
                        </ol>
                    </div>
                    <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 dark:bg-gray-700/50">
                        <h4 className="font-bold mb-3">نسخ كود HTML (للمواقع والمدونات)</h4>
                        <p className="text-sm mb-4">انسخ الكود بالأسفل لتضمينه في Google Sites أو أي صفحة ويب. هذا الكود يحتوي على أحدث بياناتك المسجلة الآن.</p>
                        <button onClick={handleCopyHtmlCode} disabled={copyState !== 'idle'} className={`w-full py-4 rounded-xl font-bold text-white transition-all ${copyState === 'copying' ? 'bg-amber-500' : copyState === 'copied' ? 'bg-green-600' : copyState === 'error' ? 'bg-red-600' : 'bg-indigo-600 hover:bg-indigo-700 shadow-lg hover:shadow-indigo-500/30'}`}>
                          {copyState === 'copying' ? 'جاري إنشاء الكود وتحديث البيانات...' : copyState === 'copied' ? '✅ تم النسخ بنجاح!' : copyState === 'error' ? '❌ فشل النسخ - حاول ثانية' : 'نسخ كود HTML المحدث بالكامل'}
                        </button>
                    </div>
                </div>
            )}
        </div>
        
        <div className="mt-10 pt-6 border-t dark:border-gray-700">
          <button onClick={handleDownloadSupervisorGuide} className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg transition-all">تنزيل دليل المشرف (Word)</button>
        </div>
      </div>
    </div>
  );
};
