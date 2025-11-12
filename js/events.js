// קובץ זה מרכז את כל הפונקציות המטפלות באירועים (event handlers).
(function(app) {

  // משנה את ה-hash ב-URL כדי לעבור לתצוגת הערוץ
  app.events.navigateToChannel = function() {
    app.state.lastGmailHash = window.location.hash || '#inbox';
    window.location.hash = 'the-channel';
  };

  // פונקציה חדשה שמנווטת חזרה למיקום האחרון ב-Gmail
  app.events.navigateToLastView = function(event) {
    // אנחנו מתערבים רק אם אנחנו כרגע בתצוגת הערוץ
    if (window.location.hash.startsWith('#the-channel')) {
      event.preventDefault();
      event.stopPropagation();
      window.location.hash = app.state.lastGmailHash;
    }
    // אם אנחנו לא בתצוגת הערוץ, אנחנו לא עושים כלום ונותנים ל-Gmail לעשות את שלו.
  };

  // המטפל הראשי בשינוי ה-hash, קובע איזו תצוגה להראות
  app.events.handleHashChange = function() {
    if (window.location.hash.startsWith('#the-channel')) {
      app.dom.showTheChannel();
    } else {
      app.dom.showGmail();
      app.dom.updateComposeButtonVisibility();
    }
  };

  app.events.handleHamburgerClick = function(event) {
    if (window.location.hash.startsWith('#the-channel') && app.state.HamburgerClick) {
      event.preventDefault();
      event.stopPropagation();
      app.state.elements.hamburgerButton.blur();
    }
  };

  // מחבר את כל המאזינים לאירועים הרלוונטיים
  app.events.attachListeners = function() {
    const els = app.state.elements;
    
    els.theChannelButton.addEventListener('click', this.navigateToChannel);
    window.addEventListener('hashchange', this.handleHashChange);
    els.hamburgerButton.addEventListener('click', this.handleHamburgerClick, true);
    
    // חיבור המאזינים החדשים לכפתורי הניווט של Gmail
    if (els.mailButton) {
      els.mailButton.addEventListener('click', this.navigateToLastView);
    }
    if (els.chatButton) {
      els.chatButton.addEventListener('click', this.navigateToLastView);
    }
    if (els.meetButton) {
      els.meetButton.addEventListener('click', this.navigateToLastView);
    }
  };

})(TheChannelViewer);