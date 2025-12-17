/**
 * sync_manager.js
 * מנהל סנכרון רזה ומהיר.
 * מתמקד אך ורק בסנכרון ה-ID של ההודעה האחרונה שנקראה (lastReadMessage).
 * הוסר הטיפול בהיסטוריית שרשורים (thread_read_status) למניעת עומס וחריגת מכסות.
 */

(function() {
    if (window.hasTheChannelSync) return;
    window.hasTheChannelSync = true;

    const DOMAIN = window.location.hostname;
    const STORAGE_KEY_PREFIX = `sync_data_`; 
    const EXT_STORAGE_KEY = STORAGE_KEY_PREFIX + DOMAIN;
    
    const KEY_LAST_READ_MSG = 'lastReadMessage';

    let pollingIntervalId = null;
    let isContextInvalidated = false;
    let syncDebounceTimer = null;
    let isSyncInProgress = false;

    // מעקב אחר המצב האחרון הידוע כדי למנוע לולאות
    let lastKnownLastRead = localStorage.getItem(KEY_LAST_READ_MSG);

    let isInternalUpdate = false; 

    function handleContextInvalidated() {
        if (isContextInvalidated) return;
        isContextInvalidated = true;
        console.log('TheChannel Sync: Extension context invalidated.');
        if (pollingIntervalId) clearInterval(pollingIntervalId);
        if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
    }

    // --- מסלול מהיר: עדכון ישיר ל-Background ---
    // חיוני לעדכון מיידי של ה-Badge בג'ימייל
    function sendFastUpdate(lastReadMsg) {
        if (isContextInvalidated || !chrome.runtime?.id) return;
        try {
            chrome.runtime.sendMessage({
                type: 'DIRECT_SYNC_UPDATE',
                domain: DOMAIN,
                payload: {
                    lastReadMessage: parseInt(lastReadMsg || '0')
                }
            });
        } catch (e) {
            // התעלמות משגיאות במסלול המהיר
        }
    }

    // פונקציה לעדכון ה-localStorage באתר מתוך המידע שהגיע מהענן (מכשיר אחר)
    function updateSiteFromExtension(extData) {
        if (isInternalUpdate || isContextInvalidated) return;
        try {
            const extLastRead = extData[KEY_LAST_READ_MSG] || 0;
            const localLastReadStr = localStorage.getItem(KEY_LAST_READ_MSG);
            const localLastRead = parseInt(localLastReadStr || '0');

            // אנחנו תמיד לוקחים את המקסימום (ההודעה החדשה יותר)
            const mergedLastRead = Math.max(localLastRead, extLastRead);

            // אם המידע מהענן חדש יותר ממה שיש באתר, נעדכן את האתר
            if (mergedLastRead > localLastRead) {
                isInternalUpdate = true;
                localStorage.setItem(KEY_LAST_READ_MSG, mergedLastRead);
                lastKnownLastRead = mergedLastRead.toString();
                isInternalUpdate = false;
            }
        } catch (e) {
            isInternalUpdate = false;
        }
    }

    // פונקציה לשמירת המצב המקומי לענן (Chrome Sync)
    async function syncToExtension() {
        if (isInternalUpdate || isContextInvalidated || isSyncInProgress) return;
        
        const currentLastReadStr = localStorage.getItem(KEY_LAST_READ_MSG);
        
        // 1. קריאה למסלול המהיר מייד!
        sendFastUpdate(currentLastReadStr);

        isSyncInProgress = true;

        try {
            const localLastRead = parseInt(currentLastReadStr || '0');

            if (!chrome.runtime?.id) throw new Error('Extension context invalidated');

            // משיכת המידע הקיים בענן
            const extDataWrapper = await chrome.storage.sync.get(EXT_STORAGE_KEY);
            const extData = extDataWrapper[EXT_STORAGE_KEY] || {};
            
            const extLastRead = extData[KEY_LAST_READ_MSG] || 0;

            // בדיקה אם למשתמש המקומי יש מידע חדש יותר
            if (localLastRead > extLastRead) {
                // שמירה בענן - שומרים אובייקט קטן ונקי
                await chrome.storage.sync.set({
                    [EXT_STORAGE_KEY]: {
                        [KEY_LAST_READ_MSG]: localLastRead,
                        lastSync: Date.now()
                    }
                });
            } else if (extLastRead > localLastRead) {
                // מקרה נדיר: גילינו תוך כדי ניסיון שמירה שיש בענן מידע חדש יותר
                updateSiteFromExtension(extData);
            }

            lastKnownLastRead = currentLastReadStr;

        } catch (e) {
            if (e.message && e.message.includes('Extension context invalidated')) {
                handleContextInvalidated();
            } else {
                console.error('Sync Error', e);
            }
        } finally {
            isSyncInProgress = false;
        }
    }

    // דריסת setItem כדי לזהות שינויים בזמן אמת באתר
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
        originalSetItem.call(this, key, value);
        
        if (!isContextInvalidated && !isInternalUpdate && this === localStorage && key === KEY_LAST_READ_MSG) {
            
            // שליחה מיידית של עדכון מהיר
            sendFastUpdate(value);

            // תזמון סנכרון מלא לענן (Debounce)
            if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
            syncDebounceTimer = setTimeout(syncToExtension, 200);
        }
    };

    // מנגנון גיבוי (Polling) למקרה שפספסנו אירוע
    pollingIntervalId = setInterval(() => {
        if (isInternalUpdate || isContextInvalidated || isSyncInProgress) return;
        const currentLastRead = localStorage.getItem(KEY_LAST_READ_MSG);
        
        if (currentLastRead !== lastKnownLastRead) {
            syncToExtension(); 
        }
    }, 1000);

    // האזנה לשינויים שמגיעים ממכשירים אחרים (דרך Chrome Storage)
    try {
        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (isContextInvalidated) return;
            if (areaName === 'sync' && changes[EXT_STORAGE_KEY]) {
                const newValue = changes[EXT_STORAGE_KEY].newValue;
                if (newValue) updateSiteFromExtension(newValue);
            }
        });
    } catch (e) { handleContextInvalidated(); }

    // אתחול ראשוני
    try {
        setTimeout(() => {
            chrome.storage.sync.get(EXT_STORAGE_KEY, (data) => {
                if (chrome.runtime.lastError) return;
                if (data && data[EXT_STORAGE_KEY]) updateSiteFromExtension(data[EXT_STORAGE_KEY]);
                if (!isContextInvalidated) syncToExtension();
            });
        }, 500);
    } catch (e) { handleContextInvalidated(); }

    console.log(`TheChannel Sync Manager: Lite mode active on ${DOMAIN}`);
})();