/**
 * injection_manager.js
 * אחראי על הזרקה דינמית (Programmatic Injection) של סקריפט המעקב.
 * הסקריפט מוזרק אך ורק ל-Iframes של דומיינים שהמשתמש אישר עבורם הרשאות.
 */

const TRACKER_SCRIPT = 'content_scripts/activity_tracker.js';

/**
 * מנסה להזריק את הסקריפט לפריים ספציפי
 */
async function injectTracker(tabId, frameIds) {
  try {
    await chrome.scripting.executeScript({
      target: { 
        tabId: tabId, 
        frameIds: frameIds 
      },
      files: [TRACKER_SCRIPT]
    });
  } catch (err) {
    // התעלמות משגיאות הזרקה (למשל: פריים נסגר לפני ההזרקה, דף שגיאה של כרום וכו')
    // console.debug('Tracker injection skipped:', err.message);
  }
}

// 1. האזנה לטעינת דפים (Navigation)
// אירוע זה קורה בכל פעם ש-Iframe מסיים לטעון דף
chrome.webNavigation.onCompleted.addListener(async (details) => {
  // אנחנו מתעניינים רק ב-Iframes (frameId > 0)
  if (details.frameId === 0) return;

  try {
    // חילוץ הדומיין (Origin) מתוך ה-URL שנטען
    const url = new URL(details.url);
    const origin = url.origin;

    // בדיקה מול כרום: האם יש לנו הרשאה לדומיין הזה?
    const hasPermission = await chrome.permissions.contains({
      origins: [origin + "/*"]
    });

    if (hasPermission) {
      // יש הרשאה -> בצע הזרקה
      injectTracker(details.tabId, [details.frameId]);
    }
  } catch (e) {
    // ה-URL לא תקין (למשל about:blank), מתעלמים
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
      // כרום יזריק אוטומטית רק לפריימים שיש להם הרשאה וידלג על השאר.
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id, allFrames: true },
        files: [TRACKER_SCRIPT]
      }).catch(() => {
        // מתעלמים משגיאות הזרקה כלליות
      });
    }
  }
});

console.log('TheChannel Viewer: Injection Manager Loaded.');