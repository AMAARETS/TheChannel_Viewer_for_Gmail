document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const domain = params.get('domain');
    
    const domainDisplay = document.getElementById('domain-display');
    const approveBtn = document.getElementById('approve-btn');
    const cancelBtn = document.getElementById('cancel-btn');

    if (!domain) {
        domainDisplay.textContent = 'שגיאה: חסר דומיין';
        approveBtn.disabled = true;
        return;
    }

    domainDisplay.textContent = domain;

    // לחיצה על "ביטול" פשוט סוגרת את החלון
    cancelBtn.addEventListener('click', () => {
        window.close();
    });

    // לחיצה על "אשר" מבצעת את בקשת ההרשאה
    approveBtn.addEventListener('click', async () => {
        const origin = `*://${domain}/*`;
        
        try {
            // זוהי פעולת משתמש (User Gesture) חוקית
            const granted = await chrome.permissions.request({
                origins: [origin]
            });

            if (granted) {
                // אם אושר, נבקש מה-background להפעיל את תיקון העוגיות מיידית
                chrome.runtime.sendMessage({
                    action: 'triggerCookieFix',
                    domains: [domain]
                });
                
                // משנים כפתור ויזואלית לזמן קצר ואז סוגרים
                approveBtn.textContent = 'אושר בהצלחה!';
                setTimeout(() => {
                    window.close();
                }, 800);
            } else {
                // המשתמש סירב בחלון של הדפדפן
                approveBtn.textContent = 'הבקשה נדחתה';
                approveBtn.classList.remove('primary');
                approveBtn.style.backgroundColor = '#ef4444'; // אדום
                approveBtn.style.borderColor = '#ef4444';
            }
        } catch (error) {
            console.error(error);
            domainDisplay.textContent = 'שגיאה: ' + error.message;
        }
    });
});