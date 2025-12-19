/**
 * injection_manager.js
 * אחראי על הזרקה דינמית (Programmatic Injection) של סקריפטים.
 * הסקריפטים מוזרקים לדומיינים שהמשתמש אישר עבורם הרשאות.
 */

const INJECTED_SCRIPTS = [
  'content_scripts/activity_tracker.js', 
  'content_scripts/sync_manager.js',
  'content_scripts/layout_fixer.js'
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
      files: INJECTED_SCRIPTS,
      // אופציונלי: מנסה להזריק כמה שיותר מהר, למרות שהטריגר onCommitted הוא הפקטור המרכזי
      injectImmediately: true 
    });
  } catch (err) {
    // התעלמות משגיאות (פריים נסגר, אין גישה וכו')
  }
}

// 1. האזנה לתחילת טעינת דפים (Navigation Committed)
// *** תיקון: שימוש ב-onCommitted במקום onCompleted לשיפור דרמטי בביצועים ***
chrome.webNavigation.onCommitted.addListener(async (details) => {
  try {
    // חילוץ הדומיין (Origin) מתוך ה-URL שנטען
    const url = new URL(details.url);
    const origin = url.origin;

    // סינונים בסיסיים
    if (!origin || origin === 'null' || url.protocol === 'about:' || url.protocol === 'chrome:') return;

    // בדיקה מול כרום: האם יש לנו הרשאה לדומיין הזה?
    const hasPermission = await chrome.permissions.contains({
      origins: [origin + "/*"]
    });

    if (hasPermission) {
      // יש הרשאה -> בצע הזרקה מיידית
      // הסקריפטים הפנימיים (sync/tracker) מכילים הגנות מפני הרצה כפולה,
      // לכן בטוח להריץ אותם גם אם הדף עדיין לא סיים להיבנות לחלוטין.
      injectTracker(details.tabId, [details.frameId]);
    }
  } catch (e) {
    // ה-URL לא תקין או שגיאה אחרת, מתעלמים
  }
});

// 2. האזנה לאישור הרשאות חדשות בזמן אמת (ללא שינוי)
chrome.permissions.onAdded.addListener(async (permissions) => {
  if (permissions.origins && permissions.origins.length > 0) {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0] && tabs[0].id) {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id, allFrames: true },
        files: INJECTED_SCRIPTS
      }).catch(() => {});
    }
  }
});

console.log('TheChannel Viewer: Injection Manager Loaded (Fast Mode).');