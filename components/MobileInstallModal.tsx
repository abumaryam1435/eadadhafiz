import React from 'react';
import Modal from './Modal';

interface MobileInstallModalProps {
  onClose: () => void;
}

const MobileInstallModal: React.FC<MobileInstallModalProps> = ({ onClose }) => {
  return (
    <Modal title="تثبيت التطبيق على جهازك المحمول" onClose={onClose}>
      <div className="space-y-6 text-gray-800 text-base leading-relaxed dark:text-gray-200">
        <p>هذا تطبيق ويب تقدمي (PWA)، مما يعني أنه يمكنك تثبيته على شاشتك الرئيسية ليعمل تماماً مثل أي تطبيق آخر، حتى بدون اتصال بالإنترنت.</p>

        <div className="p-4 bg-gray-50 border-r-4 border-gray-400 dark:bg-gray-700 dark:border-gray-600">
          <h4 className="text-xl font-semibold text-gray-800 mb-3 flex items-center dark:text-gray-100">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 ml-2 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 0 00-2-2H7a2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
            لمستخدمي أندرويد (متصفح Chrome)
          </h4>
          <ol className="list-decimal pr-6 space-y-2 text-gray-900 mt-2 dark:text-gray-200">
            <li>افتح التطبيق في متصفح جوجل كروم.</li>
            <li>اضغط على زر القائمة (الثلاث نقاط الرأسية <span className="font-bold">⋮</span>) في الزاوية العلوية.</li>
            <li>اختر خيار <span className="font-bold text-green-700 dark:text-green-300">"تثبيت التطبيق"</span> أو <span className="font-bold text-green-700 dark:text-green-300">"إضافة إلى الشاشة الرئيسية"</span>.</li>
            <li>اتبع التعليمات لتأكيد الإضافة. ستظهر أيقونة التطبيق على شاشتك الرئيسية.</li>
          </ol>
        </div>

        <div className="p-4 bg-gray-50 border-r-4 border-gray-400 dark:bg-gray-700 dark:border-gray-600">
          <h4 className="text-xl font-semibold text-gray-800 mb-3 flex items-center dark:text-gray-100">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 ml-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 0 00-2-2H7a2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
            لمستخدمي آيفون (متصفح Safari)
          </h4>
          <ol className="list-decimal pr-6 space-y-2 text-gray-900 mt-2 dark:text-gray-200">
            <li>افتح التطبيق في متصفح سفاري.</li>
            <li>اضغط على زر المشاركة (أيقونة المربع مع سهم لأعلى <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline-block" viewBox="0 0 20 20" fill="currentColor"><path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" /></svg>) في الشريط السفلي.</li>
            <li>مرر للأسفل واختر خيار <span className="font-bold text-blue-700 dark:text-blue-400">"إضافة إلى الصفحة الرئيسية"</span> (Add to Home Screen).</li>
            <li>قم بتأكيد الاسم ثم اضغط على "إضافة" (Add). ستظهر أيقونة التطبيق على شاشتك الرئيسية.</li>
          </ol>
        </div>
      </div>
    </Modal>
  );
};

export default MobileInstallModal;