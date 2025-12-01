// קובץ זה מטפל בניהול אחסון מצב התוסף ב-chrome.storage
(function(app) {

  const STORAGE_KEYS = {
    // מפתחות אחסון ישנים הוסרו כי אין בהם צורך יותר בשיטת ההסתרה החדשה
  };

  // פונקציות האחסון הושארו כריקות או בסיסיות למניעת שבירת תלויות,
  // אך הלוגיקה של סגירה/פתיחה של הסרגל הוסרה.

  app.storage.setSidebarClosedByExtension = function(value) {
    // אין צורך לשמור מצב זה בגרסה החדשה
  };

  app.storage.getSidebarClosedByExtension = function(callback) {
    // תמיד מחזיר false כיוון שאנחנו לא סוגרים פיזית את הסרגל
    callback(false);
  };

  // בודק בטעינת הדף האם הסרגל צריך להיפתח
  app.storage.checkAndRestoreSidebar = function() {
    // בגרסה זו ההסתרה נעשית ב-CSS בלבד, ולכן אין צורך לשחזר את מצב כפתור ההמבורגר
    console.log('TheChannel Viewer: CSS-based hiding active, no sidebar restoration needed.');
  };

})(TheChannelViewer);