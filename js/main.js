// קובץ זה הוא נקודת הכניסה הראשית. הוא אחראי על אתחול התוסף והפעלת הלוגיקה.
(function(app) {
  
  // פונקציית האתחול הראשית
  function init() {
    if (app.state.isInitialized) return true;

    if (!app.dom.queryElements()) {
      return false; // ממשק Gmail עדיין לא נטען
    }

    app.state.elements.theChannelButton = app.dom.createNavButton();
    app.state.elements.iframeContainer = app.dom.createIframe();

    if (!app.state.elements.theChannelButton || !app.state.elements.iframeContainer) {
        return false;
    }
    
    app.events.attachListeners();
    app.events.handleHashChange();
    
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

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  waitForGmail();

})(TheChannelViewer);