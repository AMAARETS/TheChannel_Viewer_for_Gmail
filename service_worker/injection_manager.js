/**
 * injection_manager.js
 * אחראי על הזרקה דינמית (Programmatic Injection) של סקריפטים.
 * הסקריפטים מוזרקים לדומיינים שהמשתמש אישר עבורם הרשאות,
 * הן בתוך ה-Iframe של התוסף והן בכרטיסיות רגילות (לצורך סנכרון מידע).
 */

// רשימת הסקריפטים להזרקה: מעקב פעילות + מנהל סנכרון נתונים
const INJECTED_SCRIPTS = [
  'content_scripts/activity_tracker.js', 
  'content_scripts/sync_manager.js'
];

/**
 * מנסה להזריק את הסקריפטים לפריים ספציפי
 */
async function injectTracker(tabId, frameIds) {
  try {
    await chrome.scripting.executeScript({
      target: { 
        tabId: tabId, 
        frameIds: frameIds 
      },
      files: INJECTED_SCRIPTS
    });
  } catch (err) {
    // התעלמות משגיאות הזרקה (למשל: פריים נסגר לפני ההזרקה, דף שגיאה של כרום וכו')
    // console.debug('Script injection skipped:', err.message);
  }
}

// 1. האזנה לטעינת דפים (Navigation)
// אירוע זה קורה בכל פעם שפריים או טאב מסיים לטעון דף
chrome.webNavigation.onCompleted.addListener(async (details) => {
  // הסרנו את הסינון של frameId === 0 כדי לאפשר סנכרון גם מטאבים רגילים

  try {
    // חילוץ הדומיין (Origin) מתוך ה-URL שנטען
    const url = new URL(details.url);
    const origin = url.origin;

    // לא מזריקים לדפים פנימיים של הדפדפן או לדפים ריקים
    if (!origin || origin === 'null' || url.protocol === 'about:') return;

    // בדיקה מול כרום: האם יש לנו הרשאה לדומיין הזה?
    const hasPermission = await chrome.permissions.contains({
      origins: [origin + "/*"]
    });

    if (hasPermission) {
      // יש הרשאה -> בצע הזרקה
      // הערה: activity_tracker.js מכיל בדיקה פנימית וייעצר לבד אם הוא בטאב ראשי,
      // אך sync_manager.js ירוץ ויבצע את הסנכרון הנדרש.
      injectTracker(details.tabId, [details.frameId]);
    }
  } catch (e) {
    // ה-URL לא תקין, מתעלמים
  }
});

// 2. האזנה לאישור הרשאות חדשות בזמן אמת
// מאפשר הזרקה מידית ברגע שהמשתמש לוחץ "אשר" בחלון הקופץ, בלי צורך לרענן
chrome.permissions.onAdded.addListener(async (permissions) => {
  if (permissions.origins && permissions.origins.length > 0) {
    // מנסים להזריק לטאב הפעיל הנוכחי
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0] && tabs[0].id) {
      // מנסים להזריק לכל הפריים בטאב (allFrames: true).
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id, allFrames: true },
        files: INJECTED_SCRIPTS
      }).catch(() => {
        // מתעלמים משגיאות הזרקה כלליות
      });
    }
  }
});

console.log('TheChannel Viewer: Injection Manager Loaded.');