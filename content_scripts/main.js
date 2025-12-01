// קובץ זה הוא נקודת הכניסה הראשית. הוא אחראי על אתחול התוסף והפעלת הלוגיקה.
(function(app) {
  
  const SELECTORS_URL = 'https://cdn.jsdelivr.net/gh/AMAARETS/TheChannel_Viewer_for_Gmail@main/gmail-selectors.json';

  const MESSAGE_TYPES = {
    APP_READY: 'THE_CHANNEL_APP_READY',
    SETTINGS_CHANGED: 'THE_CHANNEL_SETTINGS_CHANGED',
    GET_MANAGED_DOMAINS: 'THE_CHANNEL_GET_MANAGED_DOMAINS', // חדש
    EXTENSION_READY: 'THE_CHANNEL_EXTENSION_READY',
    SETTINGS_DATA: 'THE_CHANNEL_SETTINGS_DATA',
    MANAGED_DOMAINS_DATA: 'THE_CHANNEL_MANAGED_DOMAINS_DATA' // חדש
  };

  // פונקציה המטפלת בהעברת הודעות מה-iframe ל-background script
  function handleMessagesFromIframe(event) {
    const iframe = app.state.elements.iframeContainer?.querySelector('iframe');
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
        console.log('TheChannel Extension: Sending settings to app.', response);
        iframe.contentWindow.postMessage({ type: MESSAGE_TYPES.SETTINGS_DATA, payload: response }, iframe.src);
      });
    }

    if (type === MESSAGE_TYPES.SETTINGS_CHANGED) {
      console.log('TheChannel Extension: Settings changed in app, saving to background.');
      chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', payload: payload });
    }
    
    if (type === MESSAGE_TYPES.GET_MANAGED_DOMAINS) {
        console.log('TheChannel Extension: App is requesting managed domains list.');
        chrome.runtime.sendMessage({ type: 'GET_MANAGED_DOMAINS'}, (domains) => {
            if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError.message);
                return;
            }
            console.log('TheChannel Extension: Sending managed domains to app.', domains);
            iframe.contentWindow.postMessage({ type: MESSAGE_TYPES.MANAGED_DOMAINS_DATA, payload: domains }, iframe.src);
        });
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
    
    window.addEventListener('message', handleMessagesFromIframe);
    
    // בדיקה והחזרת הסרגל אם נסגר על ידי התוסף לפני רענון
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
    // 1. נסה קודם כל למשוך את הסלקטורים המעודכנים מהרשת
    try {
      const response = await fetch(`${SELECTORS_URL}?_=${new Date().getTime()}`, { cache: 'no-cache' });
      if (!response.ok) {
        // אם השרת החזיר שגיאה (למשל 404), זרוק שגיאה כדי לעבור לבלוק ה-catch
        throw new Error(`Network response was not ok, status: ${response.status}`);
      }
      app.state.selectors = await response.json();
      console.log('TheChannel Viewer: Successfully fetched remote selectors.', app.state.selectors);
      waitForGmail(); // המשך אתחול עם הסלקטורים המעודכנים
    } catch (error) {
      // 2. אם הטעינה מהרשת נכשלה, טען את קובץ הגיבוי המקומי
      console.warn(`TheChannel Viewer: Failed to fetch remote selectors (${error.message}). Attempting to use local fallback.`);
      
      try {
        const localSelectorsUrl = chrome.runtime.getURL('gmail-selectors.json');
        const response = await fetch(localSelectorsUrl);
        if (!response.ok) {
          throw new Error(`Local fallback response was not ok, status: ${response.status}`);
        }
        app.state.selectors = await response.json();
        console.log('TheChannel Viewer: Successfully loaded local fallback selectors.');
        waitForGmail(); // המשך אתחול עם הסלקטורים המקומיים
      } catch (fallbackError) {
        // 3. במקרה הלא סביר שגם קובץ הגיבוי נכשל, התוסף לא יכול לעבוד
        console.error('TheChannel Viewer: CRITICAL - Failed to load even the local selectors. The extension cannot initialize.', fallbackError);
      }
    }
  }

  fetchSelectorsAndStart();

})(TheChannelViewer);