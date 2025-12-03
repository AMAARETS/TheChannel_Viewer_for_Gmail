/**
 * activity_tracker.js
 * סקריפט זה מוזרק לאתרים בתוך ה-Iframe.
 * הוא מנטר פעילות ושולח "דופק" (Heartbeat) לאתר המכיל בצורה יעילה.
 */

(function() {
  // 1. הגנה: הרצה רק בתוך Iframe
  if (window.self === window.top) {
    return;
  }

  const currentHost = window.location.hostname;
  if (currentHost.includes('thechannel-viewer.clickandgo.cfd')) {
    return;
  }

  const PARENT_ORIGIN = 'https://thechannel-viewer.clickandgo.cfd';
  const HEARTBEAT_INTERVAL = 5000; // שליחת עדכון כל 5 שניות
  
  let hasActivity = false;
  let lastActivityTimestamp = Date.now();

  // פונקציה שרק מסמנת שהייתה פעילות (קל מאוד למעבד)
  function markActive() {
    hasActivity = true;
    lastActivityTimestamp = Date.now();
  }

  // רשימת אירועים המעידים על פעילות
  const activityEvents = [
    'mousedown', 'keydown', 'scroll', 'wheel', 'touchstart', 'mousemove', 'click'
  ];

  // האזנה פסיבית (לא עוצרת את הגלילה)
  activityEvents.forEach(event => {
    window.addEventListener(event, markActive, { passive: true });
  });

  // שליחת דופק תקופתי
  setInterval(() => {
    // נשלח רק אם זוהתה פעילות והדף גלוי
    if (hasActivity && document.visibilityState === 'visible') {
      
      window.parent.postMessage({
        type: 'THE_CHANNEL_IFRAME_HEARTBEAT',
        payload: {
          url: window.location.href,
          title: document.title,
          // אומרים לגוגל: המשתמש היה פעיל במשך האינטרוול הזה
          engagementTime: HEARTBEAT_INTERVAL 
        }
      }, PARENT_ORIGIN);

      // איפוס הדגל לסבב הבא
      hasActivity = false;
    }
  }, HEARTBEAT_INTERVAL);

  console.log('TheChannel Tracker: Monitoring active in ' + window.location.hostname);
})();