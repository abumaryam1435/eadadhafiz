
import { FullBackupData } from '../types';
import { INITIAL_USERS } from '../constants';

declare const JSZip: any;

export const utf8ToBase64 = (str: string): string => {
  try {
    const bytes = new TextEncoder().encode(str);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  } catch (e) {
    console.error("Base64 Encoding Error:", e);
    return "";
  }
};

const serviceWorkerCode = `
const CACHE_NAME = 'hafiz-app-cache-v1';
const ASSETS_TO_CACHE = ['./', './index.html', './manifest.json'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS_TO_CACHE))); self.skipWaiting(); });
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = e.request.url;
  if (url.includes('/api/') || url.includes('firebaseio.com')) return;
  e.respondWith(
    caches.match(e.request).then((r) => {
      return r || fetch(e.request).catch(() => new Response('Offline', { status: 503 }));
    }).catch(() => new Response('Offline', { status: 503 }))
  );
});
`;

const generateManifest = (appName: string, logoUrl: string | null) => {
  const iconUrl = logoUrl || "./logo.png";
  return {
    "name": appName || "إعداد حافظ",
    "short_name": "حافظ",
    "start_url": "./index.html",
    "display": "standalone",
    "background_color": "#006A4E",
    "theme_color": "#006A4E",
    "icons": [{ "src": iconUrl, "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }]
  };
};

export const getDistributableHtmlString = async (
    appData: FullBackupData,
    exportType: 'empty' | 'snapshot'
): Promise<string> => {
    const docClone = document.documentElement.cloneNode(true) as HTMLElement;
    const rootElement = docClone.querySelector('#root');
    if (rootElement) rootElement.innerHTML = '';

    const oldScripts = docClone.querySelectorAll('script');
    oldScripts.forEach(s => {
        if (s.textContent?.includes('window.embeddedAppData') || s.textContent?.includes('serviceWorker.register')) {
            s.remove();
        }
    });

    let appDataForEmbedding: FullBackupData;
    if (exportType === 'empty') {
      appDataForEmbedding = {
        users: INITIAL_USERS,
        halaqas: [],
        students: [],
        evaluations: [],
        maghribAttendances: [],
        customLogo: null,
        supervisorPassword: '123', 
        maghribPassword: '123',     
        appName: appData.appName,
        isDistributable: true,
        isPublishedConnected: false,
        firebaseConfig: null,
      };
    } else {
      appDataForEmbedding = {
          ...appData,
          isDistributable: true,
          isPublishedConnected: true,
      };
    }

    const encodedData = utf8ToBase64(JSON.stringify(appDataForEmbedding));
    const swRegistrationScript = `if ('serviceWorker' in navigator) { window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); }); }`;
    const dataScript = `\n<script type="text/javascript">window.embeddedAppData = '${encodedData}'; ${swRegistrationScript}</script>\n`;

    const bodyEndTag = '</body>';
    const htmlContentRaw = docClone.outerHTML;
    const bodyEndIndex = htmlContentRaw.toLowerCase().lastIndexOf(bodyEndTag);
    
    let htmlContent = (bodyEndIndex !== -1) 
        ? htmlContentRaw.slice(0, bodyEndIndex) + dataScript + htmlContentRaw.slice(bodyEndIndex)
        : htmlContentRaw + dataScript;

    if (!htmlContent.trim().toLowerCase().startsWith('<!doctype html>')) {
        htmlContent = '<!DOCTYPE html>\n' + htmlContent;
    }
    
    return htmlContent;
};

export const generateAndDownloadDistributableZip = async (appData: FullBackupData, exportType: 'empty' | 'snapshot') => {
    if (typeof JSZip === 'undefined') return alert('JSZip library missing');
    const zip = new JSZip();
    const htmlContent = await getDistributableHtmlString(appData, exportType);
    zip.file("index.html", htmlContent);
    zip.file("manifest.json", JSON.stringify(generateManifest(appData.appName || "إعداد حافظ", appData.customLogo), null, 2));
    zip.file("sw.js", serviceWorkerCode);
    const content = await zip.generateAsync({ type: "blob" });
    const url = window.URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hafiz_netlify_deploy.zip`;
    a.click();
    window.URL.revokeObjectURL(url);
};

export const generateAndDownloadDistributableHtml = async (appData: FullBackupData, exportType: 'empty' | 'snapshot') => {
    const htmlContent = await getDistributableHtmlString(appData, exportType);
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    // هام جداً: يجب أن يكون اسم الملف index.html ليعمل الرابط مباشرة في Netlify
    a.download = `index.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};
