// קובץ זה מאתחל את האובייקט הראשי של התוסף ומגדיר את מבנה הנתונים שישמש לאחסון המצב.
const TheChannelViewer = {
  state: {
    lastGmailHash: '#inbox',
    lastActiveApp: 'mail', // שומר איזו אפליקציה הייתה פעילה לפני המעבר לערוץ (mail/chat/meet)
    wasSidebarClosedByExtension: false,
    HamburgerClick: true,
    isInitialized: false,
    elements: {
      // נוסיף כאן מקום לכפתורי הניווט
      mailButton: null,
      chatButton: null,
      meetButton: null
    }, // כאן נשמור רפרנסים לכל אלמנטי ה-DOM שנשתמש בהם
    selectors: null // כאן נשמור את המזהים שייטענו מהשרת
  },
  dom: {},
  events: {},
  storage: {} // פונקציות לניהול אחסון
};