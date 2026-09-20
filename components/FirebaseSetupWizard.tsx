
import React, { useState } from 'react';
import Logo from './Logo';

interface FirebaseSetupWizardProps {
  onConfigSave: (config: any) => void;
}

export const FirebaseSetupWizard: React.FC<FirebaseSetupWizardProps> = ({ onConfigSave }) => {
  const [configInput, setConfigInput] = useState('');
  const [error, setError] = useState('');

  const smartParseConfig = (input: string) => {
    const cleanInput = input.trim();
    if (!cleanInput) return null;

    // 1. محاولة كـ JSON مباشر
    try {
      const parsed = JSON.parse(cleanInput);
      if (parsed && parsed.apiKey) return parsed;
    } catch (e) {}

    // 2. استخراج الكائن من كود JS باستخدام RegExp مطور
    // يبحث عن أي شيء يبدأ بـ { وينتهي بـ } ويحتوي على apiKey
    const match = cleanInput.match(/\{[\s\S]*apiKey[\s\S]*\}/);
    if (!match) return null;

    let content = match[0];

    try {
      // تحويل كود كائن JS إلى JSON صالح
      content = content
        .replace(/\/\/.*$/gm, '') // حذف التعليقات السطرية
        .replace(/\/\*[\s\S]*?\*\//g, '') // حذف التعليقات المتعددة الأسطر
        .replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":') // وضع علامات تنصيص للمفاتيح
        .replace(/'/g, '"') // تحويل علامات التنصيص المفردة لمزدوجة
        .replace(/,\s*}/g, '}') // حذف الفواصل الزائدة في النهاية
        .replace(/,\s*\]/g, ']');

      const parsed = JSON.parse(content);
      if (parsed && (parsed.apiKey || parsed.databaseURL)) return parsed;
    } catch (innerError) {
      console.error("Smart parse inner error:", innerError);
    }
    return null;
  };

  const handleSave = () => {
    setError('');
    const cleanedConfig = smartParseConfig(configInput);

    if (!cleanedConfig) {
      setError('❌ لم نتمكن من العثور على إعدادات صالحة. تأكد من نسخ كود firebaseConfig كاملاً.');
      return;
    }

    if (!cleanedConfig.apiKey) {
      setError('⚠️ الإعدادات ناقصة (مفتاح API مفقود).');
      return;
    }

    onConfigSave(cleanedConfig);
  };

  const handleOffline = () => {
     if(window.confirm('هل تريد الاستمرار في الوضع المحلي؟ لن يتم مزامنة البيانات سحابياً.')) {
        onConfigSave({}); 
     }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900 bg-opacity-95 flex items-center justify-center p-4 overflow-y-auto backdrop-blur-md">
      <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col border-4 border-green-600">
        <div className="bg-green-700 p-8 text-white text-center">
            <Logo className="h-20 w-20 mx-auto mb-4 bg-white rounded-full p-2" />
            <h2 className="text-3xl font-black mb-2">إعداد الاتصال السحابي</h2>
            <p className="text-green-100 opacity-90">اربط تطبيقك بقاعدة بيانات Firebase للعمل المشترك</p>
        </div>
        
        <div className="p-8 space-y-6 flex-grow" dir="rtl">
            <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-2xl border-r-4 border-blue-500">
                <p className="text-sm leading-relaxed text-blue-900 dark:text-blue-200">
                    انسخ كود <strong>firebaseConfig</strong> من إعدادات مشروعك في Firebase وصقه أدناه. سيقوم النظام باستخراج البيانات تلقائياً بذكاء.
                </p>
            </div>

            <div className="relative group">
                <label className="block font-bold text-gray-700 dark:text-gray-200 mb-2 mr-2">كود التهيئة (Firebase Config):</label>
                <textarea 
                    value={configInput}
                    onChange={(e) => setConfigInput(e.target.value)}
                    className="w-full h-48 p-4 bg-gray-50 border-2 border-gray-200 rounded-2xl font-mono text-xs focus:ring-4 focus:ring-green-500/20 focus:border-green-600 transition-all dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                    placeholder={`const firebaseConfig = {\n  apiKey: "AIza...",\n  authDomain: "...",\n  databaseURL: "...",\n  projectId: "...",\n  ...\n};`}
                ></textarea>
                {error && <p className="text-red-600 font-bold mt-3 text-sm animate-pulse px-2">{error}</p>}
            </div>
            
            <div className="flex items-start gap-2 text-[10px] text-gray-400 px-2">
                <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                <p>ملاحظة: تأكد من تفعيل "Realtime Database" في مشروعك بوضع "Test Mode" لضمان عمل المزامنة فوراً.</p>
            </div>
        </div>

        <div className="p-6 bg-gray-50 dark:bg-slate-900 border-t dark:border-slate-700 flex flex-col sm:flex-row gap-4 justify-between items-center">
            <button 
                onClick={handleOffline}
                className="text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 text-sm font-bold underline transition-colors"
            >
                تخطي والعمل محلياً
            </button>
            <button 
                onClick={handleSave}
                className="w-full sm:w-auto px-10 py-4 bg-green-700 hover:bg-green-800 text-white rounded-2xl font-black text-xl shadow-xl transition-all active:scale-95 hover:shadow-green-500/20"
            >
                تفعيل الربط والمتابعة
            </button>
        </div>
      </div>
    </div>
  );
};
