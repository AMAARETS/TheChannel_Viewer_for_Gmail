/**
 * content_scripts/layout_fixer.js
 * מטפל בתיקוני תצוגה (CSS) באתרים המוטמעים.
 */
(function() {
    const STYLE_ID = 'the-channel-layout-fixes';

    // בדיקה ישירה: אם הסטייל כבר קיים בדף - אל תעשה כלום
    if (document.getElementById(STYLE_ID)) {
        return;
    }

    // הגדרת CSS שיוצג רק במסכים גדולים מ-768px (טאבלט ומעלה)
    const cssStyles = `
        @media (min-width: 768px) {
            nb-layout-column.ad-column.d-none {
                display: flex !important;
            }
            
            /* הבטחת רוחב מינימלי כדי שהתוכן לא יימעך */
            nb-layout-column.ad-column {
                min-width: 300px;
            }
        }
    `;

    try {
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = cssStyles;
        
        // הוספה ל-HEAD, ואם אין אז ל-documentElement (HTML)
        (document.head || document.documentElement).appendChild(style);

        console.log('TheChannel Viewer: Layout fixes applied (MD breakpoint).');
    } catch (e) {
        console.error('TheChannel Viewer: Failed to inject layout fixes', e);
    }
})();