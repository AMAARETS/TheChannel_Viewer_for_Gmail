document.addEventListener('DOMContentLoaded', () => {
    const refreshBtn = document.getElementById('refresh-btn');
    const applyBtn = document.getElementById('apply-settings-btn');
    const sitesList = document.getElementById('sites-list');
    const sitesListContainer = document.getElementById('sites-list-container');
    const toast = document.getElementById('toast-notification');
    const selectAllCheckbox = document.getElementById('select-all');

    let currentSites = [];
    let toastTimeout;

    function showToast(message, type = 'success', duration = 3000) {
        clearTimeout(toastTimeout);
        toast.textContent = message;
        toast.className = `toast show ${type}`;
        toastTimeout = setTimeout(() => {
            toast.classList.remove('show');
        }, duration);
    }

    function updateApplyButtonState() {
        const anyCheckboxChecked = document.querySelector('#sites-list input[type="checkbox"]:checked');
        applyBtn.disabled = !anyCheckboxChecked;
    }

    async function displaySites(sites) {
        sitesList.innerHTML = '';
        currentSites = sites.sort();

        if (sites.length === 0) {
            sitesList.innerHTML = '<li class="empty-state">לא נמצאו אתרים שמורים.</li>';
            document.querySelector('.select-all-container').style.display = 'none';
            applyBtn.disabled = true;
            return;
        }
        
        document.querySelector('.select-all-container').style.display = 'flex';

        const permissions = await chrome.permissions.getAll();
        const grantedOrigins = new Set(permissions.origins || []);

        sites.forEach(site => {
            const li = document.createElement('li');
            li.className = 'site-item';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `site-${site}`;
            checkbox.value = site;
            checkbox.checked = grantedOrigins.has(`*://${site}/*`);

            const label = document.createElement('label');
            label.htmlFor = `site-${site}`;
            label.innerHTML = `<span>${site}</span>`;
            
            li.appendChild(checkbox);
            li.appendChild(label);
            sitesList.appendChild(li);
        });

        updateSelectAllCheckboxState();
    }

    function handleSiteCheckboxChange() {
        updateSelectAllCheckboxState();
        updateApplyButtonState();
    }

    function updateSelectAllCheckboxState() {
        const allCheckboxes = document.querySelectorAll('#sites-list input[type="checkbox"]');
        if (allCheckboxes.length === 0) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
            return;
        }
        const checkedCount = Array.from(allCheckboxes).filter(cb => cb.checked).length;
        
        if (checkedCount === 0) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        } else if (checkedCount === allCheckboxes.length) {
            selectAllCheckbox.checked = true;
            selectAllCheckbox.indeterminate = false;
        } else {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = true;
        }
    }

    selectAllCheckbox.addEventListener('change', () => {
        const allCheckboxes = document.querySelectorAll('#sites-list input[type="checkbox"]');
        allCheckboxes.forEach(checkbox => {
            checkbox.checked = selectAllCheckbox.checked;
        });
        updateApplyButtonState();
    });

    sitesList.addEventListener('change', (event) => {
        if (event.target.type === 'checkbox') {
            handleSiteCheckboxChange();
        }
    });

    async function refreshSitesList() {
        sitesListContainer.classList.add('loading');
        applyBtn.disabled = true;
        refreshBtn.disabled = true;

        chrome.runtime.sendMessage({ action: 'fetchSites' }, async (response) => {
            refreshBtn.disabled = false;
            sitesListContainer.classList.remove('loading');

            if (chrome.runtime.lastError) {
                showToast(`שגיאה: ${chrome.runtime.lastError.message}`, 'error');
                return;
            }

            if (response && response.success) {
                await displaySites(response.data || []);
                showToast('רשימת האתרים עודכנה', 'success');
            } else {
                await displaySites([]);
                showToast(response.error || 'אירעה שגיאה בטעינת האתרים.', 'error');
            }
            updateApplyButtonState();
        });
    }

    applyBtn.addEventListener('click', async () => {
        const checkboxes = document.querySelectorAll('#sites-list input[type="checkbox"]');
        const sitesToRequest = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
        const sitesToRemove = Array.from(checkboxes).filter(cb => !cb.checked).map(cb => cb.value);

        const originsToRequest = sitesToRequest.map(domain => `*://${domain}/*`);
        const originsToRemove = sitesToRemove.map(domain => `*://${domain}/*`);

        try {
            // הסר הרשאות אם צריך
            if (originsToRemove.length > 0) {
                await chrome.permissions.remove({ origins: originsToRemove });
            }

            // בקש הרשאות חדשות אם צריך
            if (originsToRequest.length > 0) {
                showToast('יש לאשר את ההרשאות בחלון הקופץ...', 'info', 5000);
                const granted = await chrome.permissions.request({ origins: originsToRequest });

                if (granted) {
                    showToast('האישור התקבל! האתרים שבחרתם ישולבו כעת באתר הערוץ.', 'success');
                    // *** החלק החדש: הפעל את התיקון היזום ***
                    chrome.runtime.sendMessage({
                        action: 'triggerCookieFix',
                        domains: sitesToRequest
                    });
                } else {
                    showToast('הגישה נדחתה. לא יהיה ניתן לאפשר את כל האתרים.', 'error');
                }
            } else {
                showToast('הגישה לאתרים הוסרה. לא יהיה ניתן לאפשר את הצפיה בכולם מאתר הערוץ', 'success');
            }

        } catch (error) {
            console.error(error);
            showToast(`אירעה שגיאה: ${error.message}`, 'error');
        }
    });

    // --- טעינה ראשונית ---
    refreshBtn.addEventListener('click', refreshSitesList);
    refreshSitesList();
});