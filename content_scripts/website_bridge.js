/**
 * content-script זה מוזרק אך ורק לדפי האתר 'TheChannel Viewer'
 * ומשמש כגשר תקשורת ישיר בין האתר לבין ה-service worker של התוסף.
 */

const MESSAGE_TYPES_FROM_PAGE = {
  APP_READY: 'THE_CHANNEL_APP_READY',
  SETTINGS_CHANGED: 'THE_CHANNEL_SETTINGS_CHANGED',
  GET_MANAGED_DOMAINS: 'THE_CHANNEL_GET_MANAGED_DOMAINS',
  REQUEST_PERMISSION: 'THE_CHANNEL_REQUEST_PERMISSION'
};

const MESSAGE_TYPES_TO_PAGE = {
  SETTINGS_DATA: 'THE_CHANNEL_SETTINGS_DATA',
  EXTENSION_READY: 'THE_CHANNEL_EXTENSION_READY',
  MANAGED_DOMAINS_DATA: 'THE_CHANNEL_MANAGED_DOMAINS_DATA',
};

console.log('TheChannel Viewer: Website Bridge loaded.');

// 1. הכרז על נוכחות התוסף
window.theChannelExtensionActive = true;

// 2. שלח אירוע שהתוסף מוכן
window.dispatchEvent(new CustomEvent('THE_CHANNEL_FROM_EXTENSION', {
  detail: { type: MESSAGE_TYPES_TO_PAGE.EXTENSION_READY }
}));

/**
 * פונקציית עזר לשליחה בטוחה ל-Background.
 * מונעת קריסות של "Extension context invalidated" אחרי רענון התוסף.
 */
function sendMessageToBackground(message, callback) {
  // בדיקה האם ההקשר של התוסף עדיין קיים
  if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
    console.log('TheChannel Viewer: Extension context invalidated. Please refresh the page.');
    return;
  }

  try {
    chrome.runtime.sendMessage(message, (response) => {
      // טיפול בשגיאות ברמת הפרוטוקול של כרום (למשל אם אין מאזין בצד השני)
      if (chrome.runtime.lastError) {
        // ברוב המקרים נתעלם, או שנרשום לקונסול רק אם זה קריטי
        console.warn('TheChannel Viewer runtime error:', chrome.runtime.lastError.message);
        return;
      }
      if (callback && typeof callback === 'function') {
        callback(response);
      }
    });
  } catch (error) {
    // תפיסת שגיאות סינכרוניות (כמו Context Invalidated שנזרק מיד)
    console.warn('TheChannel Viewer: Failed to send message (Extension might have been reloaded).', error.message);
  }
}

// 3. האזן לאירועים מותאמים אישית מהאתר
window.addEventListener('THE_CHANNEL_TO_EXTENSION', (event) => {
  // הגנה נוספת למקרה שהאירוע לא תקין
  if (!event.detail) return;

  const { type, payload } = event.detail;
  
  console.log(`TheChannel Bridge: Received '${type}' from page, forwarding to background.`, payload);

  if (type === MESSAGE_TYPES_FROM_PAGE.APP_READY) {
    sendMessageToBackground({ type: 'GET_SETTINGS' }, (response) => {
      window.dispatchEvent(new CustomEvent('THE_CHANNEL_FROM_EXTENSION', {
        detail: { type: MESSAGE_TYPES_TO_PAGE.SETTINGS_DATA, payload: response }
      }));
    });

  } else if (type === MESSAGE_TYPES_FROM_PAGE.SETTINGS_CHANGED) {
    sendMessageToBackground({ type: 'SAVE_SETTINGS', payload: payload });

  } else if (type === MESSAGE_TYPES_FROM_PAGE.GET_MANAGED_DOMAINS) {
    sendMessageToBackground({ type: 'GET_MANAGED_DOMAINS' }, (domains) => {
      window.dispatchEvent(new CustomEvent('THE_CHANNEL_FROM_EXTENSION', {
        detail: { type: MESSAGE_TYPES_TO_PAGE.MANAGED_DOMAINS_DATA, payload: domains }
      }));
    });

  } else if (type === MESSAGE_TYPES_FROM_PAGE.REQUEST_PERMISSION) {
    if (payload && payload.domain) {
      sendMessageToBackground({ 
        type: 'OPEN_PERMISSION_POPUP', 
        domain: payload.domain,
        name: payload.name
      });
    }
  }
});