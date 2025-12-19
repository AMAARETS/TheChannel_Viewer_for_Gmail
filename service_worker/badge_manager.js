const API_ENDPOINT = '/api/messages?offset=0&limit=0';
const UNREAD_STATUS_KEY = 'theChannel_unsupported_domains_session'; 
const PERSISTENT_UNREAD_KEY = 'theChannel_unread_status_cache'; 
const MUTED_DOMAINS_KEY = 'theChannel_muted_domains';
const ALARM_NAME = 'check_unread_messages_alarm';
const CHECK_INTERVAL_MINUTES = 1;

const EXCLUDED_DOMAINS = [
    'mail.google.com', 'www.google.com', 'accounts.google.com', 'contacts.google.com', 'keep.google.com'
];

let unsupportedDomainsCache = new Set();
let currentUnreadSet = new Set(); 
let mutedDomainsCache = new Set(); 
let lastReadIdsCache = {}; 

let isCacheLoaded = false;
let isFullCheckInProgress = false;

// --- Load Cache ---
async function loadCache() {
    try {
        const localResult = await chrome.storage.local.get([PERSISTENT_UNREAD_KEY]);
        const unreadList = localResult[PERSISTENT_UNREAD_KEY] || [];
        currentUnreadSet = new Set(unreadList);

        const sessionResult = await chrome.storage.session.get([UNREAD_STATUS_KEY]);
        const unsupportedList = sessionResult[UNREAD_STATUS_KEY] || [];
        unsupportedDomainsCache = new Set(unsupportedList);

        const syncResult = await chrome.storage.sync.get(null);
        
        const mutedList = syncResult[MUTED_DOMAINS_KEY] || [];
        mutedDomainsCache = new Set(mutedList);

        lastReadIdsCache = {};
        Object.keys(syncResult).forEach(key => {
            if (key.startsWith('sync_data_')) {
                const domain = key.replace('sync_data_', '');
                if (syncResult[key] && syncResult[key].lastReadMessage) {
                    lastReadIdsCache[domain] = parseInt(syncResult[key].lastReadMessage);
                }
            }
        });
        isCacheLoaded = true;
    } catch (e) {
        console.error('Badge Manager: Error loading cache', e);
        isCacheLoaded = true;
    }
}

async function markDomainAsUnsupported(domain) {
    if (unsupportedDomainsCache.has(domain)) return;
    unsupportedDomainsCache.add(domain);
    await chrome.storage.session.set({ [UNREAD_STATUS_KEY]: Array.from(unsupportedDomainsCache) });
}

function getLastReadIdFromCache(domain) {
    return lastReadIdsCache[domain] || 0;
}

export async function handleDirectUpdate(domain, payload) {
    if (!isCacheLoaded) await loadCache();
    
    if (mutedDomainsCache.has(domain)) return;

    if (payload && payload.lastReadMessage) {
        const newMessageId = parseInt(payload.lastReadMessage);
        const currentId = lastReadIdsCache[domain] || 0;
        
        if (newMessageId > currentId) {
            lastReadIdsCache[domain] = newMessageId;
            checkUnreadMessages([domain]);
        }
    }
}

async function fetchLatestMessageId(domain) {
    const url = `https://${domain}${API_ENDPOINT}`;
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); 

        const response = await fetch(url, { 
            method: 'GET',
            signal: controller.signal,
            cache: 'no-store'
        });
        clearTimeout(timeoutId);

        if (response.status === 404 || (response.headers.get('content-type') || '').includes('text/html')) {
            await markDomainAsUnsupported(domain);
            return null;
        }

        if (!response.ok) return null;
        let json;
        try { json = await response.json(); } catch (e) { return null; }

        let messages = null;
        if (Array.isArray(json)) messages = json;
        else if (json?.messages) messages = json.messages;

        if (messages) {
            if (messages.length === 0) return 0;
            if (messages[0]?.id) return parseInt(messages[0].id);
        }
        return null;
    } catch (error) {
        return null;
    }
}

async function broadcastUnreadDomains() {
    const unreadList = Array.from(currentUnreadSet).filter(d => !mutedDomainsCache.has(d));
    
    if (unreadList.length !== currentUnreadSet.size) {
        currentUnreadSet = new Set(unreadList);
    }

    const message = { type: 'UNREAD_STATUS_UPDATE', payload: unreadList };
    chrome.storage.local.set({ [PERSISTENT_UNREAD_KEY]: unreadList });

    if (unreadList.length > 0) {
        chrome.action.setBadgeText({ text: unreadList.length.toString() });
        chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
    } else {
        chrome.action.setBadgeText({ text: '' });
    }

    try {
        // *** תיקון: הוספת localhost גם כאן ***
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
    } catch (e) { }
}

async function checkSingleDomainStatus(domain) {
    const remoteId = await fetchLatestMessageId(domain);
    if (remoteId === null || remoteId === 0) return false;
    const localId = getLastReadIdFromCache(domain);
    return remoteId > localId;
}

async function checkUnreadMessages(specificDomains = null) {
    if (!isCacheLoaded) await loadCache();

    if (specificDomains && Array.isArray(specificDomains) && specificDomains.length > 0) {
        await Promise.all(specificDomains.map(async (domain) => {
            if (unsupportedDomainsCache.has(domain) || mutedDomainsCache.has(domain)) {
                currentUnreadSet.delete(domain);
                return;
            }
            
            const isUnread = await checkSingleDomainStatus(domain);
            if (isUnread) currentUnreadSet.add(domain);
            else currentUnreadSet.delete(domain); 
        }));
        broadcastUnreadDomains();
        return;
    }

    if (isFullCheckInProgress) return;
    isFullCheckInProgress = true;

    try {
        let domainsToCheck = [];
        
        const storageResult = await chrome.storage.sync.get(['theChannelViewerSettings']);
        const settings = storageResult['theChannelViewerSettings'] || {};
        const categories = settings.categories || [];
        
        const userEnabledDomains = new Set();
        if (Array.isArray(categories)) {
            categories.forEach(cat => {
                if (Array.isArray(cat.sites)) {
                    cat.sites.forEach(site => {
                        try {
                            const url = new URL(site.url);
                            userEnabledDomains.add(url.hostname);
                        } catch (e) { }
                    });
                }
            });
        }

        const permissions = await chrome.permissions.getAll();
        const origins = permissions.origins || [];
        const permittedDomains = new Set(origins.map(o => {
            try { return new URL(o.replace('*://', 'https://').replace('/*', '')).hostname; } catch { return null; }
        }).filter(Boolean));

        domainsToCheck = [...userEnabledDomains].filter(domain => 
            permittedDomains.has(domain) &&
            !EXCLUDED_DOMAINS.includes(domain) && 
            !unsupportedDomainsCache.has(domain) &&
            !mutedDomainsCache.has(domain)
        );

        if (domainsToCheck.length === 0) {
            currentUnreadSet.clear();
            broadcastUnreadDomains();
            return;
        }

        for (const activeUnread of currentUnreadSet) {
             if (!domainsToCheck.includes(activeUnread)) {
                 currentUnreadSet.delete(activeUnread);
             }
        }

        await Promise.all(domainsToCheck.map(async (domain) => {
            const isUnread = await checkSingleDomainStatus(domain);
            if (isUnread) currentUnreadSet.add(domain);
            else currentUnreadSet.delete(domain);
        }));

        broadcastUnreadDomains();

    } catch (err) {
        console.error('Critical error in full check:', err);
    } finally {
        isFullCheckInProgress = false;
    }
}

export async function getUnreadDomains() {
    if (!isCacheLoaded) await loadCache();
    const result = Array.from(currentUnreadSet).filter(d => !mutedDomainsCache.has(d));
    checkUnreadMessages(); 
    return result;
}

export function initBadgeManager() {
    loadCache().then(() => {
        setTimeout(() => checkUnreadMessages(), 2000);
    });

    chrome.alarms.get(ALARM_NAME, (alarm) => {
        if (!alarm) chrome.alarms.create(ALARM_NAME, { periodInMinutes: CHECK_INTERVAL_MINUTES });
    });

    chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === ALARM_NAME) checkUnreadMessages();
    });
    
    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'sync') {
            if (changes[MUTED_DOMAINS_KEY]) {
                const newMutedList = changes[MUTED_DOMAINS_KEY].newValue || [];
                mutedDomainsCache = new Set(newMutedList);
                checkUnreadMessages(); 
            }

            const changedDomains = [];
            Object.keys(changes).forEach(key => {
                if (key.startsWith('sync_data_')) {
                    const domain = key.replace('sync_data_', '');
                    
                    if (mutedDomainsCache.has(domain)) return;

                    const newValue = changes[key].newValue;
                    if (newValue && newValue.lastReadMessage) {
                        const newId = parseInt(newValue.lastReadMessage);
                        if (newId > (lastReadIdsCache[domain] || 0)) {
                            lastReadIdsCache[domain] = newId;
                            changedDomains.push(domain);
                        }
                    }
                }
            });
            if (changedDomains.length > 0) {
                checkUnreadMessages(changedDomains);
            }
        }
    });
}