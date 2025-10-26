// קובץ זה מרכז את כל הפונקציונליות האחראית על אינטראקציה עם ה-DOM.
(function(app) {

  // שולף את כל אלמנטי המפתח מהדף ושומר אותם ב-state
  app.dom.queryElements = function() {
    const els = app.state.elements;
    els.gmailView = document.querySelector('.aeF');
    els.iframeParent = document.querySelector('.Tm');
    els.hamburgerButton = document.querySelector('.gb_1c');
    els.searchBar = document.querySelector('form[role="search"]');
    els.navContainer = document.querySelector('div[role="navigation"].a6o');
    //els.gmailSidebar = document.querySelector('.aic .T-I-KE')?.closest('.aqn');
    //els.chatSidebar = document.querySelector('div[gh="chat"]')?.closest('.aqn');

    return Object.values(els).every(el => el !== null);
  };

  // יוצר את כפתור הניווט של TheChannel
  app.dom.createNavButton = function() {
    const chatButton = app.state.elements.navContainer.querySelector('div[aria-label^="Chat"]');
    if (!chatButton) return null;
    const buttonContainer = chatButton.closest('.Xa');
    if (!buttonContainer) return null;

    const newButton = buttonContainer.cloneNode(true);
    newButton.id = 'the-channel-button';
    newButton.classList.remove('acZ', 'apV');
    newButton.removeAttribute('jscontroller');
    newButton.querySelector('[aria-label]')?.setAttribute('aria-label', 'TheChannel');
    newButton.querySelector('.apW').textContent = 'הערוץ';
    
    const iconContainer = newButton.querySelector('.V6');
    if (iconContainer) {
        iconContainer.addEventListener('mouseover', () => {
            if (!newButton.classList.contains('acZ')) {
                iconContainer.style.backgroundColor = '#f1f3f4';
            }
        });
        iconContainer.addEventListener('mouseout', () => {
            iconContainer.style.backgroundColor = 'transparent';
        });
    }

    const spacer = app.state.elements.navContainer.querySelector('.al9');
    app.state.elements.navContainer.insertBefore(newButton, spacer);
    return newButton;
  };

  // יוצר את ה-iframe שיטען את האתר
  app.dom.createIframe = function() {
    const container = document.createElement('div');
    container.id = 'the-channel-iframe-container';
    container.style.cssText = 'display:none; position:absolute; top:0; left:0; width:100%; height:100%;';

    const iframe = document.createElement('iframe');
    iframe.src = 'https://thechannel-viewer.clickandgo.cfd';
    iframe.style.cssText = 'width:100%; height:100%; border:none;';
    iframe.allow = 'clipboard-read; clipboard-write';

    container.appendChild(iframe);
    app.state.elements.iframeParent.appendChild(container);
    return container;
  };

  // מעדכן את הנראות של כפתורי הניווט (כשנכנסים ל-TheChannel)
  app.dom.updateActiveButtonVisuals = function() {
    const isTheChannelActive = window.location.hash.startsWith('#the-channel');
    if (isTheChannelActive) {
      document.querySelectorAll('div[role="navigation"].a6o .Xa').forEach(btn => btn.classList.remove('acZ', 'apV'));
      app.state.elements.theChannelButton?.classList.add('acZ', 'apV');
    } else {
      app.state.elements.theChannelButton?.classList.remove('acZ', 'apV');
      if (window.location.hash.startsWith(app.state.lastGmailHash)) {
        if (window.location.hash.startsWith('#chat')) {
          const chatButton = document.querySelector('div[aria-label^="צ\'אט"], div[aria-label^="Chat"]');
          chatButton?.closest('.Xa')?.classList.add('acZ', 'apV');
        } else if (window.location.hash.startsWith('#meet')) {
          const chatButton = document.querySelector('div[aria-label^="Meet"]');
          chatButton?.closest('.Xa')?.classList.add('acZ', 'apV');
        } else {
          const mailButton = document.querySelector('div[aria-label^="אימייל"], div[aria-label^="Mail"]');
          mailButton?.closest('.Xa')?.classList.add('acZ', 'apV');
        }
      }
    }
  };
  
  // מעדכן את נראות כפתור "אימייל חדש"
  app.dom.updateComposeButtonVisibility = function() {
      const gmailSidebar = document.querySelector('.aic .T-I-KE')?.closest('.aqn');
      const chatSidebar = document.querySelector('div[gh="chat"]')?.closest('.aqn');
      if (window.location.hash.startsWith('#calls')) {
        if (gmailSidebar && chatSidebar) {
          gmailSidebar.classList.remove('apV');
          chatSidebar.classList.remove('apV')
        }
      } else if (window.location.hash.startsWith('#chat')) {
        if (gmailSidebar){
          gmailSidebar.classList.remove('apV');
        }
      } else {
        if(chatSidebar){
          chatSidebar.classList.remove('apV')
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