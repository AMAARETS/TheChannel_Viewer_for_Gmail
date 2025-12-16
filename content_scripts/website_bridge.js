/**
 * content-script זה מוזרק אך ורק לדפי האתר 'TheChannel Viewer'
 * ומשמש כגשר תקשורת ישיר בין האתר לבין ה-service worker של התוסף.
 */

const MESSAGE_TYPES_FROM_PAGE = {
  APP_READY: 'THE_CHANNEL_APP_READY',
  SETTINGS_CHANGED: 'THE_CHANNEL_SETTINGS_CHANGED',
  GET_MANAGED_DOMAINS: 'THE_CHANNEL_GET_MANAGED_DOMAINS',
  REQUEST_PERMISSION: 'THE_CHANNEL_REQUEST_PERMISSION',
  GET_UNREAD_STATUS: 'THE_CHANNEL_GET_UNREAD_STATUS'
};

const MESSAGE_TYPES_TO_PAGE = {
  SETTINGS_DATA: 'THE_CHANNEL_SETTINGS_DATA',
  EXTENSION_READY: 'THE_CHANNEL_EXTENSION_READY',
  MANAGED_DOMAINS_DATA: 'THE_CHANNEL_MANAGED_DOMAINS_DATA',
  UNREAD_STATUS_DATA: 'THE_CHANNEL_UNREAD_STATUS_DATA',
  UNREAD_STATUS_UPDATE: 'THE_CHANNEL_UNREAD_STATUS_UPDATE'
};

console.log('TheChannel Viewer: Website Bridge loaded.');

// 1. הכרז על נוכחות התוסף
window.theChannelExtensionActive = true;

// 2. שלח אירוע שהתוסף מוכן
window.dispatchEvent(new CustomEvent('THE_CHANNEL_FROM_EXTENSION', {
  detail: { type: MESSAGE_TYPES_TO_PAGE.EXTENSION_READY }
}));

function sendMessageToBackground(message, callback) {
  if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
    console.log('TheChannel Viewer: Extension context invalidated. Please refresh the page.');
    return;
  }

  try {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        // console.warn('TheChannel Viewer runtime error:', chrome.runtime.lastError.message);
        return;
      }
      if (callback && typeof callback === 'function') {
        callback(response);
      }
    });
  } catch (error) {
    console.warn('TheChannel Viewer: Failed to send message (Extension might have been reloaded).', error.message);
  }
}

// 3. האזן לאירועים מותאמים אישית מהאתר
window.addEventListener('THE_CHANNEL_TO_EXTENSION', (event) => {
  if (!event.detail) return;
  const { type, payload } = event.detail;
  
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
    
  } else if (type === MESSAGE_TYPES_FROM_PAGE.GET_UNREAD_STATUS) {
    // בקשת סטטוס יזומה
    sendMessageToBackground({ type: 'GET_UNREAD_STATUS' }, (unreadDomains) => {
      window.dispatchEvent(new CustomEvent('THE_CHANNEL_FROM_EXTENSION', {
        detail: { type: MESSAGE_TYPES_TO_PAGE.UNREAD_STATUS_DATA, payload: unreadDomains }
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

// 4. האזן להודעות Push מה-Background (עבור אתר ישיר בטאב)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'UNREAD_STATUS_UPDATE') {
        window.dispatchEvent(new CustomEvent('THE_CHANNEL_FROM_EXTENSION', {
            detail: { 
                type: MESSAGE_TYPES_TO_PAGE.UNREAD_STATUS_UPDATE, 
                payload: message.payload 
            }
        }));
    }
});

// 5. האזן להודעות מה-Iframe Parent (עבור ג'ימייל)
// כאשר האתר ב-Iframe, התוסף ב-Parent (main.js) מקבל את ההודעה מה-Background
// ומעביר אותה ב-postMessage ל-Iframe. ה-Bridge קולט ומעביר לאתר.
window.addEventListener('message', (event) => {
    // אבטחה בסיסית: וודא שמקור ההודעה הוא ג'ימייל
    if (event.origin !== 'https://mail.google.com') return;
    
    const { type, payload } = event.data || {};
    
    // טיפול בעדכון סטטוס שמגיע מג'ימייל
    if (type === 'THE_CHANNEL_UNREAD_STATUS_UPDATE') {
        window.dispatchEvent(new CustomEvent('THE_CHANNEL_FROM_EXTENSION', {
            detail: { 
                type: MESSAGE_TYPES_TO_PAGE.UNREAD_STATUS_UPDATE, 
                payload: payload 
            }
        }));
    }
    
    // טיפול בתשובות לבקשות (כגון הגדרות) שמגיעות דרך postMessage ב-Iframe
    if (type === 'THE_CHANNEL_SETTINGS_DATA') {
         window.dispatchEvent(new CustomEvent('THE_CHANNEL_FROM_EXTENSION', {
            detail: { type: MESSAGE_TYPES_TO_PAGE.SETTINGS_DATA, payload: payload }
        }));
    }
    if (type === 'THE_CHANNEL_MANAGED_DOMAINS_DATA') {
         window.dispatchEvent(new CustomEvent('THE_CHANNEL_FROM_EXTENSION', {
            detail: { type: MESSAGE_TYPES_TO_PAGE.MANAGED_DOMAINS_DATA, payload: payload }
        }));
    }
    if (type === 'THE_CHANNEL_UNREAD_STATUS_DATA') {
         window.dispatchEvent(new CustomEvent('THE_CHANNEL_FROM_EXTENSION', {
            detail: { type: MESSAGE_TYPES_TO_PAGE.UNREAD_STATUS_DATA, payload: payload }
        }));
    }
});