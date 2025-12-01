// קובץ זה מאתחל את האובייקט הראשי של התוסף ומגדיר את מבנה הנתונים שישמש לאחסון המצב.
const TheChannelViewer = {
  state: {
    lastGmailHash: '#inbox',
    lastActiveApp: 'mail', // שומר איזו אפליקציה הייתה פעילה לפני המעבר לערוץ (mail/chat/meet)
    wasSidebarClosedByExtension: false,
    HamburgerClick: true,
    isInitialized: false,
    isCustomSidebar: false, // דגל חדש לזיהוי אם אנחנו במצב סרגל מותאם אישית
    elements: {
      // נוסיף כאן מקום לכפתורי הניווט
      mailButton: null,
      chatButton: null,
      meetButton: null,
      sidebarParent: null // המיכל ההורי החדש
    }, // כאן נשמור רפרנסים לכל אלמנטי ה-DOM שנשתמש בהם
    selectors: null // כאן נשמור את המזהים שייטענו מהשרת
  },
  dom: {},
  events: {},
  storage: {} // פונקציות לניהול אחסון
};