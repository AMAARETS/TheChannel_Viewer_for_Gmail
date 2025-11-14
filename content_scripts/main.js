// קובץ זה הוא נקודת הכניסה הראשית. הוא אחראי על אתחול התוסף והפעלת הלוגיקה.
(function(app) {
  
  const SELECTORS_URL = 'https://cdn.jsdelivr.net/gh/AMAARETS/TheChannel_Viewer_for_Gmail@main/gmail-selectors.json';
  
  // חדש: הגדרות אחידות לסוגי ההודעות
  const MESSAGE_TYPES = {
    // הודעות מהאתר לתוסף
    APP_READY: 'THE_CHANNEL_APP_READY',
    SETTINGS_CHANGED: 'THE_CHANNEL_SETTINGS_CHANGED',
    // הודעות מהתוסף לאתר
    EXTENSION_READY: 'THE_CHANNEL_EXTENSION_READY',
    SETTINGS_DATA: 'THE_CHANNEL_SETTINGS_DATA'
  };

  // חדש: פונקציה המטפלת בהעברת הודעות מה-iframe ל-background script
  function handleMessagesFromIframe(event) {
    const iframe = app.state.elements.iframeContainer?.querySelector('iframe');
    // אבטחה: ודא שההודעה הגיעה מה-iframe שלנו
    if (!iframe || event.source !== iframe.contentWindow) {
      return;
    }
    
    const { type, payload } = event.data;

    // כאשר האפליקציה מוכנה, שלח לה את ההגדרות
    if (type === MESSAGE_TYPES.APP_READY) {
      console.log('TheChannel Extension: App is ready, requesting settings from background.');
      chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (settings) => {
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError.message);
          return;
        }
        console.log('TheChannel Extension: Sending settings to app.', settings);
        iframe.contentWindow.postMessage({ type: MESSAGE_TYPES.SETTINGS_DATA, payload: settings }, iframe.src);
      });
    }

    // כאשר הגדרות משתנות באפליקציה, שמור אותן
    if (type === MESSAGE_TYPES.SETTINGS_CHANGED) {
      console.log('TheChannel Extension: Settings changed in app, saving to background.');
      chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', payload: payload });
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
    
    // חדש: האזנה להודעות מה-iframe
    window.addEventListener('message', handleMessagesFromIframe);
    
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
      if (!response.ok) throw new Error(`Network response was not ok, status: ${response.status}`);
      app.state.selectors = await response.json();
      waitForGmail();
    } catch (error) {
      console.error('TheChannel Viewer: Failed to fetch selectors.', error);
    }
  }

  fetchSelectorsAndStart();

})(TheChannelViewer);