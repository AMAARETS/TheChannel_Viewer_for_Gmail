// קובץ זה מרכז את כל הפונקציונליות האחראית על אינטראקציה עם ה-DOM.
(function(app) {

  // שולף את כל אלמנטי המפתח מהדף ושומר אותם ב-state
  app.dom.queryElements = function() {
    const els = app.state.elements;
    const selectors = app.state.selectors;
    
    if (!selectors) return false; // ודא שהמזהים נטענו

    els.gmailView = document.querySelector(selectors.gmailView);
    els.iframeParent = document.querySelector(selectors.iframeParent);
    els.hamburgerButton = document.querySelector(selectors.hamburgerButton);
    els.searchBar = document.querySelector(selectors.searchBar);
    els.navContainer = document.querySelector(selectors.navContainer);
    
    // איתור כפתורי הניווט הראשיים של Gmail
    if (els.navContainer) {
      const mailButtonLabel = els.navContainer.querySelector('div[aria-label^="אימייל"], div[aria-label^="Mail"]');
      els.mailButton = mailButtonLabel ? mailButtonLabel.closest(selectors.buttonContainer) : null;
      
      const chatButtonLabel = els.navContainer.querySelector('div[aria-label^="צ\'אט"], div[aria-label^="Chat"]');
      els.chatButton = chatButtonLabel ? chatButtonLabel.closest(selectors.buttonContainer) : null;
      
      const meetButtonLabel = els.navContainer.querySelector('div[aria-label^="Meet"]');
      els.meetButton = meetButtonLabel ? meetButtonLabel.closest(selectors.buttonContainer) : null;
    }

    return Object.values(els).every(el => el !== null);
  };

  // יוצר את כפתור הניווט של TheChannel
  app.dom.createNavButton = function() {
    const selectors = app.state.selectors;
    // נשתמש בכפתור הצ'אט שכבר איתרנו ב-queryElements
    const chatButtonContainer = app.state.elements.chatButton;
    if (!chatButtonContainer) return null;

    const newButton = chatButtonContainer.cloneNode(true);
    newButton.id = 'the-channel-button';
    newButton.classList.remove(selectors.activeNavButton, selectors.activeNavButton2);
    newButton.removeAttribute('jscontroller');
    newButton.querySelector('[aria-label]')?.setAttribute('aria-label', 'TheChannel');
    newButton.querySelector(selectors.buttonLabel).textContent = 'הערוץ';
    
    const iconContainer = newButton.querySelector(selectors.buttonIconContainer);
    if (iconContainer) {
        iconContainer.addEventListener('mouseover', () => {
            if (!newButton.classList.contains(selectors.activeNavButton)) {
                iconContainer.style.backgroundColor = '#f1f3f4';
            }
        });
        iconContainer.addEventListener('mouseout', () => {
            iconContainer.style.backgroundColor = 'transparent';
        });
    }

    const spacer = app.state.elements.navContainer.querySelector(selectors.navSpacer);
    app.state.elements.navContainer.insertBefore(newButton, spacer);
    return newButton;
  };

  // יוצר את ה-iframe שיטען את האתר
  app.dom.createIframe = function() {
    const container = document.createElement('div');
    container.id = 'the-channel-iframe-container';
    container.style.cssText = 'display:none; position:absolute; top:0; left:0; width:100%; height:100%;';

    const iframe = document.createElement('iframe');
    iframe.src = 'https://thechannel-viewer.clickandgo.cfd/';
    iframe.style.cssText = 'width:100%; height:100%; border:none;';
    iframe.allow = 'clipboard-read; clipboard-write';

    container.appendChild(iframe);
    app.state.elements.iframeParent.appendChild(container);
    return container;
  };

  // מעדכן את הנראות של כפתורי הניווט (כשנכנסים ל-TheChannel)
  app.dom.updateActiveButtonVisuals = function() {
    const selectors = app.state.selectors;
    const isTheChannelActive = window.location.hash.startsWith('#the-channel');
    
    const activeClasses = [selectors.activeNavButton, selectors.activeNavButton2];

    if (isTheChannelActive) {
      document.querySelectorAll(`${selectors.navContainer} ${selectors.buttonContainer}`).forEach(btn => btn.classList.remove(...activeClasses));
      app.state.elements.theChannelButton?.classList.add(...activeClasses);
    } else {
      app.state.elements.theChannelButton?.classList.remove(...activeClasses);
      // הלוגיקה פה נשארת זהה כי היא מטפלת במצב *אחרי* שהניווט כבר התבצע
      if (window.location.hash.startsWith('#chat')) {
        app.state.elements.chatButton?.classList.add(...activeClasses);
      } else if (window.location.hash.startsWith('#meet')) {
        app.state.elements.meetButton?.classList.add(...activeClasses);
      } else {
        // ברירת המחדל היא כפתור המייל
        app.state.elements.mailButton?.classList.add(...activeClasses);
      }
    }
  };
  
  // מעדכן את נראות כפתור "אימייל חדש"
  app.dom.updateComposeButtonVisibility = function() {
      const selectors = app.state.selectors;
      const gmailSidebar = document.querySelector(selectors.gmailSidebarContainer)?.closest(selectors.closestSidebar);
      const chatSidebar = document.querySelector(selectors.chatSidebarContainer)?.closest(selectors.closestSidebar);
      const activeClass = selectors.activeNavButton2;

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
    if (els.hamburgerButton?.getAttribute('aria-expanded') === 'true') {
      app.state.HamburgerClick = false;
      els.hamburgerButton.click();
      app.state.HamburgerClick = true;
      app.state.wasSidebarClosedByExtension = true;
    }

    els.gmailView?.classList.add('the-channel-active-hide-gmail');
    els.searchBar?.classList.add('the-channel-active-hide-gmail');
    if (els.iframeContainer) els.iframeContainer.style.display = 'block';
    
    this.updateActiveButtonVisuals();
  };

  // מציג את Gmail ומסתיר את TheChannel
  app.dom.showGmail = function() {
    const els = app.state.elements;
    if (els.iframeContainer) els.iframeContainer.style.display = 'none';
    els.gmailView?.classList.remove('the-channel-active-hide-gmail');
    els.searchBar?.classList.remove('the-channel-active-hide-gmail');

    window.dispatchEvent(new Event('resize'));

    if (app.state.wasSidebarClosedByExtension) {
      setTimeout(() => els.hamburgerButton?.click(), 0);
      app.state.wasSidebarClosedByExtension = false;
    }
    this.updateActiveButtonVisuals();
  };

})(TheChannelViewer);