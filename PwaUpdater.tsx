import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * PwaUpdater:
 * يقوم بتسجيل الـ Service Worker والتحقق التلقائي من وجود أي إصدار جديد
 * بمجرد فتح التطبيق، وتحديثه فورياً في الخلفية بدون إظهار أي إشعار للمستخدم.
 */
export const PwaUpdater: React.FC = () => {
  useRegisterSW({
    immediate: true,
    onRegisteredSW(swUrl, registration) {
      if (registration) {
        // فحص فوري عند فتح التطبيق
        registration.update().catch(() => {});

        // فحص دوري كل 10 دقائق أثناء استخدام التطبيق
        setInterval(() => {
          registration.update().catch(() => {});
        }, 10 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.warn('SW registration error', error);
    },
  });

  // لا حاجة لعرض أي شريط أو نافذة منبثقة؛ التحديث يتم تلقائياً
  return null;
};
