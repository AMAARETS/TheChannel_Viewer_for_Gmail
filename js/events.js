// קובץ זה מרכז את כל הפונקציות המטפלות באירועים (event handlers).
(function(app) {

  // משנה את ה-hash ב-URL כדי לעבור לתצוגת הערוץ
  app.events.navigateToChannel = function() {
    app.state.lastGmailHash = window.location.hash || '#inbox';
    window.location.hash = 'the-channel';
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
    app.state.elements.theChannelButton.addEventListener('click', this.navigateToChannel);
    window.addEventListener('hashchange', this.handleHashChange);
    app.state.elements.hamburgerButton.addEventListener('click', this.handleHamburgerClick, true);
  };

})(TheChannelViewer);