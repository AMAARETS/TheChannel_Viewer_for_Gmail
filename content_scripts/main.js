// קובץ זה הוא נקודת הכניסה הראשית. הוא אחראי על אתחול התוסף והפעלת הלוגיקה.
(function(app) {
  
  const SELECTORS_URL = 'https://cdn.jsdelivr.net/gh/AMAARETS/TheChannel_Viewer_for_Gmail@9aba4e9c9cbd3d7257bad8229e9d626e67a8a8ee/gmail-selectors.json';

  const MESSAGE_TYPES = {
    APP_READY: 'THE_CHANNEL_APP_READY',
    SETTINGS_CHANGED: 'THE_CHANNEL_SETTINGS_CHANGED',
    GET_MANAGED_DOMAINS: 'THE_CHANNEL_GET_MANAGED_DOMAINS',
    // 1. הוספת סוג ההודעה החסר
    REQUEST_PERMISSION: 'THE_CHANNEL_REQUEST_PERMISSION', 
    EXTENSION_READY: 'THE_CHANNEL_EXTENSION_READY',
    SETTINGS_DATA: 'THE_CHANNEL_SETTINGS_DATA',
    MANAGED_DOMAINS_DATA: 'THE_CHANNEL_MANAGED_DOMAINS_DATA'
  };

  // פונקציה המטפלת בהעברת הודעות מה-iframe ל-background script
  function handleMessagesFromIframe(event) {
    const iframe = app.state.elements.iframeContainer?.querySelector('iframe');
    // בדיקת אבטחה: מוודאים שההודעה הגיעה מה-iframe שלנו
    if (!iframe || event.source !== iframe.contentWindow) {
      return;
    }
    
    const { type, payload } = event.data;

    if (type === MESSAGE_TYPES.APP_READY) {
      console.log('TheChannel Extension: App is ready, requesting settings from background.');
      chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError.message);
          return;
        }
        // שליחת תשובה חזרה ל-iframe
        iframe.contentWindow.postMessage({ type: MESSAGE_TYPES.SETTINGS_DATA, payload: response }, '*');
      });
    }

    if (type === MESSAGE_TYPES.SETTINGS_CHANGED) {
      console.log('TheChannel Extension: Settings changed in app, saving to background.');
      chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', payload: payload });
    }
    
    if (type === MESSAGE_TYPES.GET_MANAGED_DOMAINS) {
        chrome.runtime.sendMessage({ type: 'GET_MANAGED_DOMAINS'}, (domains) => {
            if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError.message);
                return;
            }
            iframe.contentWindow.postMessage({ type: MESSAGE_TYPES.MANAGED_DOMAINS_DATA, payload: domains }, '*');
        });
    }

    // 2. הוספת הטיפול בבקשת ההרשאה
    if (type === MESSAGE_TYPES.REQUEST_PERMISSION) {
        console.log('TheChannel Extension: Received permission request from iframe.', payload);
        if (payload && payload.domain) {
            chrome.runtime.sendMessage({ 
                type: 'OPEN_PERMISSION_POPUP', 
                domain: payload.domain,
                name: payload.name 
            });
        }
    }
  }

  function init() {
    if (app.state.isInitialized) return true;
    if (!app.dom.queryElements()) return false;

    app.state.elements.theChannelButton = app.dom.createNavButton();
    app.state.elements.iframeContainer = app.dom.createIframe();

    if (!app.state.elements.theChannelButton || !app.state.elements.iframeContainer) {
        console.error('TheChannel Viewer: Could not create required elements.');
        return false;
    }
    
    app.events.attachListeners();
    app.events.handleHashChange();
    
    // החזרנו את ההאזנה ל-postMessage
    window.addEventListener('message', handleMessagesFromIframe);
    
    app.storage.checkAndRestoreSidebar();
    
    app.state.isInitialized = true;
    console.log('TheChannel Viewer for Gmail was successfully initialized!');
    return true;
  }

  function waitForGmail() {
    if (init()) return;
    const observer = new MutationObserver((mutations, obs) => {
      if (init()) {
        obs.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

async function fetchSelectorsAndStart() {
    try {
      const response = await fetch(`${SELECTORS_URL}?_=${new Date().getTime()}`, { cache: 'no-cache' });
      if (!response.ok) throw new Error(`Network response was not ok`);
      app.state.selectors = await response.json();
      waitForGmail(); 
    } catch (error) {
      console.warn(`TheChannel Viewer: Failed to fetch remote selectors. Using local.`);
      try {
        const localSelectorsUrl = chrome.runtime.getURL('gmail-selectors.json');
        const response = await fetch(localSelectorsUrl);
        app.state.selectors = await response.json();
        waitForGmail();
      } catch (fallbackError) {
        console.error('TheChannel Viewer: CRITICAL - Failed to load selectors.', fallbackError);
      }
    }
  }

  fetchSelectorsAndStart();

})(TheChannelViewer);