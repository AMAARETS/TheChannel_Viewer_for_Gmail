let iframeContainer, gmailViewContainer, theChannelButton, hamburgerButton, searchBarForm;
let lastGmailHash = '#inbox';
let wasSidebarClosedByExtension = false;

// --- פונקציות ניהול תצוגה ---

/** מעדכן את הנראות של כפתורי הניווט כדי להציג איזה כפתור פעיל */
function updateActiveButtonVisuals() {
    const isTheChannelActive = window.location.hash.startsWith('#the-channel');

    // הסרת סטטוס 'פעיל' מכל כפתורי הניווט
    document.querySelectorAll('div[role="navigation"].a6o .Xa').forEach(btn => btn.classList.remove('acZ', 'apV'));

    if (isTheChannelActive) {
        if (!theChannelButton) return;
        theChannelButton.classList.add('acZ', 'apV');
    } else {
        // אם חזרנו למייל, נסמן את כפתור המייל כפעיל
        const mailButton = document.querySelector('div[aria-label^="אימייל"], div[aria-label^="Mail"]');
        if (mailButton) {
            mailButton.closest('.Xa')?.classList.add('acZ', 'apV');
        }
    }
}

/** מציג את התוכן של TheChannel ומסתיר את התצוגה של Gmail */
// --- פונקציות ניהול תצוגה ---

/** מציג את התוכן של TheChannel ומסתיר את התצוגה של Gmail */
function showTheChannel() {
    // סגירת תפריט הצד של Gmail אם הוא פתוח, כדי לפנות מקום
    if (hamburgerButton && hamburgerButton.getAttribute('aria-expanded') === 'true') {
        hamburgerButton.click();
        wasSidebarClosedByExtension = true;
    }

    // במקום לשנות את ה-style, נוסיף class
    if (gmailViewContainer) gmailViewContainer.classList.add('the-channel-active-hide-gmail');
    if (searchBarForm) searchBarForm.classList.add('the-channel-active-hide-gmail');

    if (iframeContainer) iframeContainer.style.display = 'block';

    updateActiveButtonVisuals();
}

/** מציג את התצוגה של Gmail ומסתיר את TheChannel */
function showGmail() {
    if (iframeContainer) iframeContainer.style.display = 'none';

    // במקום לשנות את ה-style, נסיר את ה-class
    if (gmailViewContainer) gmailViewContainer.classList.remove('the-channel-active-hide-gmail');
    if (searchBarForm) searchBarForm.classList.remove('the-channel-active-hide-gmail');


    // יצירת אירוע 'resize' כדי ש-Gmail יתאים את עצמו מחדש לגודל החלון
    window.dispatchEvent(new Event('resize'));

    // פתיחה מחדש של תפריט הצד אם הוא נסגר על ידי התוסף
    if (wasSidebarClosedByExtension) {
        if (hamburgerButton) {
            // setTimeout מבטיח שהפעולה תתבצע לאחר שה-UI הספיק להתעדכן
            setTimeout(() => hamburgerButton.click(), 0);
        }
        wasSidebarClosedByExtension = false;
    }
    theChannelButton.classList.remove('acZ', 'apV');
}

function updateComposeButtonVisibility() {
    // איתור האלמנט המכיל את כפתור "אימייל חדש" והתוויות
    const composeButtonContainer = document.querySelector('.aqn');
    if (!composeButtonContainer) return;

    // בדיקה אם ה-URL הנוכחי מתחיל ב-#chat או #meet
    const isChatOrMeet = window.location.hash.startsWith('#chat') || window.location.hash.startsWith('#calls');

    if (isChatOrMeet) composeButtonContainer.classList.remove('apV');
}

// --- פונקציות ניווט ואירועים ---

/** שומר את המיקום האחרון ב-Gmail ועובר לתצוגת TheChannel */
function navigateToChannel() {
    lastGmailHash = window.location.hash || '#inbox';
    window.location.hash = 'the-channel';
}

/** מאזין לשינויים ב-URL ומציג את התוכן המתאים */
function handleHashChange() {
    if (window.location.hash.startsWith('#the-channel')) {
        showTheChannel();
    }else{
        showGmail();
        updateComposeButtonVisibility();
    }
}


// --- יצירת רכיבי התוסף ---

/** יוצר את כפתור הניווט הראשי של TheChannel */
function createMainNavigationButton(navContainer) {
    const buttonToClone = navContainer.querySelector('div[aria-label^="Chat"]');
    if (!buttonToClone) return null;

    const buttonContainer = buttonToClone.closest('.Xa');
    if (!buttonContainer) return null;

    const newButton = buttonContainer.cloneNode(true);
    newButton.id = 'the-channel-button';
    newButton.classList.remove('acZ', 'apV');
    newButton.removeAttribute('jscontroller');

    newButton.querySelector('[aria-label]')?.setAttribute('aria-label', 'TheChannel');
    newButton.querySelector('.apW').textContent = 'הערוץ';

    // הוספת אפקט hover ידני ליציבות
    const iconContainer = newButton.querySelector('.V6');
    if (iconContainer) {
        iconContainer.addEventListener('mouseover', () => {
            if (!newButton.classList.contains('acZ')) {
                iconContainer.style.backgroundColor = '#f1f3f4';
            }
        });
        iconContainer.addEventListener('mouseout', () => {
            iconContainer.style.backgroundColor = 'transparent';
        });
    }

    const spacer = navContainer.querySelector('.al9');
    navContainer.insertBefore(newButton, spacer);

    return newButton;
}

/** יוצר וממקם את ה-iframe שיציג את התוכן */
function createIframe(parent) {
    const container = document.createElement('div');
    container.id = 'the-channel-iframe-container';
    container.style.cssText = 'display:none; position:absolute; top:0; left:0; width:100%; height:100%;';

    const iframe = document.createElement('iframe');
    iframe.src = 'https://thechannel-viewer.clickandgo.cfd';
    iframe.style.cssText = 'width:100%; height:100%; border:none;';
    iframe.allow = 'clipboard-read; clipboard-write';

    container.appendChild(iframe);
    parent.appendChild(container);
    return container;
}


// --- פונקציית אתחול ראשית ---

/** מאתחל את כל רכיבי התוסף ומוסיף מאזינים לאירועים */
function initializeExtension() {
    // בודק אם התוסף כבר איתחל
    if (document.getElementById('the-channel-button')) return true;

    // איתור רכיבי מפתח בממשק של Gmail
    gmailViewContainer = document.querySelector('.aeF');
    const iframeParent = document.querySelector('.Tm');
    hamburgerButton = document.querySelector('.gb_1c');
    searchBarForm = document.querySelector('form[role="search"]');
    const navContainer = document.querySelector('div[role="navigation"].a6o');

    if (!gmailViewContainer || !iframeParent || !hamburgerButton || !searchBarForm || !navContainer) {
        return false; // הממשק של Gmail עדיין לא נטען במלואו
    }

    theChannelButton = createMainNavigationButton(navContainer);
    if (!theChannelButton) return false;

    iframeContainer = createIframe(iframeParent);
    if (!iframeContainer) return false;

    // חיבור האירועים
    theChannelButton.addEventListener('click', navigateToChannel);
    window.addEventListener('hashchange', handleHashChange);

    handleHashChange(); // הפעלה ראשונית כדי לסנכרן את התצוגה עם ה-URL
    console.log('TheChannel Viewer for Gmail was successfully initialized!');
    return true;
}


// --- לוגיקת טעינה ---

/**
 * מנסה לאתחל את התוסף. אם מצליח, מפסיק את ה-Observer.
 * @param {MutationObserver} observer - ה-Observer שסורק שינויים ב-DOM.
 */
function attemptInitialization(observer) {
    if (initializeExtension()) {
        if (observer) {
            observer.disconnect(); // מפסיקים לצפות בשינויים לאחר הצלחה
        }
        return true;
    }
    return false;
}

// ניסיון אתחול מיידי למקרה שהדף נטען מהר או מקאש
if (!attemptInitialization(null)) {
    // אם האתחול נכשל, נשתמש ב-MutationObserver כדי להמתין שה-UI של Gmail ייטען
    const observer = new MutationObserver((mutations, obs) => {
        // בכל שינוי ב-DOM, ננסה לאתחל שוב
        attemptInitialization(obs);
    });

    // הגדרת ה-Observer להאזין לשינויים במבנה של כל הדף
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}