/**
 * content-script זה מוזרק אך ורק לדפי האתר 'TheChannel Viewer'
 * ומשמש כגשר תקשורת ישיר בין האתר לבין ה-service worker של התוסף.
 */

// הגדרות אחידות לסוגי ההודעות, חייב להיות זהה למה שמוגדר באתר
const MESSAGE_TYPES_FROM_PAGE = {
  APP_READY: 'THE_CHANNEL_APP_READY',
  SETTINGS_CHANGED: 'THE_CHANNEL_SETTINGS_CHANGED',
  GET_MANAGED_DOMAINS: 'THE_CHANNEL_GET_MANAGED_DOMAINS',
  REQUEST_PERMISSION: 'THE_CHANNEL_REQUEST_PERMISSION' // *** חדש: בקשת אישור ***
};

const MESSAGE_TYPES_TO_PAGE = {
  SETTINGS_DATA: 'THE_CHANNEL_SETTINGS_DATA',
  EXTENSION_READY: 'THE_CHANNEL_EXTENSION_READY',
  MANAGED_DOMAINS_DATA: 'THE_CHANNEL_MANAGED_DOMAINS_DATA',
};

console.log('TheChannel Viewer: Website Bridge loaded.');

// 1. הכרז על נוכחות התוסף כדי שהאתר יוכל לזהות אותו
window.theChannelExtensionActive = true;

// 2. שלח אירוע שהתוסף מוכן, כדי שהאתר ידע לבקש הגדרות
window.dispatchEvent(new CustomEvent('THE_CHANNEL_FROM_EXTENSION', {
  detail: { type: MESSAGE_TYPES_TO_PAGE.EXTENSION_READY }
}));

// 3. האזן לאירועים מותאמים אישית מהאתר
window.addEventListener('THE_CHANNEL_TO_EXTENSION', (event) => {
  const { type, payload } = event.detail;
  
  console.log(`TheChannel Bridge: Received '${type}' from page, forwarding to background.`, payload);

  if (type === MESSAGE_TYPES_FROM_PAGE.APP_READY) {
    // האתר מוכן ומבקש הגדרות
    chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError.message);
        return;
      }
      // שלח את ההגדרות בחזרה לאתר
      window.dispatchEvent(new CustomEvent('THE_CHANNEL_FROM_EXTENSION', {
        detail: { type: MESSAGE_TYPES_TO_PAGE.SETTINGS_DATA, payload: response }
      }));
    });

  } else if (type === MESSAGE_TYPES_FROM_PAGE.SETTINGS_CHANGED) {
    // האתר שולח הגדרות מעודכנות לשמירה
    chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', payload: payload });

  } else if (type === MESSAGE_TYPES_FROM_PAGE.GET_MANAGED_DOMAINS) {
    // האתר מבקש את רשימת הדומיינים המנוהלים
    chrome.runtime.sendMessage({ type: 'GET_MANAGED_DOMAINS' }, (domains) => {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError.message);
        return;
      }
      // שלח את הרשימה בחזרה לאתר
      window.dispatchEvent(new CustomEvent('THE_CHANNEL_FROM_EXTENSION', {
        detail: { type: MESSAGE_TYPES_TO_PAGE.MANAGED_DOMAINS_DATA, payload: domains }
      }));
    });

  } else if (type === MESSAGE_TYPES_FROM_PAGE.REQUEST_PERMISSION) {
    // *** חדש: האתר מבקש לפתוח חלון לאישור דומיין ***
    // payload אמור להכיל: { domain: 'example.com' }
    if (payload && payload.domain) {
      chrome.runtime.sendMessage({ 
        type: 'OPEN_PERMISSION_POPUP', 
        domain: payload.domain 
      });
    }
  }
});