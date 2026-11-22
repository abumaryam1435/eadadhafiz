import React, { useState } from 'react';
import Modal from './Modal';
import { toArabicDigits } from '../utils/juzUtils';

interface PendingSyncLogoutModalProps {
  pendingCount: number;
  onRetrySync: () => Promise<boolean>;
  onConfirmLogout: () => void;
  onCancel: () => void;
}

const PendingSyncLogoutModal: React.FC<PendingSyncLogoutModalProps> = ({
  pendingCount,
  onRetrySync,
  onConfirmLogout,
  onCancel,
}) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const handleSyncNow = async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setSyncMessage('لا يوجد اتصال بالإنترنت حالياً. ستبقى البيانات محفوظة على جهازك حتى يتوفر الإنترنت.');
      return;
    }
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      const success = await onRetrySync();
      if (success) {
        onConfirmLogout();
      } else {
        setSyncMessage('لم تكتمل المزامنة بعد، تأكد من استقرار الإنترنت وحاول مجدداً.');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Modal
      title="📡 تنبيه: توجد بيانات لم تُرفع بعد"
      onClose={onCancel}
      hideDefaultCloseButton={true}
    >
      <div className="space-y-4 text-gray-800 dark:text-gray-200">
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-2xl p-4 text-center space-y-2">
          <p className="text-sm sm:text-base font-black text-amber-950 dark:text-amber-200">
            يوجد <span className="text-red-600 dark:text-red-400">({toArabicDigits(pendingCount)})</span> سجل/تقييم محفوظ محلياً على جهازك ولم تتم مزامنته مع السحابة بعد.
          </p>
          <p className="text-xs sm:text-sm font-bold text-gray-700 dark:text-gray-300 leading-relaxed">
            لا تقلق؛ تسجيل الخروج <span className="text-emerald-700 dark:text-emerald-400 font-black">لا يحذف هذه التقييمات</span>، لكن يلزمك فتح التطبيق مرة أخرى من نفس المتصفح بعد توفر الإنترنت ليتم رفعها تلقائياً.
          </p>
        </div>

        {syncMessage && (
          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-xs font-bold text-blue-900 dark:text-blue-200 text-center">
            {syncMessage}
          </div>
        )}

        <div className="flex flex-col gap-2.5 pt-2 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            disabled={isSyncing}
            onClick={handleSyncNow}
            className="w-full py-3 px-4 text-sm sm:text-base font-black text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 rounded-xl shadow-md transition-all active:scale-95 text-center"
          >
            {isSyncing ? 'جاري محاولة المزامنة...' : '🔄 محاولة المزامنة الآن ثم الخروج'}
          </button>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              disabled={isSyncing}
              onClick={onCancel}
              className="py-2.5 px-4 text-xs sm:text-sm font-extrabold text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-all active:scale-95 text-center"
            >
              العودة للتطبيق
            </button>
            <button
              type="button"
              disabled={isSyncing}
              onClick={onConfirmLogout}
              className="py-2.5 px-4 text-xs sm:text-sm font-extrabold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-xl transition-all active:scale-95 text-center"
            >
              خروج والاحتفاظ بها للمزامنة لاحقاً
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default PendingSyncLogoutModal;
