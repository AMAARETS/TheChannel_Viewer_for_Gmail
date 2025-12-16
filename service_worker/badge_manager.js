const API_ENDPOINT = '/api/messages?offset=0&limit=0';
const UNREAD_STATUS_KEY = 'theChannel_unsupported_domains_session'; // מפתח לשמירה בסשן
const PERSISTENT_UNREAD_KEY = 'theChannel_unread_status_cache'; // מפתח לשמירה בדיסק
const ALARM_NAME = 'check_unread_messages_alarm';
const CHECK_INTERVAL_MINUTES = 1;

const EXCLUDED_DOMAINS = [
    'mail.google.com', 'www.google.com', 'accounts.google.com', 'contacts.google.com', 'keep.google.com'
];

// --- In-Memory State (למהירות מקסימלית בזמן ריצה) ---
let unsupportedDomainsCache = new Set();
let currentUnreadSet = new Set(); 
let lastReadIdsCache = {}; 

let isCacheLoaded = false;
let isFullCheckInProgress = false;

// --- טעינת נתונים ---
async function loadCache() {
    try {
        // 1. טעינת הסטטוס הקבוע מהדיסק (Local)
        const localResult = await chrome.storage.local.get([PERSISTENT_UNREAD_KEY]);
        const unreadList = localResult[PERSISTENT_UNREAD_KEY] || [];
        currentUnreadSet = new Set(unreadList);

        // 2. טעינת רשימת הלא-נתמכים מה-SESSION (זה התיקון!)
        // זה ישרוד נפילות של ה-Service Worker אבל יימחק בסגירת כרום
        const sessionResult = await chrome.storage.session.get([UNREAD_STATUS_KEY]);
        const unsupportedList = sessionResult[UNREAD_STATUS_KEY] || [];
        unsupportedDomainsCache = new Set(unsupportedList);

        // 3. טעינת מידע מסונכרן
        const syncResult = await chrome.storage.sync.get(null);
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
    
    console.log(`Badge Manager: Marking ${domain} as unsupported (Session).`);
    
    // עדכון הזיכרון המיידי
    unsupportedDomainsCache.add(domain);
    
    // עדכון ה-Session Storage (כדי שישרוד אם ה-SW מת)
    await chrome.storage.session.set({ 
        [UNREAD_STATUS_KEY]: Array.from(unsupportedDomainsCache) 
    });
}

function getLastReadIdFromCache(domain) {
    return lastReadIdsCache[domain] || 0;
}

// --- פונקציית בדיקת רשת ---
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

// --- עדכון תצוגה ---
async function broadcastUnreadDomains() {
    const unreadList = Array.from(currentUnreadSet);
    const message = { type: 'UNREAD_STATUS_UPDATE', payload: unreadList };

    // שומרים את הסטטוס בדיסק כדי שיוצג מיד בפתיחה הבאה
    chrome.storage.local.set({ [PERSISTENT_UNREAD_KEY]: unreadList });

    if (unreadList.length > 0) {
        chrome.action.setBadgeText({ text: unreadList.length.toString() });
        chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
    } else {
        chrome.action.setBadgeText({ text: '' });
    }

    try {
        const tabs = await chrome.tabs.query({ url: ["*://thechannel-viewer.clickandgo.cfd/*", "*://mail.google.com/*"] });
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

// --- הפונקציה הראשית ---
async function checkUnreadMessages(specificDomains = null) {
    if (!isCacheLoaded) await loadCache();

    // נתיב מהיר
    if (specificDomains && Array.isArray(specificDomains) && specificDomains.length > 0) {
        await Promise.all(specificDomains.map(async (domain) => {
            if (unsupportedDomainsCache.has(domain)) return;
            const isUnread = await checkSingleDomainStatus(domain);
            if (isUnread) currentUnreadSet.add(domain);
            else currentUnreadSet.delete(domain);
        }));
        broadcastUnreadDomains();
        return;
    }

    // נתיב איטי (בדיקה מלאה)
    if (isFullCheckInProgress) return;
    isFullCheckInProgress = true;

    try {
        let domainsToCheck = [];
        try {
            const permissions = await chrome.permissions.getAll();
            const origins = permissions.origins || [];
            const managedDomains = origins
                .map(o => { try { return new URL(o.replace('*://', 'https://').replace('/*', '')).hostname; } catch { return null; } })
                .filter(Boolean);

            domainsToCheck = [...new Set(managedDomains)].filter(d => 
                !EXCLUDED_DOMAINS.includes(d) && !unsupportedDomainsCache.has(d)
            );
        } catch (e) { return; }

        if (domainsToCheck.length === 0) {
            currentUnreadSet.clear();
            broadcastUnreadDomains();
            return;
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
    const result = Array.from(currentUnreadSet);
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
            const changedDomains = [];
            Object.keys(changes).forEach(key => {
                if (key.startsWith('sync_data_')) {
                    const domain = key.replace('sync_data_', '');
                    const newValue = changes[key].newValue;
                    if (newValue && newValue.lastReadMessage) {
                        lastReadIdsCache[domain] = parseInt(newValue.lastReadMessage);
                    }
                    changedDomains.push(domain);
                }
            });
            if (changedDomains.length > 0) {
                checkUnreadMessages(changedDomains);
            }
        }
    });
}