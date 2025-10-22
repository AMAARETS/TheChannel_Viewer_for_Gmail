// קובץ זה מאתחל את האובייקט הראשי של התוסף ומגדיר את מבנה הנתונים שישמש לאחסון המצב.
const TheChannelViewer = {
  state: {
    lastGmailHash: '#inbox',
    wasSidebarClosedByExtension: false,
    isInitialized: false,
    elements: {} // כאן נשמור רפרנסים לכל אלמנטי ה-DOM שנשתמש בהם
  },
  dom: {},
  events: {}
};