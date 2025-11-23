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
        const checkedCheckboxes = document.querySelectorAll('#sites-list input[type="checkbox"]:checked');
        const count = checkedCheckboxes.length;
        const badge = document.getElementById('selected-count');
        
        applyBtn.disabled = count === 0;
        
        if (badge) {
            badge.textContent = count;
            badge.style.animation = 'none';
            setTimeout(() => {
                badge.style.animation = '';
            }, 10);
        }
    }

    async function displaySites(sites) {
        sitesList.innerHTML = '';
        currentSites = sites;

        if (sites.length === 0) {
            sitesList.innerHTML = '<li class="empty-state">לא נמצאו אתרים שמורים.</li>';
            document.querySelector('.select-all-container').style.display = 'none';
            applyBtn.disabled = true;
            return;
        }
        
        // Sort sites by name
        sites.sort((a, b) => {
            const nameA = (a.name || a.domain || a || '').toLowerCase();
            const nameB = (b.name || b.domain || b || '').toLowerCase();
            return nameA.localeCompare(nameB, 'he');
        });
        
        document.querySelector('.select-all-container').style.display = 'flex';

        const permissions = await chrome.permissions.getAll();
        const grantedOrigins = new Set(permissions.origins || []);

        sites.forEach((site, index) => {
            // Support both old format (string) and new format (object with name and domain)
            const domain = typeof site === 'string' ? site : site.domain;
            const siteName = typeof site === 'string' ? domain : (site.name || domain);
            
            const li = document.createElement('li');
            li.className = 'site-item';
            li.style.animationDelay = `${index * 0.05}s`;
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `site-${domain}`;
            checkbox.value = domain;
            checkbox.checked = grantedOrigins.has(`*://${domain}/*`);

            const label = document.createElement('label');
            label.htmlFor = `site-${domain}`;
            label.title = `לחץ לבחירה: ${siteName}`;
            
            label.innerHTML = `
                <div class="site-info">
                    <span class="site-name">${siteName}</span>
                    <span class="site-url">${domain}</span>
                </div>
            `;
            
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
            // Add animation to the parent site-item
            const siteItem = event.target.closest('.site-item');
            if (siteItem) {
                siteItem.style.animation = 'none';
                setTimeout(() => {
                    siteItem.style.animation = '';
                }, 10);
            }
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

    // Ripple effect for buttons
    function createRipple(event) {
        const button = event.currentTarget;
        const ripple = document.createElement('span');
        const rect = button.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = event.clientX - rect.left - size / 2;
        const y = event.clientY - rect.top - size / 2;

        ripple.style.width = ripple.style.height = `${size}px`;
        ripple.style.left = `${x}px`;
        ripple.style.top = `${y}px`;
        ripple.classList.add('ripple');

        button.appendChild(ripple);

        setTimeout(() => {
            ripple.remove();
        }, 600);
    }

    document.querySelectorAll('button').forEach(button => {
        button.addEventListener('click', createRipple);
    });

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