// קובץ זה מטפל בניהול אחסון מצב התוסף ב-chrome.storage
(function(app) {

  const STORAGE_KEYS = {
    SIDEBAR_CLOSED_BY_EXTENSION: 'sidebarClosedByExtension'
  };

  // שומר האם הסרגל נסגר על ידי התוסף
  app.storage.setSidebarClosedByExtension = function(value) {
    chrome.storage.sync.set({ [STORAGE_KEYS.SIDEBAR_CLOSED_BY_EXTENSION]: value });
  };

  // מחזיר האם הסרגל נסגר על ידי התוסף
  app.storage.getSidebarClosedByExtension = function(callback) {
    chrome.storage.sync.get([STORAGE_KEYS.SIDEBAR_CLOSED_BY_EXTENSION], (result) => {
      callback(result[STORAGE_KEYS.SIDEBAR_CLOSED_BY_EXTENSION] || false);
    });
  };

  // בודק בטעינת הדף האם הסרגל צריך להיפתח
  app.storage.checkAndRestoreSidebar = function() {
    app.storage.getSidebarClosedByExtension((wasClosed) => {
      if (wasClosed) {
        console.log('TheChannel Viewer: Detected sidebar was closed by extension before page refresh.');
        
        let attempts = 0;
        const maxAttempts = 50; // מקסימום 5 שניות (50 * 100ms)
        
        // ממתין שכפתור ההמבורגר יהיה זמין ושהסרגל יהיה סגור
        const checkAndClick = () => {
          attempts++;
          const els = app.state.elements;
          
          if (els.hamburgerButton) {
            const isExpanded = els.hamburgerButton.getAttribute('aria-expanded');
            console.log(`TheChannel Viewer: Hamburger button found (attempt ${attempts}), aria-expanded:`, isExpanded);
            
            if (isExpanded === 'false') {
              console.log('TheChannel Viewer: Restoring sidebar by clicking hamburger button.');
              setTimeout(() => {
                els.hamburgerButton.click();
                // מנקה את המצב רק אחרי הלחיצה
                app.storage.setSidebarClosedByExtension(false);
              }, 200);
            } else {
              // אם הסרגל כבר פתוח, פשוט ננקה את המצב
              console.log('TheChannel Viewer: Sidebar already open, clearing state.');
              app.storage.setSidebarClosedByExtension(false);
            }
          } else if (attempts < maxAttempts) {
            // אם הכפתור עדיין לא קיים, ננסה שוב אחרי רגע
            console.log(`TheChannel Viewer: Hamburger button not found yet (attempt ${attempts}/${maxAttempts}), retrying...`);
            setTimeout(checkAndClick, 100);
          } else {
            // אם הגענו למקסימום ניסיונות, ננקה את המצב
            console.warn('TheChannel Viewer: Failed to find hamburger button after maximum attempts, clearing state.');
            app.storage.setSidebarClosedByExtension(false);
          }
        };
        
        // מתחיל את הבדיקה אחרי דיליי קטן כדי לתת לדף להיטען
        setTimeout(checkAndClick, 500);
      }
    });
  };

})(TheChannelViewer);
