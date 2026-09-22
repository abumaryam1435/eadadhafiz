import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * PwaUpdater:
 * يقوم بتسجيل الـ Service Worker والتحقق التلقائي من وجود أي إصدار جديد
 * بمجرد فتح التطبيق، وتحديثه فورياً في الخلفية بدون إظهار أي إشعار للمستخدم.
 */
export const PwaUpdater: React.FC = () => {
  const {
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onNeedRefresh() {
      // تحديث فوري وتفعيل النسخة الجديدة فور توفرها
      updateServiceWorker(true);
    },
    onRegisteredSW(swUrl, registration) {
      if (registration) {
        // فحص فوري عند فتح التطبيق
        registration.update().catch(() => {});

        // فحص دوري كل دقيقتين أثناء استخدام التطبيق
        setInterval(() => {
          registration.update().catch(() => {});
        }, 2 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.warn('SW registration error', error);
    },
  });

  React.useEffect(() => {
    // عند استلام الـ Service Worker الجديد للتحكم بالصفحة، نقوم بإعادة التحميل للحصول على آخر كود JS
    let refreshing = false;
    if ('serviceWorker' in navigator) {
      const handleControllerChange = () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      };
      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
      return () => {
        navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      };
    }
  }, []);

  // لا حاجة لعرض أي شريط أو نافذة منبثقة؛ التحديث يتم تلقائياً
  return null;
};
