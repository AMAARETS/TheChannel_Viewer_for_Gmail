// קובץ זה מאתחל את האובייקט הראשי של התוסף ומגדיר את מבנה הנתונים שישמש לאחסון המצב.
const TheChannelViewer = {
  state: {
    lastGmailHash: '#inbox',
    lastActiveApp: 'mail',
    wasSidebarClosedByExtension: false,
    HamburgerClick: true,
    isInitialized: false,
    isCustomSidebar: false,
    elements: {
      mailButton: null,
      chatButton: null,
      meetButton: null,
      sidebarParent: null,
      gmailSidebar: null // רפרנס לסרגל הצד של ג'ימייל (aeN)
    },
    selectors: null
  },
  dom: {},
  events: {},
  storage: {}
};