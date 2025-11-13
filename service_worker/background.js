// Service Worker המשתמש ב-chrome.webRequest לשינוי כותרות עוגיות

const TARGET_SITE_URL = 'https://thechannel-viewer.clickandgo.cfd/';
const SITES_STORAGE_KEY = 'theChannelSites';
let managedSitesCache = [];

// --- לוגיקת שליפת האתרים (ללא שינוי) ---

async function getSitesFromLocalStorage_Robust() {
  const LOCAL_STORAGE_KEY = 'userChannelCategories';
  const POLLING_INTERVAL = 200;
  const TIMEOUT = 5000;
  return new Promise((resolve, reject) => {
    let elapsedTime = 0;
    const intervalId = setInterval(() => {
      elapsedTime += POLLING_INTERVAL;
      if (elapsedTime >= TIMEOUT) {
        clearInterval(intervalId);
        reject(new Error(`Timeout: The key "${LOCAL_STORAGE_KEY}" was not found in localStorage within ${TIMEOUT}ms.`));
        return;
      }
      const dataStr = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (dataStr) {
        clearInterval(intervalId);
        try {
          const categories = JSON.parse(dataStr);
          const urls = [];
          if (Array.isArray(categories)) {
            for (const category of categories) {
              if (category && Array.isArray(category.sites)) {
                for (const site of category.sites) {
                  if (site && typeof site.url === 'string') {
                    urls.push(site.url);
                  }
                }
              }
            }
          }
          resolve(urls);
        } catch (error) {
          reject(new Error('Failed to parse data from localStorage: ' + error.message));
        }
      }
    }, POLLING_INTERVAL);
  });
}

async function fetchAndStoreSitesFromLocalStorage() {
  let tempTab = null;
  try {
    tempTab = await chrome.tabs.create({ url: TARGET_SITE_URL, active: false });
    const results = await chrome.scripting.executeScript({
      target: { tabId: tempTab.id },
      func: getSitesFromLocalStorage_Robust
    });
    if (!results || results.length === 0 || !results[0].result) {
      throw new Error('לא נמצאו נתונים ב-LocalStorage של האתר.');
    }
    const urls = results[0].result;
    const domains = [...new Set(
      urls.map(url => {
        try {
          return new URL(url).hostname;
        } catch { return null; }
      }).filter(Boolean)
    )];
    await chrome.storage.local.set({ [SITES_STORAGE_KEY]: domains });
    console.log('TheChannel Viewer: רשימת האתרים עודכנה ונשמרה.', domains);
    return domains;
  } catch (error) {
    console.error('TheChannel Viewer: נכשל בתהליך שליפת הנתונים.', error);
    throw error;
  } finally {
    if (tempTab) { await chrome.tabs.remove(tempTab.id); }
  }
}

async function getStoredSites() {
  const data = await chrome.storage.local.get(SITES_STORAGE_KEY);
  return data[SITES_STORAGE_KEY] || [];
}

// --- לוגיקת WebRequest חדשה ---

/**
 * פונקציה זו משנה כותרת 'set-cookie' בודדת.
 * היא מסירה ערכי SameSite ו-Secure קיימים, ומוסיפה SameSite=None ו-Secure.
 * @param {string} cookieHeader - הערך של כותרת ה-set-cookie.
 * @returns {string} - הערך החדש של הכותרת.
 */
function modifyCookieHeader(cookieHeader) {
  // הסר בצורה בטוחה את מאפייני SameSite ו-Secure, אם הם קיימים
  let modifiedCookie = cookieHeader.replace(/;?\s*SameSite=(Lax|Strict|None)/i, '');
  modifiedCookie = modifiedCookie.replace(/;?\s*Secure/i, '');

  // הוסף את המאפיינים הרצויים
  modifiedCookie += '; SameSite=None; Secure';
  
  return modifiedCookie;
}

/**
 * המאזין הראשי לאירוע onHeadersReceived.
 * פונקציה זו מופעלת עבור כל תגובה מהשרת התואמת למסננים שהגדרנו.
 */
function onHeadersReceivedListener(details) {
  // ודא שהדומיין של הבקשה נמצא ברשימה המנוהלת שלנו
  // (בדיקה נוספת למקרה שהמסנן רחב מדי)
  const requestDomain = new URL(details.url).hostname;
  if (!managedSitesCache.some(site => requestDomain.endsWith(site))) {
    return { responseHeaders: details.responseHeaders };
  }

  let hasModifiedHeaders = false;
  
  details.responseHeaders.forEach(header => {
    if (header.name.toLowerCase() === 'set-cookie' && header.value) {
      const originalValue = header.value;
      header.value = modifyCookieHeader(originalValue);
      if(originalValue !== header.value) {
        hasModifiedHeaders = true;
      }
    }
  });
  
  if (hasModifiedHeaders) {
    console.log(`TheChannel Viewer: שינה כותרות עוגיות עבור ${details.url}`);
    return { responseHeaders: details.responseHeaders };
  }
}

/**
 * מסיר מאזינים קיימים ורושם מאזין חדש על בסיס רשימת האתרים העדכנית.
 */
async function registerOrUpdateWebRequestListeners() {
  // 1. הסר את המאזין הקודם כדי למנוע כפילויות
  if (chrome.webRequest.onHeadersReceived.hasListener(onHeadersReceivedListener)) {
    chrome.webRequest.onHeadersReceived.removeListener(onHeadersReceivedListener);
  }

  // 2. טען את רשימת האתרים המעודכנת
  const sites = await getStoredSites();
  managedSitesCache = sites; // עדכן את המטמון

  if (sites.length === 0) {
    console.log('TheChannel Viewer: אין אתרים לניהול, המאזין לא יופעל.');
    return;
  }

  // 3. הגדר את המסננים (filters)
  const urls = sites.map(domain => `*://${domain}/*`);
  const filter = {
    urls: urls,
    types: ['sub_frame']
  };

  // 4. רשום את המאזין החדש עם המסננים המעודכנים
  chrome.webRequest.onHeadersReceived.addListener(
    onHeadersReceivedListener,
    filter,
    ['blocking', 'responseHeaders', 'extraHeaders'] // נדרש לשינוי כותרות
  );

  console.log('TheChannel Viewer: מאזין WebRequest עודכן עבור האתרים:', sites);
}


// --- ניהול אירועים ---

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getSites') {
    getStoredSites().then(sendResponse);
    return true;
  }

  if (request.action === 'fetchSites') {
    fetchAndStoreSitesFromLocalStorage()
      .then(sites => sendResponse({ success: true, data: sites }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  // שינוי עיקרי: "החלת החוקים" משמעותה עכשיו רישום מחדש של המאזין
  if (request.action === 'applyRules') {
    registerOrUpdateWebRequestListeners()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

// הפעל את המאזין עם הפעלת ה-Service Worker
registerOrUpdateWebRequestListeners();