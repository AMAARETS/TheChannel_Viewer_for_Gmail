/**
 * content-script זה מוזרק אך ורק לדפי האתר 'TheChannel Viewer'
 * ומשמש כגשר תקשורת ישיר בין האתר לבין ה-service worker של התוסף.
 */

const MESSAGE_TYPES_FROM_PAGE = {
  APP_READY: 'THE_CHANNEL_APP_READY',
  SETTINGS_CHANGED: 'THE_CHANNEL_SETTINGS_CHANGED',
  GET_MANAGED_DOMAINS: 'THE_CHANNEL_GET_MANAGED_DOMAINS',
  REQUEST_PERMISSION: 'THE_CHANNEL_REQUEST_PERMISSION',
  GET_UNREAD_STATUS: 'THE_CHANNEL_GET_UNREAD_STATUS',
  GET_MUTED_DOMAINS: 'THE_CHANNEL_GET_MUTED_DOMAINS',
  TOGGLE_MUTE_DOMAIN: 'THE_CHANNEL_TOGGLE_MUTE_DOMAIN'
};

const MESSAGE_TYPES_TO_PAGE = {
  SETTINGS_DATA: 'THE_CHANNEL_SETTINGS_DATA',
  EXTENSION_READY: 'THE_CHANNEL_EXTENSION_READY',
  MANAGED_DOMAINS_DATA: 'THE_CHANNEL_MANAGED_DOMAINS_DATA',
  UNREAD_STATUS_DATA: 'THE_CHANNEL_UNREAD_STATUS_DATA',
  UNREAD_STATUS_UPDATE: 'THE_CHANNEL_UNREAD_STATUS_UPDATE',
  MUTED_DOMAINS_DATA: 'THE_CHANNEL_MUTED_DOMAINS_DATA'
};

console.log('TheChannel Viewer: Website Bridge loaded.');

// 1. הכרז על נוכחות התוסף
window.theChannelExtensionActive = true;

const extensionVersion = chrome.runtime.getManifest().version;

window.dispatchEvent(new CustomEvent('THE_CHANNEL_FROM_EXTENSION', {
  detail: { 
    type: MESSAGE_TYPES_TO_PAGE.EXTENSION_READY,
    payload: { version: extensionVersion } // הוספת הגרסה לדיטיילס
  }
}));

function sendMessageToBackground(message, callback) {
  if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
    console.log('TheChannel Viewer: Extension context invalidated. Please refresh the page.');
    return;
  }

  try {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
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
    sendMessageToBackground({ type: 'GET_UNREAD_STATUS' }, (unreadDomains) => {
      window.dispatchEvent(new CustomEvent('THE_CHANNEL_FROM_EXTENSION', {
        detail: { type: MESSAGE_TYPES_TO_PAGE.UNREAD_STATUS_DATA, payload: unreadDomains }
      }));
    });

  } else if (type === MESSAGE_TYPES_FROM_PAGE.GET_MUTED_DOMAINS) {
    sendMessageToBackground({ type: 'GET_MUTED_DOMAINS' }, (mutedDomains) => {
      window.dispatchEvent(new CustomEvent('THE_CHANNEL_FROM_EXTENSION', {
        detail: { type: MESSAGE_TYPES_TO_PAGE.MUTED_DOMAINS_DATA, payload: mutedDomains }
      }));
    });

  } else if (type === MESSAGE_TYPES_FROM_PAGE.TOGGLE_MUTE_DOMAIN) {
    if (payload && payload.domain) {
        sendMessageToBackground({ type: 'TOGGLE_MUTE_DOMAIN', domain: payload.domain });
    }

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
    } else if (message.type === 'MUTED_DOMAINS_UPDATE') {
        window.dispatchEvent(new CustomEvent('THE_CHANNEL_FROM_EXTENSION', {
            detail: { 
                type: MESSAGE_TYPES_TO_PAGE.MUTED_DOMAINS_DATA, 
                payload: message.payload 
            }
        }));
    }
});

// 5. האזן להודעות מה-Iframe Parent (עבור ג'ימייל)
window.addEventListener('message', (event) => {
    // *** תיקון: אפשור קבלת הודעות גם כאשר האתר רץ בלוקלהוסט בתוך אייפריים ***
    if (event.origin !== 'https://mail.google.com' && !event.origin.includes('localhost')) return;
    
    const { type, payload } = event.data || {};
    
    if (type === 'THE_CHANNEL_UNREAD_STATUS_UPDATE') {
        window.dispatchEvent(new CustomEvent('THE_CHANNEL_FROM_EXTENSION', {
            detail: { type: MESSAGE_TYPES_TO_PAGE.UNREAD_STATUS_UPDATE, payload: payload }
        }));
    }
    
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
    if (type === 'THE_CHANNEL_MUTED_DOMAINS_DATA') {
         window.dispatchEvent(new CustomEvent('THE_CHANNEL_FROM_EXTENSION', {
            detail: { type: MESSAGE_TYPES_TO_PAGE.MUTED_DOMAINS_DATA, payload: payload }
        }));
    }
});