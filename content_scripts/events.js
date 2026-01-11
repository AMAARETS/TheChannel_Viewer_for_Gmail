// content_scripts/events.js
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

  app.events.navigateToChannel = function() {
    app.state.lastGmailHash = window.location.hash || '#inbox';
    app.state.lastActiveApp = app.events.detectActiveApp(); 
    window.location.hash = 'the-channel';
  };

  app.events.navigateToLastView = function(event, clickedApp) {
    if (window.location.hash.startsWith('#the-channel')) {
      if (!clickedApp || clickedApp === app.state.lastActiveApp) {
        event.preventDefault();
        event.stopPropagation();
        window.location.hash = app.state.lastGmailHash;
      }
    }
  };

  app.events.handleHashChange = function() {
    if (window.location.hash.startsWith('#the-channel')) {
      app.dom.showTheChannel();
    } else {
      app.dom.showGmail();
      app.dom.updateComposeButtonVisibility();
    }
  };

  app.events.handleHamburgerClick = function(event) {
    if (window.location.hash.startsWith('#the-channel')) {
      event.preventDefault();
      event.stopPropagation();
      app.state.elements.hamburgerButton?.blur();
    }
  };

  // --- הפונקציה המעודכנת ---
  app.events.attachListeners = function() {
    const els = app.state.elements;
    
    // מאזינים בסיסיים
    els.theChannelButton.addEventListener('click', this.navigateToChannel);
    window.addEventListener('hashchange', this.handleHashChange);
    els.hamburgerButton.addEventListener('click', this.handleHamburgerClick, true);
    
    if (els.mailButton) els.mailButton.addEventListener('click', (e) => this.navigateToLastView(e, 'mail'));
    if (els.chatButton) els.chatButton.addEventListener('click', (e) => this.navigateToLastView(e, 'chat'));
    if (els.meetButton) els.meetButton.addEventListener('click', (e) => this.navigateToLastView(e, 'meet'));

    // === לוגיקת הסתרה חכמה (Smart Hover Logic) ===
    
    const customSidebar = els.channelSidebar || document.querySelector('.the-channel-sidebar-wrapper');
    
    if (customSidebar) {
        let hideTimeout;
        const HIDE_DELAY = 0; // מילישניות המתנה לפני החזרת הסרגל (מונע הבהובים)

        // פונקציה להחזרת הסרגל (הצגה)
        const scheduleRestore = () => {
            customSidebar.classList.remove('hide-on-hover');
        };

        // פונקציה להסתרת הסרגל (הסתרה)
        const hideImmediately = () => {
            if (window.location.hash.startsWith('#the-channel')) {
                customSidebar.classList.add('hide-on-hover');
            }
        };

        /**
         * פונקציה שמחברת קבוצת אלמנטים (כפתור + סרגל מקורי) ללוגיקה
         * @param {HTMLElement} mainButton - הכפתור הראשי (למשל המייל)
         * @param {HTMLElement} nativeSidebar - הסרגל שנפתח (למשל סרגל המייל הנפתח)
         */
        const setupHoverGroup = (mainButton, nativeSidebar) => {
            if (!mainButton) return;

            // 1. זיהוי הטריגר הפנימי (האייקון בלבד) לפי הבקשה שלך
            // מנסים למצוא את האלמנט עם הקלאס V6 (שהוא בד"כ האייקון בג'ימייל)
            const innerTrigger = mainButton.querySelector('.V6') || mainButton;

            // א. כניסה לאייקון הפנימי -> הסתרה מיידית של סרגל הערוץ
            innerTrigger.addEventListener('mouseenter', hideImmediately);

            // ב. כניסה לסרגל המקורי של ג'ימייל -> שמירה על ההסתרה (ביטול טיימר ההחזרה)
            if (nativeSidebar) {
                nativeSidebar.addEventListener('mouseenter', hideImmediately);
                
                // ד. יציאה מהסרגל המקורי -> תזמון החזרה
                nativeSidebar.addEventListener('mouseleave', scheduleRestore);
            }

            // ג. יציאה מהכפתור הראשי (הגדול) -> תזמון החזרה
            // שים לב: אנחנו מאזינים ליציאה מהכפתור השלם, לא רק מהאייקון הפנימי.
            // זה מאפשר למשתמש לעבור מהאייקון לשטח המת של הכפתור ומשם לסרגל בלי שהסרגל ייסגר.
            mainButton.addEventListener('mouseleave', scheduleRestore);
        };

        // הפעלת הלוגיקה על הזוגות: כפתור מייל + סרגל מייל, כפתור צ'אט + סרגל צ'אט
        setupHoverGroup(els.mailButton, els.gmailSidebar);
        setupHoverGroup(els.chatButton, els.chatSidebar);
    }
    // ========================================================
  };

})(TheChannelViewer);