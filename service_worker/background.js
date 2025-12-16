// --- ייבוא מודולים ---
import './injection_manager.js';
// ייבוא הפונקציה החדשה handleDirectUpdate
import { initBadgeManager, getUnreadDomains, handleDirectUpdate } from './badge_manager.js';

const SETTINGS_STORAGE_KEY = 'theChannelViewerSettings';
const SETTINGS_TIMESTAMP_KEY = 'theChannelViewerSettingsTimestamp';

// --- אתחול מנהל ההתראות (Badge) ---
initBadgeManager();

// ... (שאר הפונקציות ללא שינוי: getSettingsWithTimestamp, saveSettings, וכו') ...
// יש להעתיק את כל הפונקציות הקיימות בקובץ המקורי עד ל-chrome.runtime.onMessage.addListener

async function getSettingsWithTimestamp() {
  try {
    const data = await chrome.storage.sync.get([SETTINGS_STORAGE_KEY, SETTINGS_TIMESTAMP_KEY]);
    return {
      settings: data[SETTINGS_STORAGE_KEY] || {},
      lastModified: data[SETTINGS_TIMESTAMP_KEY] || null
    };
  } catch (error) {
    console.error('TheChannel Viewer: Error getting settings from sync storage.', error);
    return { settings: {}, lastModified: null };
  }
}

async function saveSettings(settings, timestamp) {
  try {
    const currentData = await chrome.storage.sync.get(SETTINGS_TIMESTAMP_KEY);
    const currentTimestamp = currentData[SETTINGS_TIMESTAMP_KEY] || 0;

    if (timestamp > currentTimestamp) {
      await chrome.storage.sync.set({
        [SETTINGS_STORAGE_KEY]: settings,
        [SETTINGS_TIMESTAMP_KEY]: timestamp
      });
      console.log('TheChannel Viewer: Settings saved to sync storage with new timestamp.');
    } else {
      console.log('TheChannel Viewer: Received settings are outdated, not saving.');
    }
  } catch (error) {
    console.error('TheChannel Viewer: Error saving settings to sync storage.', error);
  }
}

async function getSitesWithNames() {
  const { settings } = await getSettingsWithTimestamp();
  if (!settings.categories || !Array.isArray(settings.categories)) {
    return [];
  }
  const sitesMap = new Map();
  settings.categories.forEach(category => {
    if (category && Array.isArray(category.sites)) {
      category.sites.forEach(site => {
        if (site && typeof site.url === 'string') {
          try {
            const domain = new URL(site.url).hostname;
            if (!sitesMap.has(domain)) {
              sitesMap.set(domain, {
                name: site.name || domain,
                domain: domain
              });
            }
          } catch { }
        }
      });
    }
  });
  return Array.from(sitesMap.values());
}

async function getManagedDomains() {
  try {
    const permissions = await chrome.permissions.getAll();
    const origins = permissions.origins || [];
    const domains = origins
      .map(origin => {
        try {
          return new URL(origin.replace('*://', 'https://').replace('/*', '')).hostname;
        } catch {
          return null;
        }
      })
      .filter(Boolean);
    return [...new Set(domains)];
  } catch (error) {
    console.error('TheChannel Viewer: Error getting managed domains.', error);
    return [];
  }
}

async function fixCookie(cookie) {
  if (cookie.domain.includes('google.com') || cookie.name.startsWith('__Host-') || cookie.name.startsWith('__Secure-')) {
    return;
  }
  if (cookie.sameSite === 'no_restriction') {
    return;
  }
  const url = `https://${cookie.domain.replace(/^\./, '')}${cookie.path}`;
  try {
    await chrome.cookies.remove({ url: url, name: cookie.name });
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
  } catch (error) { }
}

async function handleCookieChange(changeInfo) {
  if (changeInfo.removed) return;
  const managedDomains = await getManagedDomains();
  if (!managedDomains || managedDomains.length === 0) return;
  const isManagedDomain = managedDomains.some(managedDomain => changeInfo.cookie.domain.endsWith(managedDomain));
  if (isManagedDomain) {
    await fixCookie(changeInfo.cookie);
  }
}

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

// --- מאזין להודעות ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // --- טיפול בהודעה החדשה (מסלול מהיר) ---
  if (request.type === 'DIRECT_SYNC_UPDATE') {
      if (request.domain && request.payload) {
          handleDirectUpdate(request.domain, request.payload);
      }
      return false; // לא מחזיר תשובה אסינכרונית
  }

  // --- שאר ההודעות הקיימות ---
  if (request.type === 'GET_SETTINGS') {
    getSettingsWithTimestamp().then(sendResponse);
    return true;
  }

  if (request.type === 'SAVE_SETTINGS') {
    if (request.payload && request.payload.settings && request.payload.lastModified) {
      saveSettings(request.payload.settings, request.payload.lastModified).then(() => sendResponse({ success: true }));
    } else {
      sendResponse({ success: false, error: 'Payload with settings and timestamp is required' });
    }
    return true;
  }

  if (request.type === 'GET_MANAGED_DOMAINS') {
    getManagedDomains().then(sendResponse);
    return true;
  }
  
  if (request.type === 'GET_UNREAD_STATUS') {
    getUnreadDomains().then(sendResponse);
    return true;
  }

  if (request.type === 'OPEN_PERMISSION_POPUP' && request.domain) {
    const width = 420;
    const height = 480;

    chrome.windows.getLastFocused((currentWindow) => {
      let left = 100;
      let top = 100;

      if (currentWindow && currentWindow.width) {
        left = Math.round((currentWindow.width - width) / 2 + (currentWindow.left || 0));
        top = Math.round((currentWindow.height - height) / 2 + (currentWindow.top || 0));
      }

      const siteName = request.name || request.domain;

      chrome.windows.create({
        url: `permission_request/permission_request.html?domain=${encodeURIComponent(request.domain)}&name=${encodeURIComponent(siteName)}`,
        type: 'popup',
        width: width,
        height: height,
        left: left,
        top: top,
        focused: true
      }, (createdWindow) => {
        if (chrome.runtime.lastError) {
          console.error("TheChannel Viewer: Failed to create popup window:", chrome.runtime.lastError);
        }
      });
    });

    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'fetchSites') {
    getSitesWithNames()
      .then(sites => sendResponse({ success: true, data: sites }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'triggerCookieFix') {
    if (request.domains && Array.isArray(request.domains)) {
      fixCookiesForDomains(request.domains);
      sendResponse({ success: true, message: 'Cookie fix process initiated.' });
    } else {
      sendResponse({ success: false, error: 'No domains provided.' });
    }
    return true;
  }

  return false;
});

chrome.permissions.onAdded.addListener(async (permissions) => {
  if (permissions.origins && permissions.origins.length > 0) {
    const domains = permissions.origins.map(origin => {
      try {
        return new URL(origin.replace('*://', 'https://').replace('/*', '')).hostname;
      } catch (e) {
        return null;
      }
    }).filter(Boolean);

    if (domains.length > 0) {
      fixCookiesForDomains(domains);
    }
  }
});