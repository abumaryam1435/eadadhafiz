import React, { useState } from 'react';
import Modal from './Modal';

interface ExcelExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (orientation: 'portrait' | 'landscape', action: 'download' | 'share') => void;
}

export const ExcelExportModal: React.FC<ExcelExportModalProps> = ({ isOpen, onClose, onExport }) => {
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');

  if (!isOpen) return null;

  return (
    <Modal title="تصدير إلى Excel" onClose={onClose} hideDefaultCloseButton>
      <div className="space-y-4">
        <p className="text-gray-700 dark:text-gray-300 mb-4 font-medium text-center">
          يرجى اختيار اتجاه الصفحة للملف المصدر:
        </p>
        
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setOrientation("landscape")}
            className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all ${
              orientation === "landscape"
                ? "border-[#006A4E] bg-emerald-50/50 text-[#006A4E] dark:bg-emerald-950/20 shadow"
                : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
            }`}
          >
            <svg className="w-6 h-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <rect x="3" y="5" width="18" height="14" rx="2" strokeWidth="2" />
            </svg>
            <span className="text-xs font-black">أفقي (بالعرض)</span>
          </button>

          <button
            type="button"
            onClick={() => setOrientation("portrait")}
            className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all ${
              orientation === "portrait"
                ? "border-[#006A4E] bg-emerald-50/50 text-[#006A4E] dark:bg-emerald-950/20 shadow"
                : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
            }`}
          >
            <svg className="w-6 h-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <rect x="5" y="3" width="14" height="18" rx="2" strokeWidth="2" />
            </svg>
            <span className="text-xs font-black">عمودي (بالطول)</span>
          </button>
        </div>

        <div className="flex gap-2 justify-center mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 text-[11px] font-bold">
           <button
            onClick={() => {
              onExport(orientation, 'download');
              onClose();
            }}
            className="flex-1 p-2 bg-green-600 hover:bg-green-700 text-white rounded-xl transition-all shadow-sm flex flex-col items-center justify-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
            تحميل Excel
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-2 p-3 text-gray-500 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:text-gray-400 dark:hover:bg-slate-700 rounded-xl transition-all font-bold"
        >
          إلغاء
        </button>
      </div>
    </Modal>
  );
};
