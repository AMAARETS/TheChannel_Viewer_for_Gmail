// קובץ זה מאתחל את האובייקט הראשי של התוסף ומגדיר את מבנה הנתונים שישמש לאחסון המצב.
const TheChannelViewer = {
  state: {
    lastGmailHash: '#inbox',
    lastActiveApp: 'mail',
    isInitialized: false,
    isCustomSidebar: false,
    sidebarObserver: null, 
    elements: {
      mailButton: null,
      chatButton: null,
      meetButton: null,
      sidebarParent: null,
      gmailSidebar: null, // יישמר כאן הרפרנס לסרגל המיילים (לדוגמה .aqn)
      chatSidebar: null,  // יישמר כאן הרפרנס לסרגל הצ'אט (לדוגמה .aqn)
      channelSidebar: null, // הרפרנס לסרגל החדש של הערוץ
      iframeContainer: null,
      theChannelButton: null,
      hamburgerButton: null,
      gmailView: null,
      searchBar: null,
      navContainer: null
    },
    selectors: null
  },
  dom: {},
  events: {},
  storage: {}
};