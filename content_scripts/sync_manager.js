/**
 * sync_manager.js
 * מנהל סנכרון חכם ואגרסיבי.
 * כולל מנגנון רענון דף (Reload) כאשר מתקבל עדכון חיצוני.
 * כולל טיפול בשגיאות Extension context invalidated.
 */

(function() {
    if (window.hasTheChannelSync) return;
    window.hasTheChannelSync = true;

    const DOMAIN = window.location.hostname;
    const STORAGE_KEY_PREFIX = `sync_data_`; 
    const EXT_STORAGE_KEY = STORAGE_KEY_PREFIX + DOMAIN;
    
    const KEY_LAST_READ_MSG = 'lastReadMessage';
    const KEY_THREAD_STATUS = 'thread_read_status'; 

    // משתנה לשמירת ה-Interval כדי שנוכל לעצור אותו במקרה של ניתוק
    let pollingIntervalId = null;
    let isContextInvalidated = false;

    // שמירת מצב אחרון ידוע של האתר
    let lastKnownSiteState = {
        [KEY_LAST_READ_MSG]: localStorage.getItem(KEY_LAST_READ_MSG),
        [KEY_THREAD_STATUS]: localStorage.getItem(KEY_THREAD_STATUS)
    };

    let isInternalUpdate = false; 

    // פונקציית עזר לעצירת הסקריפט כשהתוסף מתנתק
    function handleContextInvalidated() {
        if (isContextInvalidated) return;
        isContextInvalidated = true;
        console.log('TheChannel Sync: Extension context invalidated. Stopping sync until page reload.');
        
        if (pollingIntervalId) {
            clearInterval(pollingIntervalId);
            pollingIntervalId = null;
        }
        
        // הסרת מאזינים אם אפשר (למרות שחלקם אנונימיים, הדגל isContextInvalidated יעצור אותם)
    }

    // --- לוגיקת מיזוג ---
    function mergeThreadStatuses(localArr, remoteArr, preferSource) {
        if (!Array.isArray(localArr)) localArr = [];
        if (!Array.isArray(remoteArr)) remoteArr = [];
        const map = new Map();

        remoteArr.forEach(item => {
            if (item?.messageId) map.set(item.messageId, { ...item });
        });

        localArr.forEach(localItem => {
            if (!localItem?.messageId) return;
            const remoteItem = map.get(localItem.messageId);

            if (!remoteItem) {
                map.set(localItem.messageId, { ...localItem });
            } else {
                const localTs = localItem.lastReadTimestamp || 0;
                const remoteTs = remoteItem.lastReadTimestamp || 0;
                const mergedCount = Math.max(localItem.lastReadCount || 0, remoteItem.lastReadCount || 0);
                const mergedTimestamp = Math.max(localTs, remoteTs);
                let mergedIsFollowing;

                if (localTs > remoteTs) {
                    mergedIsFollowing = localItem.isFollowing;
                } else if (remoteTs > localTs) {
                    mergedIsFollowing = remoteItem.isFollowing;
                } else {
                    mergedIsFollowing = (preferSource === 'local') ? localItem.isFollowing : remoteItem.isFollowing;
                }

                map.set(localItem.messageId, {
                    messageId: localItem.messageId,
                    lastReadCount: mergedCount,
                    lastReadTimestamp: mergedTimestamp,
                    isFollowing: mergedIsFollowing
                });
            }
        });
        return Array.from(map.values());
    }

    // --- עדכון האתר (Inbound) ---
    function updateSiteFromExtension(extData) {
        if (isInternalUpdate || isContextInvalidated) return;

        try {
            const extLastRead = extData[KEY_LAST_READ_MSG] || 0;
            const extThreadStatus = extData[KEY_THREAD_STATUS] || [];

            const localLastReadStr = localStorage.getItem(KEY_LAST_READ_MSG);
            const localThreadStatusStr = localStorage.getItem(KEY_THREAD_STATUS);
            
            const localLastRead = parseInt(localLastReadStr || '0');
            let localThreadStatus = [];
            try { localThreadStatus = localThreadStatusStr ? JSON.parse(localThreadStatusStr) : []; } catch(e){}

            const mergedLastRead = Math.max(localLastRead, extLastRead);
            const mergedThreadStatus = mergeThreadStatuses(localThreadStatus, extThreadStatus, 'remote');
            const mergedThreadStatusStr = JSON.stringify(mergedThreadStatus);

            let updated = false;
            isInternalUpdate = true;

            if (mergedLastRead > localLastRead) {
                localStorage.setItem(KEY_LAST_READ_MSG, mergedLastRead);
                lastKnownSiteState[KEY_LAST_READ_MSG] = mergedLastRead.toString();
                updated = true;
            }

            if (mergedThreadStatusStr !== localThreadStatusStr) {
                localStorage.setItem(KEY_THREAD_STATUS, mergedThreadStatusStr);
                lastKnownSiteState[KEY_THREAD_STATUS] = mergedThreadStatusStr;
                updated = true;
            }

            isInternalUpdate = false;

            if (updated) {
                // רענון הדף כדי לעדכן את ה-UI של האתר
                //window.location.reload();
            }
        } catch (e) {
            isInternalUpdate = false;
            console.error('TheChannel Sync: Error updating site', e);
        }
    }

    // --- עדכון התוסף (Outbound) ---
    async function syncToExtension() {
        if (isInternalUpdate || isContextInvalidated) return;

        try {
            const currentLastReadStr = localStorage.getItem(KEY_LAST_READ_MSG);
            const currentThreadStatusStr = localStorage.getItem(KEY_THREAD_STATUS);

            lastKnownSiteState[KEY_LAST_READ_MSG] = currentLastReadStr;
            lastKnownSiteState[KEY_THREAD_STATUS] = currentThreadStatusStr;

            const localLastRead = parseInt(currentLastReadStr || '0');
            let localThreadStatus = [];
            try {
                localThreadStatus = currentThreadStatusStr ? JSON.parse(currentThreadStatusStr) : [];
            } catch (e) {}

            // בדיקה אם ההקשר קיים לפני הקריאה
            if (!chrome.runtime?.id) {
                throw new Error('Extension context invalidated');
            }

            const extDataWrapper = await chrome.storage.sync.get(EXT_STORAGE_KEY);
            const extData = extDataWrapper[EXT_STORAGE_KEY] || {};
            
            const extLastRead = extData[KEY_LAST_READ_MSG] || 0;
            const extThreadStatus = extData[KEY_THREAD_STATUS] || [];

            const mergedLastRead = Math.max(localLastRead, extLastRead);
            const mergedThreadStatus = mergeThreadStatuses(localThreadStatus, extThreadStatus, 'local');
            
            const isDifferent = 
                (mergedLastRead > extLastRead) || 
                (JSON.stringify(mergedThreadStatus) !== JSON.stringify(extThreadStatus));

            if (isDifferent) {
                await chrome.storage.sync.set({
                    [EXT_STORAGE_KEY]: {
                        [KEY_LAST_READ_MSG]: mergedLastRead,
                        [KEY_THREAD_STATUS]: mergedThreadStatus,
                        lastSync: Date.now()
                    }
                });
            }
        } catch (e) {
            // זיהוי ספציפי של השגיאה וטיפול בה
            if (e.message.includes('Extension context invalidated')) {
                handleContextInvalidated();
            } else {
                console.error('TheChannel Sync: Error uploading to extension', e);
            }
        }
    }

    // --- Hook על setItem ---
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
        originalSetItem.call(this, key, value);
        if (!isContextInvalidated && !isInternalUpdate && this === localStorage && (key === KEY_LAST_READ_MSG || key === KEY_THREAD_STATUS)) {
            setTimeout(syncToExtension, 100);
        }
    };

    // --- Polling (רשת ביטחון) ---
    pollingIntervalId = setInterval(() => {
        if (isInternalUpdate || isContextInvalidated) return;
        
        const currentLastRead = localStorage.getItem(KEY_LAST_READ_MSG);
        const currentThreadStatus = localStorage.getItem(KEY_THREAD_STATUS);

        if (currentLastRead !== lastKnownSiteState[KEY_LAST_READ_MSG] || 
            currentThreadStatus !== lastKnownSiteState[KEY_THREAD_STATUS]) {
            syncToExtension(); 
        }
    }, 1000);

    // --- Inbound Listener ---
    try {
        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (isContextInvalidated) return;
            if (areaName === 'sync' && changes[EXT_STORAGE_KEY]) {
                const newValue = changes[EXT_STORAGE_KEY].newValue;
                if (newValue) {
                    updateSiteFromExtension(newValue);
                }
            }
        });
    } catch (e) {
        // במקרה נדיר שהמאזין נכשל ברישום
        handleContextInvalidated();
    }

    // --- אתחול ---
    try {
        chrome.storage.sync.get(EXT_STORAGE_KEY, (data) => {
            if (chrome.runtime.lastError) {
                if (chrome.runtime.lastError.message.includes('context invalidated')) {
                    handleContextInvalidated();
                    return;
                }
            }
            if (data && data[EXT_STORAGE_KEY]) {
                updateSiteFromExtension(data[EXT_STORAGE_KEY]);
            }
            setTimeout(() => {
                if (!isContextInvalidated) syncToExtension();
            }, 500);
        });
    } catch (e) {
        handleContextInvalidated();
    }

    console.log(`TheChannel Sync Manager: Protected mode active on ${DOMAIN}`);
})();