document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const currentDomain = params.get('domain');
    const name = params.get('name');
    
    const nameDisplay = document.getElementById('site-name-display');
    const domainDisplay = document.getElementById('site-domain-display');
    const approveBtn = document.getElementById('approve-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const checkbox = document.getElementById('approve-all-check');
    const checkboxLabel = document.querySelector('.checkbox-label');

    // משתנה לשמירת כל האתרים
    let allSitesList = [];

    // 1. טעינת רשימת האתרים מה-Background
    chrome.runtime.sendMessage({ action: 'fetchSites' }, (response) => {
        if (response && response.success && Array.isArray(response.data) && response.data.length > 0) {
            allSitesList = response.data;
            // אפשור ה-Checkbox רק אם יש אתרים ברשימה
            checkbox.disabled = false;
            checkboxLabel.classList.remove('disabled');
        } else {
            console.log('No sites list available or empty');
        }
    });

    if (!currentDomain) {
        nameDisplay.textContent = 'שגיאה';
        domainDisplay.textContent = 'חסר דומיין';
        approveBtn.disabled = true;
        return;
    }

    // לוגיקת תצוגה
    if (name && name !== 'undefined' && name !== currentDomain) {
        nameDisplay.textContent = name;
        domainDisplay.textContent = currentDomain;
    } else {
        nameDisplay.textContent = currentDomain;
        domainDisplay.style.display = 'none';
    }

    cancelBtn.addEventListener('click', () => {
        window.close();
    });

    approveBtn.addEventListener('click', async () => {
        approveBtn.disabled = true;
        approveBtn.textContent = 'מבצע...';

        let domainsToApprove = [currentDomain];
        let originsToRequest = [`*://${currentDomain}/*`];

        // אם המשתמש סימן את התיבה, נוסיף את כל האתרים מהרשימה
        if (checkbox.checked && allSitesList.length > 0) {
            const allDomains = allSitesList.map(site => site.domain || site);
            // איחוד עם הדומיין הנוכחי ומניעת כפילויות
            domainsToApprove = [...new Set([...allDomains, currentDomain])];
            originsToRequest = domainsToApprove.map(d => `*://${d}/*`);
        }

        try {
            // בקשת הרשאה מהדפדפן (עבור דומיין אחד או רבים)
            const granted = await chrome.permissions.request({
                origins: originsToRequest
            });

            if (granted) {
                // שליחת בקשה לתיקון עוגיות עבור כל הדומיינים שאושרו
                chrome.runtime.sendMessage({
                    action: 'triggerCookieFix',
                    domains: domainsToApprove
                });
                
                approveBtn.textContent = 'אושר!';
                approveBtn.classList.add('success');
                setTimeout(() => {
                    window.close();
                }, 800);
            } else {
                approveBtn.disabled = false;
                approveBtn.textContent = 'הבקשה נדחתה';
                approveBtn.classList.add('error');
                setTimeout(() => {
                    approveBtn.textContent = 'אשר חיבור';
                    approveBtn.classList.remove('error');
                }, 2000);
            }
        } catch (error) {
            console.error(error);
            approveBtn.textContent = 'שגיאה';
            // הצגת השגיאה בצורה ידידותית יותר אם אפשר, או בקונסול
            approveBtn.classList.add('error');
        }
    });
});