// קובץ זה מרכז את כל הפונקציות המטפלות באירועים (event handlers).
(function(app) {

  // פונקציה עזר שמזהה איזו אפליקציה פעילה כרגע לפי ה-hash
  app.events.detectActiveApp = function() {
    const hash = window.location.hash;
    
    // זיהוי לפי התחילית של ה-hash
    if (hash.startsWith('#chat')) {
      return 'chat';
    }
    if (hash.startsWith('#meet') || hash.startsWith('#calls')) {
      return 'meet';
    }
    // ברירת מחדל - Mail (inbox, drafts, sent, וכו')
    return 'mail';
  };

  // משנה את ה-hash ב-URL כדי לעבור לתצוגת הערוץ
  app.events.navigateToChannel = function() {
    app.state.lastGmailHash = window.location.hash || '#inbox';
    app.state.lastActiveApp = app.events.detectActiveApp(); // שומר איזו אפליקציה פעילה
    window.location.hash = 'the-channel';
  };

  // פונקציה חדשה שמנווטת חזרה למיקום האחרון ב-Gmail
  // מקבלת event ופרמטר אופציונלי שמציין איזה כפתור נלחץ
  app.events.navigateToLastView = function(event, clickedApp) {
    // אנחנו מתערבים רק אם אנחנו כרגע בתצוגת הערוץ
    if (window.location.hash.startsWith('#the-channel')) {
      // אם לא צוין clickedApp (למשל בטסטים), מתנהגים כמו קודם - תמיד חוזרים
      // אם צוין clickedApp, בודקים שזה אותו כפתור שהיה פעיל
      if (!clickedApp || clickedApp === app.state.lastActiveApp) {
        event.preventDefault();
        event.stopPropagation();
        window.location.hash = app.state.lastGmailHash;
      }
    }
    // אחרת - לא מתערבים ונותנים ל-Gmail לנווט באופן טבעי
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
    // כל כפתור מקבל handler ייעודי שיודע איזו אפליקציה הוא מייצג
    if (els.mailButton) {
      els.mailButton.addEventListener('click', (e) => this.navigateToLastView(e, 'mail'));
    }
    if (els.chatButton) {
      els.chatButton.addEventListener('click', (e) => this.navigateToLastView(e, 'chat'));
    }
    if (els.meetButton) {
      els.meetButton.addEventListener('click', (e) => this.navigateToLastView(e, 'meet'));
    }
  };

})(TheChannelViewer);