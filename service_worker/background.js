// קובץ זה הוא ה-Service Worker של התוסף. הוא רץ ברקע ומנהל את הלוגיקה המרכזית.

const SETTINGS_STORAGE_KEY = 'theChannelViewerSettings';

// --- ניהול הגדרות ---

/**
 * טוען את כל ההגדרות מהאחסון המסונכרן.
 * @returns {Promise<object>} אובייקט ההגדרות או אובייקט ריק.
 */
async function getSettings() {
  try {
    const data = await chrome.storage.sync.get(SETTINGS_STORAGE_KEY);
    return data[SETTINGS_STORAGE_KEY] || {};
  } catch (error) {
    console.error('TheChannel Viewer: Error getting settings from sync storage.', error);
    return {};
  }
}

/**
 * שומר את כל אובייקט ההגדרות באחסון המסונכרן.
 * @param {object} settings - אובייקט ההגדרות המלא לשמירה.
 */
async function saveSettings(settings) {
  try {
    await chrome.storage.sync.set({ [SETTINGS_STORAGE_KEY]: settings });
    console.log('TheChannel Viewer: Settings saved to sync storage.');
  } catch (error) {
    console.error('TheChannel Viewer: Error saving settings to sync storage.', error);
  }
}

/**
 * שולף את רשימת הדומיינים של האתרים מתוך אובייקט ההגדרות.
 * @returns {Promise<string[]>} מערך של דומיינים.
 */
async function getManagedDomains() {
  const settings = await getSettings();
  if (!settings.categories || !Array.isArray(settings.categories)) {
    return [];
  }

  const urls = settings.categories.reduce((acc, category) => {
    if (category && Array.isArray(category.sites)) {
      category.sites.forEach(site => {
        if (site && typeof site.url === 'string') {
          acc.push(site.url);
        }
      });
    }
    return acc;
  }, []);

  return [...new Set(urls.map(url => {
    try { return new URL(url).hostname; } catch { return null; }
  }).filter(Boolean))];
}


// --- לוגיקת שינוי העוגיות ---

/**
 * פונקציית עזר לתיקון עוגייה בודדת.
 * @param {chrome.cookies.Cookie} cookie - אובייקט העוגייה לתיקון.
 */
async function fixCookie(cookie) {
  // התעלם מעוגיות גוגל, עוגיות מאובטחות מראש, או עוגיות שכבר תוקנו
  if (cookie.domain.includes('google.com') || cookie.name.startsWith('__Host-') || cookie.name.startsWith('__Secure-')) {
    return;
  }
  if (cookie.sameSite === 'no_restriction') {
    return;
  }

  console.log(`TheChannel Viewer: Fixing cookie "${cookie.name}" for domain ${cookie.domain}.`);
  
  const url = `https://${cookie.domain.replace(/^\./, '')}${cookie.path}`;
  
  try {
    // 1. מחק את העוגייה הישנה כדי למנוע התנגשויות
    await chrome.cookies.remove({ url: url, name: cookie.name });

    // 2. צור את העוגייה החדשה עם ההגדרות הנכונות
    await chrome.cookies.set({
      url: url,
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path,
      httpOnly: cookie.httpOnly,
      expirationDate: cookie.expirationDate,
      sameSite: 'no_restriction',
      secure: true
    });
    console.log(`TheChannel Viewer: Cookie "${cookie.name}" was successfully replaced.`);
  } catch (error) {
    console.error(`TheChannel Viewer: Failed to modify cookie "${cookie.name}". Error:`, error.message);
  }
}

/**
 * מאזין לשינויים בעוגיות ומתקן אותן בזמן אמת.
 */
async function handleCookieChange(changeInfo) {
  if (changeInfo.removed) return;
  
  const managedDomains = await getManagedDomains();
  if (!managedDomains || managedDomains.length === 0) return;
  
  const isManagedDomain = managedDomains.some(managedDomain => changeInfo.cookie.domain.endsWith(managedDomain));
  if (isManagedDomain) {
    await fixCookie(changeInfo.cookie);
  }
}

/**
 * פונקציה חדשה: סורקת ומתקנת את כל העוגיות הקיימות עבור רשימת דומיינים.
 * @param {string[]} domains - מערך של דומיינים לסריקה.
 */
async function fixCookiesForDomains(domains) {
  if (!domains || domains.length === 0) return;
  console.log(`TheChannel Viewer: Starting proactive cookie fix for domains:`, domains);

  for (const domain of domains) {
    try {
      const cookies = await chrome.cookies.getAll({ domain: domain });
      for (const cookie of cookies) {
        await fixCookie(cookie);
      }
    } catch (error) {
      console.error(`TheChannel Viewer: Could not get cookies for domain ${domain}.`, error);
    }
  }
  console.log('TheChannel Viewer: Proactive cookie fix finished.');
}


chrome.cookies.onChanged.addListener(handleCookieChange);

// --- מאזין להודעות מה-content script ומה-popup ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // --- בקשות מה-content script ---
  if (request.type === 'GET_SETTINGS') {
    getSettings().then(sendResponse);
    return true; // נדרש עבור sendResponse אסינכרוני
  }

  if (request.type === 'SAVE_SETTINGS') {
    if (request.payload) {
      saveSettings(request.payload).then(() => sendResponse({ success: true }));
    } else {
      sendResponse({ success: false, error: 'No payload received' });
    }
    return true;
  }
  
  // --- בקשות מה-popup ---
  if (request.action === 'fetchSites') {
    getManagedDomains()
      .then(sites => sendResponse({ success: true, data: sites }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  // חדש: בקשה להפעיל תיקון יזום של עוגיות
  if (request.action === 'triggerCookieFix') {
    if (request.domains && Array.isArray(request.domains)) {
      // הפעל את הפונקציה ואל תחכה לסיומה כדי שהפופאפ לא ייתקע
      fixCookiesForDomains(request.domains); 
      sendResponse({ success: true, message: 'Cookie fix process initiated.' });
    } else {
      sendResponse({ success: false, error: 'No domains provided.' });
    }
    return true; // אין צורך להפוך לאסינכרוני כאן
  }
  
  return false;
});