// קובץ זה מרכז את כל הפונקציונליות האחראית על אינטראקציה עם ה-DOM.
(function(app) {

  // פונקציה עזר לחיפוש אלמנט עם תמיכה במזהים מרובים
  function findElement(selectors) {
    if (!selectors) return null;
    const selectorArray = Array.isArray(selectors) ? selectors : [selectors];
    for (const selector of selectorArray) {
      const element = document.querySelector(selector);
      if (element) return element;
    }
    return null;
  }

  // פונקציה שמחפשת אלמנטים דינמיים (שנוצרים ונמחקים) ומסתירה/מציגה אותם
  function toggleDynamicBars(shouldHide) {
    const selectors = app.state.selectors;
    if (!selectors) return;

    const toolbar = findElement(selectors.gmailToolbar);
    const filterBar = findElement(selectors.searchFilterBar);

    const action = shouldHide ? 'add' : 'remove';

    if (toolbar) {
      toolbar.classList[action]('the-channel-active-hide-gmail');
    }
    
    if (filterBar) {
      filterBar.classList[action]('the-channel-active-hide-gmail');
    }
  }

  // שולף את כל אלמנטי המפתח מהדף ושומר אותם ב-state
  app.dom.queryElements = function() {
    const els = app.state.elements;
    const selectors = app.state.selectors;
    
    if (!selectors) return false;

    els.gmailView = findElement(selectors.gmailView);
    els.iframeParent = findElement(selectors.iframeParent);
    els.hamburgerButton = findElement(selectors.hamburgerButton);
    els.searchBar = findElement(selectors.searchBar);
    
    // 1. ניסיון למצוא את הסרגל הרגיל
    els.navContainer = findElement(selectors.navContainer);

    // 2. אם הסרגל הרגיל לא נמצא, מחפשים את המיכל ההורי להזרקת סרגל מותאם
    if (!els.navContainer) {
       els.sidebarParent = findElement(selectors.sidebarParent);
       app.state.isCustomSidebar = !!els.sidebarParent;
    } else {
       app.state.isCustomSidebar = false;
    }
    
    // איתור כפתורי הניווט הראשיים (רק אם הסרגל הרגיל קיים)
    if (els.navContainer) {
      const buttonContainerSelector = Array.isArray(selectors.buttonContainer) ? selectors.buttonContainer[0] : selectors.buttonContainer;
      
      const mailButtonLabel = els.navContainer.querySelector('div[aria-label^="אימייל"], div[aria-label^="Mail"]');
      els.mailButton = mailButtonLabel ? mailButtonLabel.closest(buttonContainerSelector) : null;
      
      const chatButtonLabel = findElement(selectors.chatButton);
      els.chatButton = chatButtonLabel ? chatButtonLabel.closest(buttonContainerSelector) : null;
      
      const meetButtonLabel = findElement(selectors.meetButton);
      els.meetButton = meetButtonLabel ? meetButtonLabel.closest(buttonContainerSelector) : null;
    }

    // החזר אמת אם מצאנו סרגל רגיל או מקום להזריק סרגל מותאם
    return els.navContainer !== null || els.sidebarParent !== null;
  };

  // פונקציה ליצירת סרגל מותאם אישית (כאשר המקורי חסר)
  app.dom.createCustomSidebar = function() {
      const els = app.state.elements;
      if (!els.sidebarParent) return null;

      // בדיקה אם כבר יצרנו אותו
      const existingSidebar = document.getElementById('the-channel-custom-sidebar');
      if (existingSidebar) return document.getElementById('the-channel-button');

      const sidebar = document.createElement('div');
      sidebar.id = 'the-channel-custom-sidebar';
      sidebar.setAttribute('role', 'navigation');

      // 1. יצירת כפתור Mail מותאם
      const mailBtn = document.createElement('div');
      mailBtn.className = 'custom-nav-btn active'; // ברירת מחדל פעיל
      mailBtn.setAttribute('role', 'link');
      mailBtn.setAttribute('aria-label', 'Mail');
      
      const mailIconContainer = document.createElement('div');
      mailIconContainer.className = 'icon-container';
      
      // אייקון Mail של גוגל
      mailIconContainer.innerHTML = `
        <svg focusable="false" viewBox="0 0 24 24">
            <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"></path>
        </svg>`;
      
      const mailLabel = document.createElement('div');
      mailLabel.className = 'label';
      mailLabel.textContent = 'Mail';

      mailBtn.appendChild(mailIconContainer);
      mailBtn.appendChild(mailLabel);
      
      // שמירת הרפרנס לכפתור המייל כדי ש-events.js יוכל לחבר לו מאזינים
      els.mailButton = mailBtn;

      // 2. יצירת כפתור TheChannel (משתמש בלוגיקה הקיימת אבל עטוף)
      // אנחנו ניצור אותו ידנית כאן כדי שיתאים למבנה
      const channelBtn = document.createElement('div');
      channelBtn.id = 'the-channel-button';
      channelBtn.className = 'custom-nav-btn'; // שימוש במחלקה של הסרגל המותאם
      channelBtn.setAttribute('role', 'link');
      channelBtn.setAttribute('aria-label', 'TheChannel');

      const channelIconContainer = document.createElement('div');
      channelIconContainer.className = 'the-channel-icon-container'; // שימוש במחלקה המקורית לצורך ה-SVG

      // אותם אייקונים בדיוק כמו ב-createNavButton
      const iconSvgDefault = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      iconSvgDefault.setAttribute('class', 'the-channel-icon the-channel-icon-default');
      iconSvgDefault.setAttribute('viewBox', '0 0 50 50');
      const iconPathDefault = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      iconPathDefault.setAttribute('d', 'M386 420 c-70 -53 -139 -73 -253 -74 l-103 -1 0 -68 c0 -38 8 -98 17 -133 l17 -64 48 0 c48 0 48 0 42 28 -4 15 -11 37 -15 50 -12 32 -13 32 25 32 52 0 155 -35 216 -74 l55 -35 3 71 c2 45 8 76 17 85 19 18 19 34 0 59 -9 12 -14 43 -15 87 0 37 -3 67 -7 66 -5 0 -25 -13 -47 -29z m24 -156 c0 -69 -3 -124 -7 -122 -109 54 -142 68 -174 73 -38 7 -39 8 -39 49 l0 43 63 17 c34 9 80 28 102 41 22 13 43 24 48 24 4 1 7 -56 7 -125z m-250 1 l0 -45 -50 0 -50 0 0 45 0 45 50 0 50 0 0 -45z m-56 -99 c3 -13 9 -31 12 -40 4 -10 1 -16 -9 -16 -19 0 -23 5 -32 48 -5 25 -3 32 8 32 8 0 18 -11 21 -24z');
      iconPathDefault.setAttribute('transform', 'translate(0, 50) scale(0.1, -0.1)');
      iconPathDefault.setAttribute('fill', 'currentColor');
      iconSvgDefault.appendChild(iconPathDefault);

      const iconSvgSelected = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      iconSvgSelected.setAttribute('class', 'the-channel-icon the-channel-icon-selected');
      iconSvgSelected.setAttribute('viewBox', '0 0 50 50');
      const iconPathSelected = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      iconPathSelected.setAttribute('d', 'M386 420 c-70 -53 -139 -73 -253 -74 l-103 -1 0 -68 c0 -38 8 -98 17 -133 l17 -64 48 0 c48 0 48 0 42 28 -4 15 -11 37 -15 50 -12 32 -13 32 25 32 52 0 155 -35 216 -74 l55 -35 3 71 c2 45 8 76 17 85 19 18 19 34 0 59 -9 12 -14 43 -15 87 0 37 -3 67 -7 66 -5 0 -25 -13 -47 -29z');
      iconPathSelected.setAttribute('transform', 'translate(0, 50) scale(0.1, -0.1)');
      iconPathSelected.setAttribute('fill', 'currentColor');
      iconSvgSelected.appendChild(iconPathSelected);

      channelIconContainer.appendChild(iconSvgDefault);
      channelIconContainer.appendChild(iconSvgSelected);

      const channelLabel = document.createElement('div');
      channelLabel.className = 'label'; // שימוש במחלקה של הסרגל המותאם
      channelLabel.textContent = 'הערוץ';

      channelBtn.appendChild(channelIconContainer);
      channelBtn.appendChild(channelLabel);

      // הרכבת הסרגל
      sidebar.appendChild(mailBtn);
      sidebar.appendChild(channelBtn);

      // הוספה לתחילת המיכל ההורי
      els.sidebarParent.prepend(sidebar);

      return channelBtn;
  };

  // יוצר את כפתור הניווט של TheChannel
  app.dom.createNavButton = function() {
    const selectors = app.state.selectors;
    
    // ניתוב: אם אין סרגל רגיל ויש הורה מתאים - צור סרגל מותאם
    if (app.state.isCustomSidebar) {
        return this.createCustomSidebar();
    }

    const navContainer = app.state.elements.navContainer;
    if (!navContainer) return null;

    // --- הקוד המקורי ליצירת כפתור בסרגל הקיים ---
    const newButton = document.createElement('div');
    newButton.id = 'the-channel-button';
    newButton.className = findElement(selectors.buttonContainer)?.className || 'Xa';
    newButton.setAttribute('role', 'link');
    newButton.setAttribute('tabindex', '0');
    newButton.setAttribute('aria-label', 'TheChannel');

    const iconContainer = document.createElement('div');
    iconContainer.className = 'the-channel-icon-container';

    const iconSvgDefault = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    iconSvgDefault.setAttribute('class', 'the-channel-icon the-channel-icon-default');
    iconSvgDefault.setAttribute('viewBox', '0 0 50 50');
    iconSvgDefault.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    
    const iconPathDefault = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    iconPathDefault.setAttribute('d', 'M386 420 c-70 -53 -139 -73 -253 -74 l-103 -1 0 -68 c0 -38 8 -98 17 -133 l17 -64 48 0 c48 0 48 0 42 28 -4 15 -11 37 -15 50 -12 32 -13 32 25 32 52 0 155 -35 216 -74 l55 -35 3 71 c2 45 8 76 17 85 19 18 19 34 0 59 -9 12 -14 43 -15 87 0 37 -3 67 -7 66 -5 0 -25 -13 -47 -29z m24 -156 c0 -69 -3 -124 -7 -122 -109 54 -142 68 -174 73 -38 7 -39 8 -39 49 l0 43 63 17 c34 9 80 28 102 41 22 13 43 24 48 24 4 1 7 -56 7 -125z m-250 1 l0 -45 -50 0 -50 0 0 45 0 45 50 0 50 0 0 -45z m-56 -99 c3 -13 9 -31 12 -40 4 -10 1 -16 -9 -16 -19 0 -23 5 -32 48 -5 25 -3 32 8 32 8 0 18 -11 21 -24z');
    iconPathDefault.setAttribute('transform', 'translate(0, 50) scale(0.1, -0.1)');
    iconPathDefault.setAttribute('fill', 'currentColor');
    
    iconSvgDefault.appendChild(iconPathDefault);
    iconContainer.appendChild(iconSvgDefault);

    const iconSvgSelected = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    iconSvgSelected.setAttribute('class', 'the-channel-icon the-channel-icon-selected');
    iconSvgSelected.setAttribute('viewBox', '0 0 50 50');
    iconSvgSelected.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    
    const iconPathSelected = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    iconPathSelected.setAttribute('d', 'M386 420 c-70 -53 -139 -73 -253 -74 l-103 -1 0 -68 c0 -38 8 -98 17 -133 l17 -64 48 0 c48 0 48 0 42 28 -4 15 -11 37 -15 50 -12 32 -13 32 25 32 52 0 155 -35 216 -74 l55 -35 3 71 c2 45 8 76 17 85 19 18 19 34 0 59 -9 12 -14 43 -15 87 0 37 -3 67 -7 66 -5 0 -25 -13 -47 -29z');
    iconPathSelected.setAttribute('transform', 'translate(0, 50) scale(0.1, -0.1)');
    iconPathSelected.setAttribute('fill', 'currentColor');
    
    iconSvgSelected.appendChild(iconPathSelected);
    iconContainer.appendChild(iconSvgSelected);

    const label = document.createElement('div');
    label.className = 'the-channel-label';
    label.textContent = 'הערוץ';

    newButton.appendChild(iconContainer);
    newButton.appendChild(label);

    const spacer = findElement(selectors.navSpacer);
    if (spacer) {
      navContainer.insertBefore(newButton, spacer);
    } else {
      navContainer.appendChild(newButton);
    }

    return newButton;
  };

  // יוצר את ה-iframe שיטען את האתר
  app.dom.createIframe = function() {
    const container = document.createElement('div');
    container.id = 'the-channel-iframe-container';
    container.style.cssText = 'display:none; position:absolute; top:0; left:0; width:100%; height:100%;';

    const iframe = document.createElement('iframe');
    iframe.src = 'http://localhost:4200/';
    iframe.style.cssText = 'width:100%; height:100%; border:none;';
    iframe.allow = 'clipboard-read; clipboard-write;';

    container.appendChild(iframe);
    app.state.elements.iframeParent.appendChild(container);
    return container;
  };

  // מעדכן את הנראות של כפתורי הניווט (כשנכנסים ל-TheChannel)
  app.dom.updateActiveButtonVisuals = function() {
    const isTheChannelActive = window.location.hash.startsWith('#the-channel');
    const theChannelButton = app.state.elements.theChannelButton;
    
    // --- טיפול במצב סרגל מותאם אישית ---
    if (app.state.isCustomSidebar) {
        const mailButton = app.state.elements.mailButton;
        if (isTheChannelActive) {
            mailButton?.classList.remove('active');
            theChannelButton?.classList.add('acZ', 'active'); // acZ for icon logic, active for bg
        } else {
            theChannelButton?.classList.remove('acZ', 'active');
            mailButton?.classList.add('active');
        }
        return;
    }
    
    // --- טיפול במצב סרגל רגיל ---
    const selectors = app.state.selectors;
    const activeClassesArray = [
      ...(Array.isArray(selectors.activeNavButton) ? selectors.activeNavButton : [selectors.activeNavButton]),
      ...(Array.isArray(selectors.activeNavButton2) ? selectors.activeNavButton2 : [selectors.activeNavButton2])
    ];

    if (isTheChannelActive) {
      // הסרת מחלקות פעילות מכל הכפתורים
      const navContainerSelector = Array.isArray(selectors.navContainer) ? selectors.navContainer[0] : selectors.navContainer;
      const buttonContainerSelector = Array.isArray(selectors.buttonContainer) ? selectors.buttonContainer[0] : selectors.buttonContainer;
      document.querySelectorAll(`${navContainerSelector} ${buttonContainerSelector}`).forEach(btn => {
        btn.classList.remove(...activeClassesArray);
      });
      
      if (theChannelButton) {
        theChannelButton.classList.add(...activeClassesArray);
      }
    } else {
      if (theChannelButton) {
        theChannelButton.classList.remove(...activeClassesArray);
      }
      
      if (window.location.hash.startsWith('#chat')) {
        app.state.elements.chatButton?.classList.add(...activeClassesArray);
      } else if (window.location.hash.startsWith('#meet') || window.location.hash.startsWith('#calls')) {
        app.state.elements.meetButton?.classList.add(...activeClassesArray);
      } else {
        app.state.elements.mailButton?.classList.add(...activeClassesArray);
      }
    }
  };
  
  // מעדכן את נראות כפתור "אימייל חדש"
  app.dom.updateComposeButtonVisibility = function() {
      // במצב סרגל מותאם, ייתכן שאין צורך בלוגיקה הזו כי אין כפתורי Compose נסתרים באותה צורה
      // אבל נשאיר להגנה
      if (app.state.isCustomSidebar) return;

      const selectors = app.state.selectors;
      const closestSidebarSelector = Array.isArray(selectors.closestSidebar) ? selectors.closestSidebar[0] : selectors.closestSidebar;
      const gmailSidebar = findElement(selectors.gmailSidebarContainer)?.closest(closestSidebarSelector);
      const chatSidebar = findElement(selectors.chatSidebarContainer)?.closest(closestSidebarSelector);
      const activeClass = Array.isArray(selectors.activeNavButton2) ? selectors.activeNavButton2[0] : selectors.activeNavButton2;

      if (window.location.hash.startsWith('#calls')) {
        if (gmailSidebar && chatSidebar) {
          gmailSidebar.classList.remove(activeClass);
          chatSidebar.classList.remove(activeClass);
        }
      } else if (window.location.hash.startsWith('#chat')) {
        if (gmailSidebar){
          gmailSidebar.classList.remove(activeClass);
        }
      } else {
        if(chatSidebar){
          chatSidebar.classList.remove(activeClass);
        }
      }
  };

  // מציג את תצוגת TheChannel ומסתיר את Gmail
  app.dom.showTheChannel = function() {
    const els = app.state.elements;
    
    // טיפול בסגירת סרגל הצד (רלוונטי רק לסרגל הרגיל)
    if (!app.state.isCustomSidebar && els.hamburgerButton?.getAttribute('aria-expanded') === 'true') {
      app.state.HamburgerClick = false;
      els.hamburgerButton.click();
      app.state.HamburgerClick = true;
      app.state.wasSidebarClosedByExtension = true;
      app.storage.setSidebarClosedByExtension(true);
    }

    els.gmailView?.classList.add('the-channel-active-hide-gmail');
    els.searchBar?.classList.add('the-channel-active-hide-gmail');
    
    toggleDynamicBars(true); 

    if (els.iframeContainer) els.iframeContainer.style.display = 'block';
    
    this.updateActiveButtonVisuals();
  };

  // מציג את Gmail ומסתיר את TheChannel
  app.dom.showGmail = function() {
    const els = app.state.elements;
    if (els.iframeContainer) els.iframeContainer.style.display = 'none';
    els.gmailView?.classList.remove('the-channel-active-hide-gmail');
    els.searchBar?.classList.remove('the-channel-active-hide-gmail');
    
    toggleDynamicBars(false);

    window.dispatchEvent(new Event('resize'));

    if (!app.state.isCustomSidebar && app.state.wasSidebarClosedByExtension) {
      setTimeout(() => els.hamburgerButton?.click(), 0);
      app.state.wasSidebarClosedByExtension = false;
      app.storage.setSidebarClosedByExtension(false);
    }
    this.updateActiveButtonVisuals();
  };

})(TheChannelViewer);