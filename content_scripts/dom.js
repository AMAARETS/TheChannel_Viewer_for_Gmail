// קובץ זה מרכז את כל הפונקציונליות האחראית על אינטראקציה עם ה-DOM.
(function(app) {

  function findElement(selectors) {
    if (!selectors) return null;
    const selectorArray = Array.isArray(selectors) ? selectors : [selectors];
    for (const selector of selectorArray) {
      const element = document.querySelector(selector);
      if (element) return element;
    }
    return null;
  }

  function toggleDynamicBars(shouldHide) {
    const selectors = app.state.selectors;
    if (!selectors) return;

    const toolbar = findElement(selectors.gmailToolbar);
    const filterBar = findElement(selectors.searchFilterBar);
    const action = shouldHide ? 'add' : 'remove';

    if (toolbar) toolbar.classList[action]('the-channel-active-hide-gmail');
    if (filterBar) filterBar.classList[action]('the-channel-active-hide-gmail');
  }

  // פונקציה להזרקת CSS דינמי שמטפל בהזזת הסרגל המכווץ
  app.dom.injectDynamicStyles = function() {
      const selectors = app.state.selectors;
      if (!selectors || !selectors.gmailSidebarCollapsed) return;

      const styleId = 'the-channel-dynamic-styles';
      let styleTag = document.getElementById(styleId);
      
      if (!styleTag) {
          styleTag = document.createElement('style');
          styleTag.id = styleId;
          document.head.appendChild(styleTag);
      }

      const collapsedSelector = Array.isArray(selectors.gmailSidebarCollapsed) 
                                ? selectors.gmailSidebarCollapsed[0] 
                                : selectors.gmailSidebarCollapsed;

      // מבטיח שהמרג'ין יחול רק כשהסרגל גלוי. ברגע שהוא מוסתר (בצפייה בערוץ), המרג'ין מתבטל.
      const cssRule = `
        #the-channel-custom-sidebar ~ ${collapsedSelector}:not(.the-channel-active-hide-gmail) { 
            margin-right: 72px !important; 
        }
      `;
      
      styleTag.textContent = cssRule;
  };

  app.dom.queryElements = function() {
    const els = app.state.elements;
    const selectors = app.state.selectors;
    
    if (!selectors) return false;

    // הפעלת הזרקת ה-CSS הדינמי
    app.dom.injectDynamicStyles();

    els.gmailView = findElement(selectors.gmailView);
    els.iframeParent = findElement(selectors.iframeParent);
    els.hamburgerButton = findElement(selectors.hamburgerButton);
    els.searchBar = findElement(selectors.searchBar);
    
    els.navContainer = findElement(selectors.navContainer);
    els.sidebarParent = findElement(selectors.sidebarParent);

    // --- זיהוי סרגלים לצורך הסתרה (TheChannel View) ---
    // שימוש באותה לוגיקה בדיוק כמו ב-updateComposeButtonVisibility
    const closestSelector = Array.isArray(selectors.closestSidebar) ? selectors.closestSidebar[0] : selectors.closestSidebar;
    
    // מציאת סרגל המייל
    const gmailInner = findElement(selectors.gmailSidebarContainer);
    els.gmailSidebar = gmailInner ? gmailInner.closest(closestSelector) : null;

    // מציאת סרגל הצ'אט
    const chatInner = findElement(selectors.chatSidebarContainer);
    els.chatSidebar = chatInner ? chatInner.closest(closestSelector) : null;

    // גיבוי למקרה של מבנה ישן/אחר (aeN) - רלוונטי בעיקר אם לא נמצאו הספציפיים
    if (!els.gmailSidebar && !els.chatSidebar) {
         els.gmailSidebar = findElement(selectors.gmailSidebar);
    }

    // קביעה האם זהו מצב מותאם אישית (ללא סרגל גוגל)
    if (!els.navContainer) {
       app.state.isCustomSidebar = !!els.sidebarParent;
    } else {
       app.state.isCustomSidebar = false;
    }
    
    if (els.navContainer) {
      const buttonContainerSelector = Array.isArray(selectors.buttonContainer) ? selectors.buttonContainer[0] : selectors.buttonContainer;
      const mailButtonLabel = els.navContainer.querySelector('div[aria-label^="אימייל"], div[aria-label^="Mail"]');
      els.mailButton = mailButtonLabel ? mailButtonLabel.closest(buttonContainerSelector) : null;
      const chatButtonLabel = findElement(selectors.chatButton);
      els.chatButton = chatButtonLabel ? chatButtonLabel.closest(buttonContainerSelector) : null;
      const meetButtonLabel = findElement(selectors.meetButton);
      els.meetButton = meetButtonLabel ? meetButtonLabel.closest(buttonContainerSelector) : null;
    }

    // תנאי הצלחה
    return els.navContainer !== null || els.sidebarParent !== null;
  };

  app.dom.createCustomSidebar = function() {
      const els = app.state.elements;
      if (!els.sidebarParent) return null;

      const existingSidebar = document.getElementById('the-channel-custom-sidebar');
      if (existingSidebar) return document.getElementById('the-channel-button');

      const sidebar = document.createElement('div');
      sidebar.id = 'the-channel-custom-sidebar';
      sidebar.setAttribute('role', 'navigation');

      const mailBtn = document.createElement('div');
      mailBtn.className = 'custom-nav-btn active';
      mailBtn.setAttribute('role', 'link');
      mailBtn.setAttribute('aria-label', 'Mail');
      
      const mailIconContainer = document.createElement('div');
      mailIconContainer.className = 'icon-container';
      
      const mailIconFilled = document.createElement('div');
      mailIconFilled.className = 'custom-icon icon-filled';
      mailIconFilled.innerHTML = `
        <svg focusable="false" viewBox="0 0 24 24">
            <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"></path>
        </svg>`;

      const mailIconOutline = document.createElement('div');
      mailIconOutline.className = 'custom-icon icon-outline';
      mailIconOutline.innerHTML = `
        <svg focusable="false" viewBox="0 0 24 24">
            <path d="M22 6C22 4.9 21.1 4 20 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6ZM20 6L12 11L4 6H20ZM20 18H4V8L12 13L20 8V18Z"></path>
        </svg>`;
      
      mailIconContainer.appendChild(mailIconFilled);
      mailIconContainer.appendChild(mailIconOutline);
      
      const mailLabel = document.createElement('div');
      mailLabel.className = 'label';
      mailLabel.textContent = 'Mail';

      mailBtn.appendChild(mailIconContainer);
      mailBtn.appendChild(mailLabel);
      
      els.mailButton = mailBtn;

      const channelBtn = document.createElement('div');
      channelBtn.id = 'the-channel-button';
      channelBtn.className = 'custom-nav-btn';
      channelBtn.setAttribute('role', 'link');
      channelBtn.setAttribute('aria-label', 'TheChannel');

      const channelIconContainer = document.createElement('div');
      channelIconContainer.className = 'the-channel-icon-container';

      // --- יצירת ה-Badge ---
      const badge = document.createElement('div');
      badge.className = 'the-channel-badge';
      channelIconContainer.appendChild(badge);
      // --------------------

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
      channelLabel.className = 'label';
      channelLabel.textContent = 'הערוץ';

      channelBtn.appendChild(channelIconContainer);
      channelBtn.appendChild(channelLabel);

      sidebar.appendChild(mailBtn);
      sidebar.appendChild(channelBtn);

      els.sidebarParent.prepend(sidebar);

      return channelBtn;
  };

  app.dom.createNavButton = function() {
    if (app.state.isCustomSidebar) {
        return this.createCustomSidebar();
    }
    
    const selectors = app.state.selectors;
    const navContainer = app.state.elements.navContainer;
    if (!navContainer) return null;

    const newButton = document.createElement('div');
    newButton.id = 'the-channel-button';
    newButton.className = findElement(selectors.buttonContainer)?.className || 'Xa';
    newButton.setAttribute('role', 'link');
    newButton.setAttribute('tabindex', '0');
    newButton.setAttribute('aria-label', 'TheChannel');

    const iconContainer = document.createElement('div');
    iconContainer.className = 'the-channel-icon-container';

    // --- יצירת ה-Badge ---
    const badge = document.createElement('div');
    badge.className = 'the-channel-badge';
    iconContainer.appendChild(badge);
    // --------------------

    const iconSvgDefault = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    iconSvgDefault.setAttribute('class', 'the-channel-icon the-channel-icon-default');
    iconSvgDefault.setAttribute('viewBox', '0 0 50 50');
    iconSvgDefault.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const iconPathDefault = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    iconPathDefault.setAttribute('d', 'M386 420 c-70 -53 -139 -73 -253 -74 l-103 -1 0 -68 c0 -38 8 -98 17 -133 l17 -64 48 0 c48 0 48 0 42 28 -4 15 -11 37 -15 50 -12 32 -13 32 25 32 52 0 155 -35 216 -74 l55 -35 3 71 c2 45 8 76 17 85 19 18 19 34 0 59 -9 12 -14 43 -15 87 0 37 -3 67 -7 66 -5 0 -25 -13 -47 -29z m24 -156 c0 -69 -3 -124 -7 -122 -109 54 -142 68 -174 73 -38 7 -39 8 -39 49 l0 43 63 17 c34 9 80 28 102 41 22 13 43 24 48 24 4 1 7 -56 7 -125z m-250 1 l0 -45 -50 0 -50 0 0 45 0 45 50 0 50 0 0 -45z m-56 -99 c3 -13 9 -31 12 -40 4 -10 1 -16 -9 -16 -19 0 -23 5 -32 48 -5 25 -3 32 8 32 8 0 18 -11 21 -24z');
    iconPathDefault.setAttribute('transform', 'translate(0, 50) scale(0.1, -0.1)');
    iconPathDefault.setAttribute('fill', 'currentColor');
    iconSvgDefault.appendChild(iconPathDefault);

    const iconSvgSelected = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    iconSvgSelected.setAttribute('class', 'the-channel-icon the-channel-icon-selected');
    iconSvgSelected.setAttribute('viewBox', '0 0 50 50');
    iconSvgSelected.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const iconPathSelected = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    iconPathSelected.setAttribute('d', 'M386 420 c-70 -53 -139 -73 -253 -74 l-103 -1 0 -68 c0 -38 8 -98 17 -133 l17 -64 48 0 c48 0 48 0 42 28 -4 15 -11 37 -15 50 -12 32 -13 32 25 32 52 0 155 -35 216 -74 l55 -35 3 71 c2 45 8 76 17 85 19 18 19 34 0 59 -9 12 -14 43 -15 87 0 37 -3 67 -7 66 -5 0 -25 -13 -47 -29z');
    iconPathSelected.setAttribute('transform', 'translate(0, 50) scale(0.1, -0.1)');
    iconPathSelected.setAttribute('fill', 'currentColor');
    iconSvgSelected.appendChild(iconPathSelected);

    iconContainer.appendChild(iconSvgDefault);
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

  app.dom.createIframe = function() {
      const container = document.createElement('div');
      container.id = 'the-channel-iframe-container';
      // הקונטיינר עצמו מוסתר, אבל ה-Iframe שבתוכו יתחיל להיטען
      container.style.cssText = 'display:none; position:absolute; top:0; left:0; width:100%; height:100%;';
      
      const loader = document.createElement('div');
      loader.id = 'the-channel-loader';
      loader.innerHTML = `
        <div class="the-channel-spinner"></div>
        <div class="the-channel-loading-text">טוען את הערוץ...</div>
      `;
      container.appendChild(loader);

      const iframe = document.createElement('iframe');
      // טעינה מיידית - וודא שזה HTTPS אם אפשר, או אשר Insecure Content בדפדפן
      iframe.src = 'http://localhost:4200/'; 
      iframe.style.cssText = 'width:100%; height:100%; border:none; display:none;'; // מוסתר עד שיסיים לטעון
      iframe.allow = 'clipboard-read; clipboard-write; fullscreen;';
      
      // מאזין אירוע: ברגע שה-Iframe סיים לטעון, נחליף בין הספינר לתוכן
      iframe.onload = function() {
          console.log('TheChannel Viewer: Iframe loaded successfully');
          loader.style.display = 'none';
          iframe.style.display = 'block';
      };

      // טיפול במקרה של שגיאת טעינה (למשל Mixed Content חסום)
      iframe.onerror = function() {
          loader.querySelector('.the-channel-loading-text').textContent = 'שגיאה בטעינת הערוץ. וודא שהשרת רץ ושהרשאות ה-Insecure Content מאושרות.';
      };

      container.appendChild(iframe);
      app.state.elements.iframeParent.appendChild(container);
      return container;
  };

  // --- פונקציה לעדכון ה-Badge ---
  app.dom.updateUnreadBadge = function(count) {
    const theChannelButton = app.state.elements.theChannelButton;
    if (!theChannelButton) return;

    const badge = theChannelButton.querySelector('.the-channel-badge');
    if (!badge) return;

    if (count && count > 0) {
        // הצג אם יש הודעות
        badge.textContent = count > 99 ? '99+' : count.toString();
        badge.classList.add('visible');
    } else {
        // הסתר אם אין
        badge.classList.remove('visible');
    }
  };

  app.dom.updateActiveButtonVisuals = function() {
    const isTheChannelActive = window.location.hash.startsWith('#the-channel');
    const theChannelButton = app.state.elements.theChannelButton;
    
    if (app.state.isCustomSidebar) {
        const mailButton = app.state.elements.mailButton;
        if (isTheChannelActive) {
            mailButton?.classList.remove('active');
            theChannelButton?.classList.add('acZ', 'active');
        } else {
            theChannelButton?.classList.remove('acZ', 'active');
            mailButton?.classList.add('active');
        }
        return;
    }
    
    const selectors = app.state.selectors;
    const activeClassesArray = [
      ...(Array.isArray(selectors.activeNavButton) ? selectors.activeNavButton : [selectors.activeNavButton]),
      ...(Array.isArray(selectors.activeNavButton2) ? selectors.activeNavButton2 : [selectors.activeNavButton2])
    ];

    if (isTheChannelActive) {
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
  
  app.dom.updateComposeButtonVisibility = function() {
      // אם אנחנו בסרגל מותאם אישית, אין מה להסתיר כי הסרגל שלנו מכסה הכל
      if (app.state.isCustomSidebar) return;

      const selectors = app.state.selectors;
      const closestSidebarSelector = Array.isArray(selectors.closestSidebar) ? selectors.closestSidebar[0] : selectors.closestSidebar;
      
      // משתמשים בזיהוי חי (כפי שהיה במקור) כדי לטפל בלוגיקה של ג'ימייל נטו
      const gmailSidebar = findElement(selectors.gmailSidebarContainer)?.closest(closestSidebarSelector);
      const chatSidebar = findElement(selectors.chatSidebarContainer)?.closest(closestSidebarSelector);
      const activeClass = Array.isArray(selectors.activeNavButton2) ? selectors.activeNavButton2[0] : selectors.activeNavButton2;

      // לוגיקה זו מונעת משני הסרגלים להיות מוצגים יחד במעבר בין אפליקציות גוגל
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
        // ברירת מחדל (Mail)
        if(chatSidebar){
          chatSidebar.classList.remove(activeClass);
        }
      }
  };

  app.dom.showTheChannel = function() {
      const els = app.state.elements;
      
      if (els.gmailSidebar) els.gmailSidebar.classList.add('the-channel-active-hide-gmail');
      if (els.chatSidebar) els.chatSidebar.classList.add('the-channel-active-hide-gmail');
      els.gmailView?.classList.add('the-channel-active-hide-gmail');
      els.searchBar?.classList.add('the-channel-active-hide-gmail');
      
      toggleDynamicBars(true); 
      
      if (els.iframeContainer) {
          els.iframeContainer.style.display = 'block';
      }
      
      this.updateActiveButtonVisuals();
  };

  app.dom.showGmail = function() {
    const els = app.state.elements;
    
    // הסתרת הערוץ
    if (els.iframeContainer) els.iframeContainer.style.display = 'none';
    
    // החזרת התצוגה של ג'ימייל
    els.gmailView?.classList.remove('the-channel-active-hide-gmail');
    els.searchBar?.classList.remove('the-channel-active-hide-gmail');
    
    // החזרת הסרגלים הצידיים (הסרת ה-Class המסתיר שלנו)
    if (els.gmailSidebar) {
        els.gmailSidebar.classList.remove('the-channel-active-hide-gmail');
    }
    
    if (els.chatSidebar) {
        els.chatSidebar.classList.remove('the-channel-active-hide-gmail');
    }

    toggleDynamicBars(false);
    window.dispatchEvent(new Event('resize'));
    
    // כאן updateComposeButtonVisibility ייקרא מיד אחרי דרך events.js -> handleHashChange
    // כדי להבטיח שרק הסרגל הנכון (מייל או צ'אט) יוצג לפי ה-Hash
    
    this.updateActiveButtonVisuals();
  };

})(TheChannelViewer);