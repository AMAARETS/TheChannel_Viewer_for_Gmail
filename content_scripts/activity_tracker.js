/**
 * activity_tracker.js
 * מנטר פעילות משתמש (עכבר/מקלדת) וגם פעילות מדיה (וידאו/אודיו)
 */

(function() {
  // סימון שהסקריפט קיים (למניעת הזרקה כפולה)
  window.hasTheChannelTracker = true; 

  // הגנה: הרצה רק בתוך Iframe
  if (window.self === window.top) {
    return;
  }

  // הגנה נוספת: מניעת הרצה על האתר המכיל עצמו
  const currentHost = window.location.hostname;
  if (currentHost.includes('thechannel-viewer.clickandgo.cfd') || currentHost.includes('localhost')) {
    return;
  }

  const PARENT_ORIGIN = '*'; 
  const HEARTBEAT_INTERVAL = 5000; 
  
  let hasPhysicalActivity = false;

  // 1. פונקציה לזיהוי פעילות פיזית
  function markActive() {
    hasPhysicalActivity = true;
  }

  const activityEvents = [
    'mousedown', 'keydown', 'scroll', 'wheel', 'touchstart', 'mousemove', 'click'
  ];

  activityEvents.forEach(event => {
    window.addEventListener(event, markActive, { passive: true });
  });

  // 2. פונקציה חדשה: בדיקה האם יש וידאו או אודיו מנגן בדף
  function isMediaPlaying() {
    // מחפש את כל אלמנטי הווידאו והאודיו בדף
    const mediaElements = document.querySelectorAll('video, audio');
    
    for (let i = 0; i < mediaElements.length; i++) {
      const media = mediaElements[i];
      // בודק אם המדיה: לא מושהית, לא הסתיימה, ויש לה דאטה (מוכנה לניגון)
      if (!media.paused && !media.ended && media.readyState > 2) {
        return true;
      }
    }
    return false;
  }

  // שליחת דופק תקופתי
  setInterval(() => {
    // התנאי למשלוח:
    // 1. הדף גלוי למשתמש (לא בטאב מוסתר)
    // 2. וגם: (הייתה פעילות פיזית לאחרונה OR יש מדיה שמנגנת כרגע)
    const isVisible = document.visibilityState === 'visible';
    const isActive = hasPhysicalActivity || isMediaPlaying();

    if (isVisible && isActive) {
      
      window.parent.postMessage({
        type: 'THE_CHANNEL_IFRAME_HEARTBEAT',
        payload: {
          url: window.location.href,
          title: document.title,
          engagementTime: HEARTBEAT_INTERVAL 
        }
      }, PARENT_ORIGIN);

      // איפוס הדגל הפיזי (אבל בדיקת המדיה תרוץ שוב בפעם הבאה)
      hasPhysicalActivity = false;
    }
  }, HEARTBEAT_INTERVAL);

  console.log('TheChannel Tracker: Monitoring active (Input + Media) in ' + window.location.hostname);
})();