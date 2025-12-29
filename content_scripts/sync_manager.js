/**
 * sync_manager.js
 * מנהל סנכרון רזה ומהיר.
 */

(function () {
  if (window.hasTheChannelSync) return;
  window.hasTheChannelSync = true;

  const DOMAIN = window.location.hostname;
  const STORAGE_KEY_PREFIX = `sync_data_`;
  const EXT_STORAGE_KEY = STORAGE_KEY_PREFIX + DOMAIN;

  const KEY_LAST_READ_MSG = "lastReadMessage";

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
    if (pollingIntervalId) clearInterval(pollingIntervalId);
    if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
  }

  // --- מסלול מהיר: עדכון ישיר ל-Background ---
  // חיוני לעדכון מיידי של ה-Badge בג'ימייל ללא המתנה לסנכרון ענן
  function sendFastUpdate(lastReadMsg) {
    if (isContextInvalidated || !chrome.runtime?.id) return;
    try {
      chrome.runtime.sendMessage({
        type: "DIRECT_SYNC_UPDATE",
        domain: DOMAIN,
        payload: {
          lastReadMessage: parseInt(lastReadMsg || "0"),
        },
      });
    } catch (e) {}
  }

  function updateSiteFromExtension(extData) {
    if (isInternalUpdate || isContextInvalidated) return;
    try {
      const extLastRead = extData[KEY_LAST_READ_MSG] || 0;
      const localLastReadStr = localStorage.getItem(KEY_LAST_READ_MSG);
      const localLastRead = parseInt(localLastReadStr || "0");

      if (extLastRead > localLastRead) {
        isInternalUpdate = true;
        localStorage.setItem(KEY_LAST_READ_MSG, extLastRead);
        lastKnownLastRead = extLastRead.toString();
        isInternalUpdate = false;
      }
    } catch (e) {
      isInternalUpdate = false;
    }
  }

  async function syncToExtension() {
    if (isInternalUpdate || isContextInvalidated || isSyncInProgress) return;

    const currentLastReadStr = localStorage.getItem(KEY_LAST_READ_MSG);
    if (currentLastReadStr === lastKnownLastRead) return;

    // 1. קריאה למסלול המהיר מייד! (מעדכן את המטמון ב-Background)
    sendFastUpdate(currentLastReadStr);

    isSyncInProgress = true;

    try {
      const localLastRead = parseInt(currentLastReadStr || "0");
      if (!chrome.runtime?.id) throw new Error("Extension context invalidated");

      // 2. שמירה לענן (sync storage) - מתבצע רק אם באמת יש שינוי
      const extDataWrapper = await chrome.storage.sync.get(EXT_STORAGE_KEY);
      const extData = extDataWrapper[EXT_STORAGE_KEY] || {};
      const extLastRead = extData[KEY_LAST_READ_MSG] || 0;

      if (localLastRead > extLastRead) {
        await chrome.storage.sync.set({
          [EXT_STORAGE_KEY]: {
            [KEY_LAST_READ_MSG]: localLastRead,
            lastSync: Date.now(),
          },
        });
        lastKnownLastRead = currentLastReadStr;
      }
    } catch (e) {
      if (e.message && e.message.includes("Extension context invalidated")) {
        handleContextInvalidated();
      }
    } finally {
      isSyncInProgress = false;
    }
  }

  const originalSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function (key, value) {
    originalSetItem.call(this, key, value);

    if (
      !isContextInvalidated &&
      !isInternalUpdate &&
      this === localStorage &&
      key === KEY_LAST_READ_MSG
    ) {
      sendFastUpdate(value);
      if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
      syncDebounceTimer = setTimeout(syncToExtension, 300);
    }
  };

  pollingIntervalId = setInterval(() => {
    if (isInternalUpdate || isContextInvalidated || isSyncInProgress) return;
    const currentLastRead = localStorage.getItem(KEY_LAST_READ_MSG);
    if (currentLastRead !== lastKnownLastRead) {
      syncToExtension();
    }
  }, 1000);

  try {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (isContextInvalidated) return;
      if (areaName === "sync" && changes[EXT_STORAGE_KEY]) {
        const newValue = changes[EXT_STORAGE_KEY].newValue;
        if (newValue) updateSiteFromExtension(newValue);
      }
    });
  } catch (e) {
    handleContextInvalidated();
  }

  // אתחול
  try {
    chrome.storage.sync.get(EXT_STORAGE_KEY, (data) => {
      if (chrome.runtime.lastError) return;
      if (data && data[EXT_STORAGE_KEY])
        updateSiteFromExtension(data[EXT_STORAGE_KEY]);
    });
  } catch (e) {
    handleContextInvalidated();
  }

  console.log(
    `TheChannel Sync Manager: Optimized Lite mode active on ${DOMAIN}`
  );
})();
