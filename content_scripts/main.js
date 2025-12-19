(function(app) {
  
  const SELECTORS_URL = 'https://cdn.jsdelivr.net/gh/AMAARETS/TheChannel_Viewer_for_Gmail@main/gmail-selectors.json';

  const MESSAGE_TYPES = {
    APP_READY: 'THE_CHANNEL_APP_READY',
    SETTINGS_CHANGED: 'THE_CHANNEL_SETTINGS_CHANGED',
    GET_MANAGED_DOMAINS: 'THE_CHANNEL_GET_MANAGED_DOMAINS',
    REQUEST_PERMISSION: 'THE_CHANNEL_REQUEST_PERMISSION', 
    EXTENSION_READY: 'THE_CHANNEL_EXTENSION_READY',
    SETTINGS_DATA: 'THE_CHANNEL_SETTINGS_DATA',
    MANAGED_DOMAINS_DATA: 'THE_CHANNEL_MANAGED_DOMAINS_DATA',
    GET_UNREAD_STATUS: 'THE_CHANNEL_GET_UNREAD_STATUS',
    UNREAD_STATUS_DATA: 'THE_CHANNEL_UNREAD_STATUS_DATA',
    UNREAD_STATUS_UPDATE: 'THE_CHANNEL_UNREAD_STATUS_UPDATE',
    GET_MUTED_DOMAINS: 'THE_CHANNEL_GET_MUTED_DOMAINS',
    MUTED_DOMAINS_DATA: 'THE_CHANNEL_MUTED_DOMAINS_DATA',
    TOGGLE_MUTE_DOMAIN: 'THE_CHANNEL_TOGGLE_MUTE_DOMAIN'
  };

  function handleMessagesFromIframe(event) {
    const iframe = app.state.elements.iframeContainer?.querySelector('iframe');
    if (!iframe || event.source !== iframe.contentWindow) return;
    
    const { type, payload } = event.data;

    if (type === MESSAGE_TYPES.APP_READY) {
      chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (response) => {
        if (!chrome.runtime.lastError) {
          iframe.contentWindow.postMessage({ type: MESSAGE_TYPES.SETTINGS_DATA, payload: response }, '*');
        }
      });
    }

    if (type === MESSAGE_TYPES.SETTINGS_CHANGED) {
      chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', payload: payload });
    }
    
    if (type === MESSAGE_TYPES.GET_MANAGED_DOMAINS) {
        chrome.runtime.sendMessage({ type: 'GET_MANAGED_DOMAINS'}, (domains) => {
            if (!chrome.runtime.lastError) iframe.contentWindow.postMessage({ type: MESSAGE_TYPES.MANAGED_DOMAINS_DATA, payload: domains }, '*');
        });
    }

    if (type === MESSAGE_TYPES.GET_UNREAD_STATUS) {
        chrome.runtime.sendMessage({ type: 'GET_UNREAD_STATUS' }, (unreadDomains) => {
            if (!chrome.runtime.lastError) {
                iframe.contentWindow.postMessage({ type: MESSAGE_TYPES.UNREAD_STATUS_DATA, payload: unreadDomains }, '*');
                if (Array.isArray(unreadDomains)) app.dom.updateUnreadBadge(unreadDomains.length);
            }
        });
    }

    if (type === MESSAGE_TYPES.GET_MUTED_DOMAINS) {
        chrome.runtime.sendMessage({ type: 'GET_MUTED_DOMAINS' }, (mutedDomains) => {
            if (!chrome.runtime.lastError) iframe.contentWindow.postMessage({ type: MESSAGE_TYPES.MUTED_DOMAINS_DATA, payload: mutedDomains }, '*');
        });
    }

    if (type === MESSAGE_TYPES.TOGGLE_MUTE_DOMAIN) {
        if (payload && payload.domain) chrome.runtime.sendMessage({ type: 'TOGGLE_MUTE_DOMAIN', domain: payload.domain });
    }

    if (type === MESSAGE_TYPES.REQUEST_PERMISSION) {
        if (payload && payload.domain) {
            chrome.runtime.sendMessage({ type: 'OPEN_PERMISSION_POPUP', domain: payload.domain, name: payload.name });
        }
    }
  }

  function handleMessagesFromBackground(message, sender, sendResponse) {
      const iframe = app.state.elements.iframeContainer?.querySelector('iframe');

      if (message.type === 'UNREAD_STATUS_UPDATE') {
          if (Array.isArray(message.payload)) app.dom.updateUnreadBadge(message.payload.length);
          if (iframe?.contentWindow) iframe.contentWindow.postMessage({ type: MESSAGE_TYPES.UNREAD_STATUS_UPDATE, payload: message.payload }, '*');
      }

      if (message.type === 'MUTED_DOMAINS_UPDATE') {
          if (iframe?.contentWindow) iframe.contentWindow.postMessage({ type: MESSAGE_TYPES.MUTED_DOMAINS_DATA, payload: message.payload }, '*');
      }

      if (message.type === 'SETTINGS_DATA_UPDATE') {
          if (iframe?.contentWindow) iframe.contentWindow.postMessage({ type: MESSAGE_TYPES.SETTINGS_DATA, payload: message.payload }, '*');
      }
  }

  function init() {
    if (app.state.isInitialized) return true;
    if (!app.dom.queryElements()) return false;

    app.state.elements.theChannelButton = app.dom.createNavButton();
    app.state.elements.iframeContainer = app.dom.createIframe();

    if (!app.state.elements.theChannelButton || !app.state.elements.iframeContainer) return false;
    
    app.events.attachListeners();
    app.events.handleHashChange();
    window.addEventListener('message', handleMessagesFromIframe);
    chrome.runtime.onMessage.addListener(handleMessagesFromBackground);

    chrome.runtime.sendMessage({ type: 'GET_UNREAD_STATUS' }, (unreadDomains) => {
        if (!chrome.runtime.lastError && Array.isArray(unreadDomains)) app.dom.updateUnreadBadge(unreadDomains.length);
    });
    
    app.storage.checkAndRestoreSidebar();
    app.state.isInitialized = true;
    return true;
  }

  function waitForGmail() {
    if (init()) return;
    const observer = new MutationObserver(() => { if (init()) observer.disconnect(); });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  async function fetchSelectorsAndStart() {
    try {
      const response = await fetch(`${SELECTORS_URL}?_=${new Date().getTime()}`, { cache: 'no-cache' });
      app.state.selectors = await response.json();
      waitForGmail(); 
    } catch (error) {
      const localSelectorsUrl = chrome.runtime.getURL('gmail-selectors.json');
      const response = await fetch(localSelectorsUrl);
      app.state.selectors = await response.json();
      waitForGmail();
    }
  }

  fetchSelectorsAndStart();

})(TheChannelViewer);