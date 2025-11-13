document.addEventListener('DOMContentLoaded', () => {
    const updateBtn = document.getElementById('update-sites-btn');
    const applyBtn = document.getElementById('apply-settings-btn');
    const sitesList = document.getElementById('sites-list');
    const statusMessage = document.getElementById('status-message');

    let currentSites = [];

    function showStatus(message, type = 'info') {
        statusMessage.textContent = message;
        statusMessage.className = type;
    }

    function displaySites(sites) {
        sitesList.innerHTML = '';
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

    chrome.runtime.sendMessage({ action: 'getSites' }, (sites) => {
        if (chrome.runtime.lastError) {
            showStatus(`שגיאה: ${chrome.runtime.lastError.message}`, 'error');
            return;
        }
        displaySites(sites || []);
    });

    updateBtn.addEventListener('click', () => {
        showStatus('טוען רשימת אתרים...', 'info');
        updateBtn.disabled = true;
        
        chrome.runtime.sendMessage({ action: 'fetchSites' }, (response) => {
            updateBtn.disabled = false;
            if (chrome.runtime.lastError) {
                showStatus(`שגיאה: ${chrome.runtime.lastError.message}`, 'error');
                return;
            }

            if (response && response.success) {
                const sites = response.data;
                if (sites && sites.length > 0) {
                    displaySites(sites);
                    showStatus('רשימת האתרים עודכנה בהצלחה!', 'success');
                } else {
                    displaySites([]);
                    showStatus('רשימת האתרים שהתקבלה ריקה.', 'info');
                }
            } else {
                displaySites([]);
                // שיפור: הודעת שגיאה ברורה יותר
                const defaultError = 'אירעה שגיאה לא ידועה בטעינה.';
                showStatus(response.error || defaultError, 'error');
            }
        });
    });
    
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
                showStatus('ההרשאות התקבלו. המערכת תתקן עוגיות באופן אוטומטי.', 'success');
            } else {
                showStatus('ההרשאות נדחו. לא ניתן להחיל את השינויים.', 'error');
            }
        } catch (error) {
            console.error(error);
            showStatus(`אירעה שגיאה: ${error.message}`, 'error');
        }
    });
});