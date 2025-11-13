document.addEventListener('DOMContentLoaded', () => {
    const updateBtn = document.getElementById('update-sites-btn');
    const applyBtn = document.getElementById('apply-settings-btn');
    const sitesList = document.getElementById('sites-list');
    const statusMessage = document.getElementById('status-message');

    let currentSites = [];

    /**
     * מציג הודעת סטטוס למשתמש.
     * @param {string} message - ההודעה להצגה.
     * @param {'success' | 'error' | 'info'} type - סוג ההודעה.
     */
    function showStatus(message, type = 'info') {
        statusMessage.textContent = message;
        statusMessage.className = type;
    }

    /**
     * מרנדר את רשימת האתרים בממשק המשתמש.
     * @param {string[]} sites - מערך של דומיינים.
     */
    function displaySites(sites) {
        sitesList.innerHTML = ''; // נקה את הרשימה הקודמת
        currentSites = sites;

        if (sites.length === 0) {
            sitesList.innerHTML = '<li>לא נמצאו אתרים. לחץ על "טען רשימת אתרים".</li>';
            applyBtn.disabled = true;
            return;
        }

        sites.forEach(site => {
            const li = document.createElement('li');
            li.textContent = site;
            sitesList.appendChild(li);
        });

        applyBtn.disabled = false;
    }

    // טעינה ראשונית של האתרים מהאחסון
    chrome.runtime.sendMessage({ action: 'getSites' }, (sites) => {
        if (chrome.runtime.lastError) {
            showStatus(`שגיאה: ${chrome.runtime.lastError.message}`, 'error');
            return;
        }
        displaySites(sites || []);
    });

    // טיפול בלחיצה על כפתור עדכון רשימת האתרים
    updateBtn.addEventListener('click', () => {
        showStatus('טוען רשימת אתרים מהשרת...', 'info');
        updateBtn.disabled = true;
        chrome.runtime.sendMessage({ action: 'fetchSites' }, (sites) => {
            if (chrome.runtime.lastError) {
                showStatus(`שגיאה: ${chrome.runtime.lastError.message}`, 'error');
            } else if (sites && sites.length > 0) {
                displaySites(sites);
                showStatus('רשימת האתרים עודכנה בהצלחה!', 'success');
            } else {
                displaySites([]);
                showStatus('לא נמצאו אתרים או שהתרחשה שגיאה בטעינה.', 'error');
            }
            updateBtn.disabled = false;
        });
    });
    
    // טיפול בלחיצה על כפתור החלת השינויים
    applyBtn.addEventListener('click', async () => {
        if (currentSites.length === 0) {
            showStatus('אין אתרים להחלת שינויים.', 'error');
            return;
        }
        
        const origins = currentSites.map(domain => `*://${domain}/*`);
        
        try {
            showStatus('ממתין לאישור הרשאות מהמשתמש...', 'info');
            const granted = await chrome.permissions.request({ origins });

            if (granted) {
                showStatus('ההרשאות התקבלו. מחיל שינויים...', 'info');
                chrome.runtime.sendMessage({ action: 'applyRules' }, (response) => {
                    if (response.success) {
                        showStatus('ההגדרות עודכנו בהצלחה!', 'success');
                    } else {
                        showStatus(`שגיאה בהחלת ההגדרות: ${response.error}`, 'error');
                    }
                });
            } else {
                showStatus('ההרשאות נדחו. לא ניתן להחיל את השינויים.', 'error');
            }
        } catch (error) {
            console.error(error);
            showStatus(`אירעה שגיאה: ${error.message}`, 'error');
        }
    });
});