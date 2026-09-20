import React, { useState } from 'react';
import Modal from './Modal';

interface WordExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (orientation: 'portrait' | 'landscape', action: 'download' | 'share' | 'pdf' | 'share-pdf') => void;
}

export const WordExportModal: React.FC<WordExportModalProps> = ({ isOpen, onClose, onExport }) => {
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');

  if (!isOpen) return null;

  return (
    <Modal title="تصدير إلى Word" onClose={onClose} hideDefaultCloseButton>
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

        <div className="flex flex-col gap-2 justify-center mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 text-[11px] font-bold">
           
           <div className="flex gap-2">
             <button
              onClick={() => {
                onExport(orientation, 'pdf');
                onClose();
              }}
              className="flex-1 p-2 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-all shadow-sm flex flex-col items-center justify-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              تصدير PDF
            </button>
            
            <button
              onClick={() => {
                onExport(orientation, 'share-pdf');
                onClose();
              }}
              className="flex-1 p-2 bg-green-600 hover:bg-green-700 text-white rounded-xl transition-all shadow-sm flex flex-col items-center justify-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
              مشاركة PDF
            </button>
           </div>

           <button
            onClick={() => {
              onExport(orientation, 'download');
              onClose();
            }}
            className="w-full p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all shadow-sm flex flex-col items-center justify-center gap-1 mt-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
            تحميل Word
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

