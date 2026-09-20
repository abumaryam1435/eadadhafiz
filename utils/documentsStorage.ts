import { DocumentCategory, SupervisorDocument } from '../types';
import { getDb, getStorage } from './firebase';

const DB_NAME = 'eadad_hafiz_documents_db';
const DB_VERSION = 1;
const STORE_BLOBS = 'documents_blobs';
const STORE_META = 'documents_meta';
const STORE_CATEGORIES = 'categories';

export const DEFAULT_CATEGORIES: DocumentCategory[] = [
  { id: 'cat-decisions', name: 'التعاميم والقرارات', color: '#059669', icon: 'file-text', createdAt: 1700000000001, description: 'القرارات والتعاميم الإدارية الصادرة' },
  { id: 'cat-plans', name: 'الخطط والجداول', color: '#2563eb', icon: 'calendar', createdAt: 1700000000002, description: 'خطط الحفظ والمراجعة والجداول الزمنية' },
  { id: 'cat-forms', name: 'النماذج واللوائح', color: '#d97706', icon: 'clipboard-list', createdAt: 1700000000003, description: 'النماذج الإدارية، الاستمارات، واستبيانات التقييم' },
  { id: 'cat-reports', name: 'تقارير مصورة وفعاليات', color: '#7c3aed', icon: 'image', createdAt: 1700000000004, description: 'صور الأنشطة والحفلات وتكريم المتميزين' },
  { id: 'cat-media', name: 'مقاطع فيديو ومرئيات', color: '#e11d48', icon: 'video', createdAt: 1700000000005, description: 'فيديوهات الحلقات، النماذج المتميزة، والتغطيات' },
  { id: 'cat-general', name: 'ملفات عامة', color: '#4b5563', icon: 'folder', createdAt: 1700000000006, description: 'مستندات وملفات متنوعة' },
];

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDocumentsDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this browser.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORE_BLOBS)) {
        db.createObjectStore(STORE_BLOBS, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORE_META)) {
        const metaStore = db.createObjectStore(STORE_META, { keyPath: 'id' });
        metaStore.createIndex('categoryId', 'categoryId', { unique: false });
        metaStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_CATEGORIES)) {
        db.createObjectStore(STORE_CATEGORIES, { keyPath: 'id' });
      }
    };

    request.onsuccess = async () => {
      const db = request.result;
      dbPromise = Promise.resolve(db);

      // Initialize default categories if empty
      try {
        const tx = db.transaction(STORE_CATEGORIES, 'readonly');
        const store = tx.objectStore(STORE_CATEGORIES);
        const countReq = store.count();
        countReq.onsuccess = () => {
          if (countReq.result === 0) {
            const writeTx = db.transaction(STORE_CATEGORIES, 'readwrite');
            const writeStore = writeTx.objectStore(STORE_CATEGORIES);
            for (const cat of DEFAULT_CATEGORIES) {
              writeStore.put(cat);
            }
          }
        };
      } catch (e) {
        console.warn('Error verifying categories:', e);
      }

      resolve(db);
    };

    request.onerror = () => {
      dbPromise = null;
      reject(request.error || new Error('Failed to open IndexedDB'));
    };
  });

  return dbPromise;
}

export async function getAllCategories(): Promise<DocumentCategory[]> {
  const db = await openDocumentsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CATEGORIES, 'readonly');
    const store = tx.objectStore(STORE_CATEGORIES);
    const request = store.getAll();

    request.onsuccess = () => {
      let cats: DocumentCategory[] = request.result || [];
      if (cats.length === 0) {
        cats = [...DEFAULT_CATEGORIES];
      }
      cats.sort((a, b) => a.createdAt - b.createdAt);
      resolve(cats);
    };

    request.onerror = () => reject(request.error);
  });
}

export async function saveCategory(category: DocumentCategory): Promise<void> {
  const db = await openDocumentsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CATEGORIES, 'readwrite');
    const store = tx.objectStore(STORE_CATEGORIES);
    const request = store.put(category);

    request.onsuccess = () => {
      // Sync categories to Firebase if connected
      syncCategoriesToFirebase();
      resolve();
    };

    request.onerror = () => reject(request.error);
  });
}

export async function deleteCategory(categoryId: string, deleteAssociatedFiles = false): Promise<void> {
  const db = await openDocumentsDB();

  // If deleting files in that category
  if (deleteAssociatedFiles) {
    const docs = await getAllDocuments();
    const toDelete = docs.filter(d => d.categoryId === categoryId);
    for (const doc of toDelete) {
      await deleteDocument(doc.id);
    }
  } else {
    // Reassign files to general category
    const docs = await getAllDocuments();
    const toReassign = docs.filter(d => d.categoryId === categoryId);
    for (const doc of toReassign) {
      await updateDocumentMeta(doc.id, { categoryId: 'cat-general', categoryName: 'ملفات عامة' });
    }
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CATEGORIES, 'readwrite');
    const store = tx.objectStore(STORE_CATEGORIES);
    const request = store.delete(categoryId);

    request.onsuccess = () => {
      syncCategoriesToFirebase();
      resolve();
    };

    request.onerror = () => reject(request.error);
  });
}

export async function getAllDocuments(): Promise<SupervisorDocument[]> {
  const db = await openDocumentsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readonly');
    const store = tx.objectStore(STORE_META);
    const request = store.getAll();

    request.onsuccess = () => {
      const docs: SupervisorDocument[] = request.result || [];
      docs.sort((a, b) => b.createdAt - a.createdAt);
      resolve(docs);
    };

    request.onerror = () => reject(request.error);
  });
}

// Background cloud sync helper (non-blocking)
function uploadToCloudInBackground(file: File, docMeta: SupervisorDocument) {
  // Run quietly after a short delay so local save completes in 0-50ms
  setTimeout(async () => {
    try {
      const storage = getStorage();
      if (storage && navigator.onLine) {
        const storageRef = storage.ref(`documents/${docMeta.categoryId}/${docMeta.id}_${file.name}`);
        const uploadTask = await storageRef.put(file);
        const storageUrl = await uploadTask.ref.getDownloadURL();
        if (storageUrl) {
          docMeta.storageUrl = storageUrl;
          const db = await openDocumentsDB();
          const tx = db.transaction(STORE_META, 'readwrite');
          tx.objectStore(STORE_META).put(docMeta);
        }
      }
    } catch (err) {
      // Non-blocking: Local IndexedDB is already persistent and safe
    }
  }, 100);
}

export async function saveDocument(
  file: File,
  meta: {
    title?: string;
    categoryId: string;
    categoryName?: string;
    notes?: string;
  }
): Promise<SupervisorDocument> {
  const db = await openDocumentsDB();
  const id = 'doc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
  const blobKey = 'blob_' + id;

  // 1. Generate lightweight thumbnail quickly with safety timeout (never blocks saving)
  let thumbnail: string | undefined;
  if (file.type.startsWith('image/')) {
    thumbnail = await generateImageThumbnail(file, 180);
  } else if (file.type.startsWith('video/')) {
    thumbnail = await generateVideoThumbnail(file);
  }

  const documentMeta: SupervisorDocument = {
    id,
    title: meta.title?.trim() || file.name.replace(/\.[^/.]+$/, ''),
    categoryId: meta.categoryId,
    categoryName: meta.categoryName,
    fileName: file.name,
    fileType: file.type || getFallbackMimeType(file.name),
    fileSize: file.size,
    createdAt: Date.now(),
    notes: meta.notes?.trim() || '',
    thumbnail,
    blobKey
  };

  // 2. Store binary blob and metadata in a single fast IndexedDB transaction (takes only ~10-40ms!)
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_BLOBS, STORE_META], 'readwrite');
    const blobStore = tx.objectStore(STORE_BLOBS);
    const metaStore = tx.objectStore(STORE_META);

    blobStore.put({
      id: blobKey,
      blob: file,
      fileName: file.name,
      fileType: documentMeta.fileType,
      fileSize: file.size,
      updatedAt: Date.now()
    });

    metaStore.put(documentMeta);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

  // 3. Cloud upload in background (non-blocking, does not delay local save)
  uploadToCloudInBackground(file, documentMeta);

  return documentMeta;
}

export async function getDocumentBlob(blobKey: string): Promise<Blob | null> {
  const db = await openDocumentsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_BLOBS, 'readonly');
    const store = tx.objectStore(STORE_BLOBS);
    const request = store.get(blobKey);

    request.onsuccess = () => {
      const record = request.result;
      if (record && record.blob) {
        resolve(record.blob);
      } else {
        resolve(null);
      }
    };

    request.onerror = () => reject(request.error);
  });
}

export async function deleteDocument(documentId: string): Promise<void> {
  const db = await openDocumentsDB();

  // Find doc meta to get blobKey
  const doc = await new Promise<SupervisorDocument | null>((resolve) => {
    const tx = db.transaction(STORE_META, 'readonly');
    const store = tx.objectStore(STORE_META);
    const req = store.get(documentId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => resolve(null);
  });

  if (doc?.blobKey) {
    // Delete blob
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_BLOBS, 'readwrite');
      const store = tx.objectStore(STORE_BLOBS);
      const req = store.delete(doc.blobKey);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  }

  // Delete metadata
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readwrite');
    const store = tx.objectStore(STORE_META);
    const req = store.delete(documentId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  syncDocumentsMetaToFirebase();
}

export async function updateDocumentMeta(
  documentId: string,
  updates: Partial<SupervisorDocument>
): Promise<void> {
  const db = await openDocumentsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readwrite');
    const store = tx.objectStore(STORE_META);
    const getReq = store.get(documentId);

    getReq.onsuccess = () => {
      const current = getReq.result;
      if (!current) {
        reject(new Error('Document not found'));
        return;
      }
      const updated = { ...current, ...updates, updatedAt: Date.now() };
      const putReq = store.put(updated);
      putReq.onsuccess = () => {
        syncDocumentsMetaToFirebase();
        resolve();
      };
      putReq.onerror = () => reject(putReq.error);
    };

    getReq.onerror = () => reject(getReq.error);
  });
}

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 بايت';
  const units = ['بايت', 'كيلوبايت', 'ميغابايت', 'غيغابايت'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1);
  return `${val} ${units[i] || 'بايت'}`;
}

export function getFileCategoryIcon(fileType: string): 'image' | 'video' | 'audio' | 'pdf' | 'spreadsheet' | 'document' | 'other' {
  if (fileType.startsWith('image/')) return 'image';
  if (fileType.startsWith('video/')) return 'video';
  if (fileType.startsWith('audio/')) return 'audio';
  if (fileType.includes('pdf')) return 'pdf';
  if (fileType.includes('sheet') || fileType.includes('excel') || fileType.includes('csv')) return 'spreadsheet';
  if (fileType.includes('word') || fileType.includes('text') || fileType.includes('document')) return 'document';
  return 'other';
}

function getFallbackMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    pdf: 'application/pdf',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    mp3: 'audio/mpeg',
    m4a: 'audio/mp4',
    wav: 'audio/wav',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    txt: 'text/plain',
    zip: 'application/zip',
  };
  return map[ext] || 'application/octet-stream';
}

export async function generateImageThumbnail(file: File, maxDimension = 180): Promise<string | undefined> {
  return new Promise((resolve) => {
    // 400ms safety timeout: never block save if image is slow or malformed
    const timer = setTimeout(() => resolve(undefined), 400);

    try {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        clearTimeout(timer);
        try {
          const canvas = document.createElement('canvas');
          let { width, height } = img;
          if (width > height) {
            if (width > maxDimension) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            }
          } else {
            if (height > maxDimension) {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL('image/jpeg', 0.6));
            return;
          }
        } catch (err) {
          console.warn('Thumbnail generation failed:', err);
        }
        URL.revokeObjectURL(url);
        resolve(undefined);
      };
      img.onerror = () => {
        clearTimeout(timer);
        URL.revokeObjectURL(url);
        resolve(undefined);
      };
      img.src = url;
    } catch (e) {
      clearTimeout(timer);
      resolve(undefined);
    }
  });
}

export async function generateVideoThumbnail(file: File): Promise<string | undefined> {
  return new Promise((resolve) => {
    // 600ms safety timeout: never block save if video codec is slow
    const timer = setTimeout(() => resolve(undefined), 600);

    try {
      const url = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;

      video.onloadeddata = () => {
        video.currentTime = 0.5;
      };

      video.onseeked = () => {
        clearTimeout(timer);
        try {
          const canvas = document.createElement('canvas');
          const maxDim = 180;
          let width = video.videoWidth || 180;
          let height = video.videoHeight || 135;
          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, width, height);
            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL('image/jpeg', 0.6));
            return;
          }
        } catch (e) {
          console.warn('Video thumb seek failed:', e);
        }
        URL.revokeObjectURL(url);
        resolve(undefined);
      };

      video.onerror = () => {
        clearTimeout(timer);
        URL.revokeObjectURL(url);
        resolve(undefined);
      };

      video.src = url;
    } catch (e) {
      clearTimeout(timer);
      resolve(undefined);
    }
  });
}

export async function downloadDocument(doc: SupervisorDocument): Promise<boolean> {
  try {
    let blob = await getDocumentBlob(doc.blobKey);
    if (!blob && doc.storageUrl) {
      const res = await fetch(doc.storageUrl);
      blob = await res.blob();
    }
    if (!blob) {
      alert('تعذر الوصول إلى محتوى الملف.');
      return false;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.fileName || `${doc.title}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch (err) {
    console.error('Download error:', err);
    alert('حدث خطأ أثناء تنزيل الملف.');
    return false;
  }
}

export async function shareDocument(doc: SupervisorDocument): Promise<{ success: boolean; method: 'web-share' | 'whatsapp' | 'download' }> {
  try {
    const blob = await getDocumentBlob(doc.blobKey);

    // 1. Try native Web Share API with File
    if (blob && navigator.share && navigator.canShare) {
      const file = new File([blob], doc.fileName, { type: doc.fileType });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: doc.title,
          text: `📄 مستند: ${doc.title} - تطبيق إعداد حافظ`,
          files: [file]
        });
        return { success: true, method: 'web-share' };
      }
    }

    // 2. If storageUrl exists, share link
    if (doc.storageUrl && navigator.share) {
      await navigator.share({
        title: doc.title,
        text: `📄 مستند: ${doc.title}\nرابط التحميل: ${doc.storageUrl}`
      });
      return { success: true, method: 'web-share' };
    }

    // 3. Fallback: Share via WhatsApp message
    const waText = encodeURIComponent(
      `📌 *مستند من تطبيق إعداد حافظ*\n` +
      `📄 *العنوان:* ${doc.title}\n` +
      `📁 *القسم:* ${doc.categoryName || 'عام'}\n` +
      `💾 *الحجم:* ${formatFileSize(doc.fileSize)}\n` +
      (doc.notes ? `📝 *ملاحظات:* ${doc.notes}\n` : '') +
      (doc.storageUrl ? `🔗 *الرابط:* ${doc.storageUrl}\n` : '')
    );
    window.open(`https://api.whatsapp.com/send?text=${waText}`, '_blank');
    return { success: true, method: 'whatsapp' };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return { success: false, method: 'web-share' };
    }
    console.warn('Share failed, fallback to download:', err);
    await downloadDocument(doc);
    return { success: true, method: 'download' };
  }
}

// Background sync helpers for Firebase RTDB
async function syncCategoriesToFirebase() {
  try {
    const db = getDb();
    if (db && navigator.onLine) {
      const categories = await getAllCategories();
      db.ref('config/documents_categories').set(categories).catch(() => {});
    }
  } catch (e) {}
}

async function syncDocumentsMetaToFirebase() {
  try {
    const db = getDb();
    if (db && navigator.onLine) {
      const docs = await getAllDocuments();
      // Store metadata list without huge blobs
      const lightDocs = docs.map(d => ({
        id: d.id,
        title: d.title,
        categoryId: d.categoryId,
        categoryName: d.categoryName,
        fileName: d.fileName,
        fileType: d.fileType,
        fileSize: d.fileSize,
        createdAt: d.createdAt,
        notes: d.notes,
        storageUrl: d.storageUrl || null
      }));
      db.ref('config/documents_meta').set(lightDocs).catch(() => {});
    }
  } catch (e) {}
}
