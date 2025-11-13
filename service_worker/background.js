// קובץ זה הוא ה-Service Worker של התוסף. הוא רץ ברקע ומנהל את הלוגיקה המרכזית.

const TARGET_SITE_URL = 'https://thechannel-viewer.clickandgo.cfd/';
const SITES_STORAGE_KEY = 'theChannelSites';

// --- לוגיקת שליפת רשימת האתרים (שופרה לאמינות מירבית) ---

/**
 * פונקציה זו תוזרק לדף. היא מבצעת משימה אחת פשוטה:
 * ממתינה עד שהמפתח יופיע ב-localStorage ומחזירה את ערכו כמחרוזת גולמית.
 * @returns {Promise<string|null>}
 */
async function getRawDataFromLocalStorage() {
  const LOCAL_STORAGE_KEY = 'userChannelCategories';
  const POLLING_INTERVAL = 250;
  const TIMEOUT = 7000; // הגדלנו מעט את הזמן למקרה של טעינה איטית

  return new Promise((resolve, reject) => {
    let elapsedTime = 0;
    const intervalId = setInterval(() => {
      elapsedTime += POLLING_INTERVAL;
      if (elapsedTime >= TIMEOUT) {
        clearInterval(intervalId);
        // במקום לדחות עם שגיאה, נחזיר null כדי שה-popup יוכל להציג הודעה ברורה
        resolve(null);
        return;
      }
      const dataStr = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (dataStr) {
        clearInterval(intervalId);
        resolve(dataStr);
      }
    }, POLLING_INTERVAL);
  });
}

/**
 * תהליך שליפת הנתונים, שופר כך שהעיבוד מתבצע ב-Service Worker.
 */
async function fetchAndStoreSitesFromLocalStorage() {
  let tempTab = null;
  try {
    tempTab = await chrome.tabs.create({ url: TARGET_SITE_URL, active: false });
    const results = await chrome.scripting.executeScript({
      target: { tabId: tempTab.id },
      func: getRawDataFromLocalStorage
    });

    const rawData = results?.[0]?.result;
    if (!rawData) {
      throw new Error('לא נמצאו נתונים ב-LocalStorage של האתר. ייתכן שיש צורך להתחבר לחשבון תחילה.');
    }

    // תיקון: העיבוד מתבצע כאן, בסביבה בטוחה יותר.
    const categories = JSON.parse(rawData);
    const urls = categories.reduce((acc, category) => {
      if (category && Array.isArray(category.sites)) {
        category.sites.forEach(site => {
          if (site && typeof site.url === 'string') {
            acc.push(site.url);
          }
        });
      }
      return acc;
    }, []);

    const domains = [...new Set(urls.map(url => {
      try { return new URL(url).hostname; } catch { return null; }
    }).filter(Boolean))];

    await chrome.storage.local.set({ [SITES_STORAGE_KEY]: domains });
    console.log('TheChannel Viewer: רשימת האתרים עודכנה מ-LocalStorage ונשמרה.', domains);
    return domains;

  } catch (error) {
    console.error('TheChannel Viewer: נכשלה שליפת הנתונים מ-LocalStorage.', error);
    throw error; // העבר את השגיאה הלאה כדי שה-popup יציג אותה
  } finally {
    if (tempTab) await chrome.tabs.remove(tempTab.id);
  }
}

async function getStoredSites() {
  const data = await chrome.storage.local.get(SITES_STORAGE_KEY);
  return data[SITES_STORAGE_KEY] || [];
}

// --- לוגיקת שינוי העוגיות (עם הגנות משופרות) ---

/**
 * המאזין הראשי לשינויים בעוגיות, כעת עם הגנות חזקות.
 * @param {chrome.cookies.CookieChangeInfo} changeInfo
 */
async function handleCookieChange(changeInfo) {
  if (changeInfo.removed) return;

  const { cookie } = changeInfo;

  // הגנה קריטית #1: לעולם אל תיגע בעוגיות של Google.
  // זה פותר את השגיאה עם __Host-GMAIL_SCH ומונע בעיות אבטחה.
  if (cookie.domain.includes('google.com')) {
    return;
  }
  
  // הגנה קריטית #2: אל תיגע בעוגיות אבטחה מיוחדות.
  if (cookie.name.startsWith('__Host-') || cookie.name.startsWith('__Secure-')) {
    return;
  }

  // סינון יעילות: אם העוגייה כבר מתאימה, אין טעם להמשיך.
  if (cookie.sameSite === 'no_restriction') {
    return;
  }
  
  const managedDomains = await getStoredSites();
  if (!managedDomains || managedDomains.length === 0) return;
  
  const isManagedDomain = managedDomains.some(managedDomain => cookie.domain.endsWith(managedDomain));

  if (!isManagedDomain) return;

  console.log(`TheChannel Viewer: זוהתה עוגייה רלוונטית "${cookie.name}" לדומיין ${cookie.domain}. מתקן...`);
  
  try {
    const url = `https://${cookie.domain.replace(/^\./, '')}${cookie.path}`;
    
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
    console.log(`TheChannel Viewer: העוגייה "${cookie.name}" תוקנה בהצלחה.`);
  } catch (error) {
    console.error(`TheChannel Viewer: נכשל בתיקון העוגייה "${cookie.name}" לדומיין ${cookie.domain}. שגיאה:`, error.message);
  }
}

chrome.cookies.onChanged.addListener(handleCookieChange);


// --- מאזין להודעות מה-POPUP (ללא שינוי) ---
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

  if (request.action === 'applyRules') {
    sendResponse({ success: true });
    return true;
  }
});