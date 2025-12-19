// --- ייבוא מודולים ---
import './injection_manager.js';
import { initBadgeManager, getUnreadDomains, handleDirectUpdate } from './badge_manager.js';

const SETTINGS_STORAGE_KEY = 'theChannelViewerSettings';
const SETTINGS_TIMESTAMP_KEY = 'theChannelViewerSettingsTimestamp';
const MUTED_DOMAINS_KEY = 'theChannel_muted_domains';

// --- אתחול מנהל ההתראות (Badge) ---
initBadgeManager();

async function getSettingsWithTimestamp() {
  try {
    const data = await chrome.storage.sync.get([SETTINGS_STORAGE_KEY, SETTINGS_TIMESTAMP_KEY]);
    const version = chrome.runtime.getManifest().version;
    
    return {
      settings: data[SETTINGS_STORAGE_KEY] || {},
      lastModified: data[SETTINGS_TIMESTAMP_KEY] || null,
      extensionVersion: version
    };
  } catch (error) {
    console.error('TheChannel Viewer: Error getting settings...', error);
    return { settings: {}, lastModified: null, extensionVersion: null };
  }
}

async function saveSettings(settings, timestamp) {
  try {
    const currentData = await chrome.storage.sync.get(SETTINGS_TIMESTAMP_KEY);
    const currentTimestamp = currentData[SETTINGS_TIMESTAMP_KEY] || 0;

    // שמירה רק אם המידע הנכנס חדש יותר מהקיים בענן
    if (timestamp > currentTimestamp) {
      await chrome.storage.sync.set({
        [SETTINGS_STORAGE_KEY]: settings,
        [SETTINGS_TIMESTAMP_KEY]: timestamp
      });
      console.log('TheChannel Viewer: Settings saved to sync storage.');
    }
  } catch (error) {
    console.error('TheChannel Viewer: Error saving settings to sync storage.', error);
  }
}

async function broadcastSettingsUpdate(settings, timestamp) {
  const version = chrome.runtime.getManifest().version;
  const message = {
    type: 'SETTINGS_DATA_UPDATE',
    payload: {
      settings: settings,
      lastModified: timestamp,
      extensionVersion: version
    }
  };

  try {
    const tabs = await chrome.tabs.query({ 
      url: [
        "*://thechannel-viewer.clickandgo.cfd/*", 
        "*://mail.google.com/*",
        "*://localhost/*" 
      ] 
    });
    for (const tab of tabs) {
      if (tab.id) chrome.tabs.sendMessage(tab.id, message).catch(() => {});
    }
  } catch (e) {}
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

async function getMutedDomains() {
    try {
        const result = await chrome.storage.sync.get([MUTED_DOMAINS_KEY]);
        return result[MUTED_DOMAINS_KEY] || [];
    } catch (e) {
        console.error('Error fetching muted domains:', e);
        return [];
    }
}

async function toggleMuteDomain(domain) {
    try {
        const result = await chrome.storage.sync.get([MUTED_DOMAINS_KEY]);
        let mutedList = result[MUTED_DOMAINS_KEY] || [];
        const mutedSet = new Set(mutedList);

        if (mutedSet.has(domain)) {
            mutedSet.delete(domain);
        } else {
            mutedSet.add(domain);
        }

        const newList = Array.from(mutedSet);
        await chrome.storage.sync.set({ [MUTED_DOMAINS_KEY]: newList });
        broadcastMutedDomainsUpdate(newList);
        return newList;
    } catch (e) {
        console.error('Error toggling mute:', e);
        return [];
    }
}

async function broadcastMutedDomainsUpdate(newList) {
    try {
        const tabs = await chrome.tabs.query({ 
            url: [
                "*://thechannel-viewer.clickandgo.cfd/*", 
                "*://mail.google.com/*",
                "*://localhost/*" 
            ] 
        });
        for (const tab of tabs) {
            if (tab.id) chrome.tabs.sendMessage(tab.id, { 
                type: 'MUTED_DOMAINS_UPDATE', 
                payload: newList 
            }).catch(() => {});
        }
    } catch (e) { }
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
  for (const domain of domains) {
    try {
      const cookies = await chrome.cookies.getAll({ domain: domain });
      for (const cookie of cookies) {
        await fixCookie(cookie);
      }
    } catch (error) {}
  }
}

chrome.cookies.onChanged.addListener(handleCookieChange);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'DIRECT_SYNC_UPDATE') {
      if (request.domain && request.payload) {
          handleDirectUpdate(request.domain, request.payload);
      }
      return false;
  }

  if (request.type === 'GET_SETTINGS') {
    getSettingsWithTimestamp().then(sendResponse);
    return true;
  }

  if (request.type === 'SAVE_SETTINGS') {
    if (request.payload && request.payload.settings && request.payload.lastModified) {
      saveSettings(request.payload.settings, request.payload.lastModified).then(() => sendResponse({ success: true }));
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

  if (request.type === 'GET_MUTED_DOMAINS') {
    getMutedDomains().then(sendResponse);
    return true;
  }

  if (request.type === 'TOGGLE_MUTE_DOMAIN' && request.domain) {
    toggleMuteDomain(request.domain).then(sendResponse);
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
        type: 'popup', width, height, left, top, focused: true
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
      sendResponse({ success: true });
    }
    return true;
  }

  return false;
});

// מאזין לשינויים ב-Storage לסנכרון בין טאבים ומופעים
chrome.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName === 'sync') {
        // השתקות
        if (changes[MUTED_DOMAINS_KEY]) {
            broadcastMutedDomainsUpdate(changes[MUTED_DOMAINS_KEY].newValue || []);
        }

        // הגדרות אפליקציה (קטגוריות וכו')
        if (changes[SETTINGS_STORAGE_KEY]) {
            const newSettings = changes[SETTINGS_STORAGE_KEY].newValue;
            const timestampData = await chrome.storage.sync.get(SETTINGS_TIMESTAMP_KEY);
            broadcastSettingsUpdate(newSettings, timestampData[SETTINGS_TIMESTAMP_KEY]);
        }
    }
});

chrome.permissions.onAdded.addListener(async (permissions) => {
  if (permissions.origins && permissions.origins.length > 0) {
    const domains = permissions.origins.map(origin => {
      try { return new URL(origin.replace('*://', 'https://').replace('/*', '')).hostname; } catch { return null; }
    }).filter(Boolean);
    if (domains.length > 0) fixCookiesForDomains(domains);
  }
});