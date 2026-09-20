
// NOTE: This is using the compat libraries for easier integration with the existing code structure.
declare const firebase: any;

let db: any = null;
let app: any = null;
let storage: any = null;

// الإعدادات المطلوبة للربط بقاعدة البيانات الجديدة المقدمة من المستخدم
export const HARDCODED_FIREBASE_CONFIG = {
  apiKey: "AIzaSyB6Gg6h46bIONmVf_1_7n9oHPOF2nJ-6pU",
  authDomain: "eadadhafiz-4711b.firebaseapp.com",
  databaseURL: "https://eadadhafiz-4711b-default-rtdb.firebaseio.com",
  projectId: "eadadhafiz-4711b",
  storageBucket: "eadadhafiz-4711b.firebasestorage.app",
  messagingSenderId: "274299128018",
  appId: "1:274299128018:web:08c781fa51eb038f6ac50b",
  measurementId: "G-KM3E03XW4W"
};

export const initializeFirebase = async (firebaseConfig: any) => {
  if (typeof firebase === 'undefined') {
      console.warn("Firebase SDK not loaded.");
      throw new Error("مكتبة Firebase غير محملة. يرجى التحقق من الاتصال بالإنترنت.");
  }

  if (!firebaseConfig || !firebaseConfig.apiKey) {
      // إذا لم تكن هناك إعدادات، لا نقوم بالتهيئة
      return { db: null, app: null };
  }

  try {
    // التحقق مما إذا كان التطبيق مهيأ مسبقاً
    if (firebase.apps && firebase.apps.length > 0) {
      const existingApp = firebase.app();
      // إذا كانت الإعدادات مختلفة، نقوم بحذف التطبيق القديم وإعادة التهيئة
      if (existingApp.options.apiKey !== firebaseConfig.apiKey) {
          await existingApp.delete();
          app = firebase.initializeApp(firebaseConfig);
      } else {
          app = existingApp;
      }
    } else {
      app = firebase.initializeApp(firebaseConfig);
    }

    db = firebase.database();
    storage = firebase.storage();
    
    // تفعيل التزامن لضمان العمل حتى عند انقطاع الإنترنت المؤقت
    try {
        db.goOnline();
    } catch(e) {}

    return { db, app };
  } catch (error) {
    console.error("Firebase initialization error:", error);
    db = null;
    app = null;
    throw new Error("فشل تهيئة Firebase. يرجى التحقق من بيانات الإعداد.");
  }
};

export const getDb = () => {
  return db;
};

export const getStorage = () => {
  return storage;
};

export const disconnectFirebase = async () => {
    if (app) {
        try {
            await app.delete();
            db = null;
            app = null;
        } catch(e) {
            console.error("Error disconnecting firebase:", e);
        }
    }
};
