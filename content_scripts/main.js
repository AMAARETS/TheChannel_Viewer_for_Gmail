// קובץ זה הוא נקודת הכניסה הראשית. הוא אחראי על אתחול התוסף והפעלת הלוגיקה.
(function(app) {
  
  // כתובת ה-URL של קובץ המזהים. יש לעדכן לכתובת שלך!
  const SELECTORS_URL = 'https://cdn.jsdelivr.net/gh/AMAARETS/TheChannel_Viewer_for_Gmail@main/gmail-selectors.json';

  // פונקציית האתחול הראשית
  function init() {
    if (app.state.isInitialized) return true;

    if (!app.dom.queryElements()) {
      return false; // ממשק Gmail עדיין לא נטען במלואו
    }

    app.state.elements.theChannelButton = app.dom.createNavButton();
    app.state.elements.iframeContainer = app.dom.createIframe();

    if (!app.state.elements.theChannelButton || !app.state.elements.iframeContainer) {
        console.error('TheChannel Viewer: Could not create required elements.');
        return false;
    }
    
    app.events.attachListeners();
    app.events.handleHashChange();
    
    app.state.isInitialized = true;
    console.log('TheChannel Viewer for Gmail was successfully initialized!');
    return true;
  }

  // ממתין לטעינת ממשק Gmail
  function waitForGmail() {
    if (init()) return;

    const observer = new MutationObserver((mutations, obs) => {
      if (init()) {
        obs.disconnect();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // פונקציה אסינכרונית שטוענת את המזהים ורק אז מתחילה את התוסף
  async function fetchSelectorsAndStart() {
    try {
      const response = await fetch(`${SELECTORS_URL}?_=${new Date().getTime()}`, { cache: 'no-cache' });
      if (!response.ok) {
        throw new Error(`Network response was not ok, status: ${response.status}`);
      }
      app.state.selectors = await response.json();
      console.log('TheChannel Viewer: Selectors loaded successfully.');
      waitForGmail(); // התחל את תהליך האתחול רק אחרי שהמזהים נטענו
    } catch (error) {
      console.error('TheChannel Viewer: Failed to fetch or parse selectors. The extension cannot start.', error);
    }
  }

  fetchSelectorsAndStart();

})(TheChannelViewer);