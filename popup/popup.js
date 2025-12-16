document.addEventListener('DOMContentLoaded', () => {
    const refreshBtn = document.getElementById('refresh-btn');
    const applyBtn = document.getElementById('apply-settings-btn');
    const sitesList = document.getElementById('sites-list');
    const sitesListContainer = document.getElementById('sites-list-container');
    const toast = document.getElementById('toast-notification');
    const selectAllCheckbox = document.getElementById('select-all');

    const MUTED_DOMAINS_KEY = 'theChannel_muted_domains';
    let currentMutedDomains = new Set();
    let currentSites = [];
    let toastTimeout;

    // --- SVG Icons for Notification Bell ---
    const bellIconSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 0 24 24" width="20px" fill="currentColor">
            <path d="M0 0h24v24H0V0z" fill="none"/>
            <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z"/>
        </svg>`;
    
    const bellOffIconSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 0 24 24" width="20px" fill="currentColor">
            <path d="M0 0h24v24H0V0z" fill="none"/>
            <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z"/>
            <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" stroke-width="2" />
        </svg>`;
        
    // גרסה מלאה (Filled) כשפעיל
    const bellFilledSvg = `
         <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 0 24 24" width="20px" fill="currentColor">
            <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
        </svg>`;

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
        
        applyBtn.disabled = count === 0;
        
        // עדכון מצב הפעמונים בהתאם לצ'קבוקסים
        document.querySelectorAll('.site-item').forEach(item => {
            const checkbox = item.querySelector('input[type="checkbox"]');
            const bellBtn = item.querySelector('.notification-toggle');
            if (checkbox && bellBtn) {
                if (checkbox.checked) {
                    bellBtn.classList.remove('hidden');
                } else {
                    bellBtn.classList.add('hidden');
                }
            }
        });
    }

    async function loadMutedDomains() {
        try {
            const result = await chrome.storage.sync.get([MUTED_DOMAINS_KEY]);
            currentMutedDomains = new Set(result[MUTED_DOMAINS_KEY] || []);
        } catch (e) {
            console.error('Failed to load muted domains:', e);
        }
    }

    async function saveMutedDomains() {
        try {
            await chrome.storage.sync.set({ 
                [MUTED_DOMAINS_KEY]: Array.from(currentMutedDomains) 
            });
        } catch (e) {
            console.error('Failed to save muted domains:', e);
            showToast('שגיאה בשמירת הגדרות התראה', 'error');
        }
    }

    function toggleNotification(domain, btnElement) {
        const isMuted = currentMutedDomains.has(domain);
        
        if (isMuted) {
            // Un-mute
            currentMutedDomains.delete(domain);
            btnElement.classList.remove('muted');
            btnElement.classList.add('active');
            btnElement.innerHTML = bellFilledSvg;
            btnElement.title = 'התראות פעילות (לחץ להשתקה)';
        } else {
            // Mute
            currentMutedDomains.add(domain);
            btnElement.classList.add('muted');
            btnElement.classList.remove('active');
            btnElement.innerHTML = bellOffIconSvg;
            btnElement.title = 'התראות מושתקות (לחץ להפעלה)';
        }
        
        // שמירה אוטומטית בעת שינוי
        saveMutedDomains();
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
            const isGranted = grantedOrigins.has(`*://${domain}/*`);
            
            const li = document.createElement('li');
            li.className = 'site-item';
            li.style.animationDelay = `${index * 0.05}s`;
            
            // Checkbox Container
            const checkboxContainer = document.createElement('div');
            checkboxContainer.className = 'checkbox-wrapper';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `site-${domain}`;
            checkbox.value = domain;
            checkbox.checked = isGranted;

            const label = document.createElement('label');
            label.htmlFor = `site-${domain}`;
            label.title = `לחץ לבחירה: ${siteName}`;
            label.innerHTML = `
                <div class="site-info">
                    <span class="site-name">${siteName}</span>
                    <span class="site-url">${domain}</span>
                </div>
            `;
            
            checkboxContainer.appendChild(checkbox);
            checkboxContainer.appendChild(label);

            // Notification Bell Button
            const isMuted = currentMutedDomains.has(domain);
            const bellBtn = document.createElement('button');
            bellBtn.className = `notification-toggle ${isMuted ? 'muted' : 'active'} ${!isGranted ? 'hidden' : ''}`;
            bellBtn.innerHTML = isMuted ? bellOffIconSvg : bellFilledSvg;
            bellBtn.title = isMuted ? 'התראות מושתקות (לחץ להפעלה)' : 'התראות פעילות (לחץ להשתקה)';
            
            bellBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent triggering the row click
                toggleNotification(domain, bellBtn);
            });

            li.appendChild(checkboxContainer);
            li.appendChild(bellBtn);
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
            const siteItem = event.target.closest('.site-item');
            if (siteItem) {
                // Animation logic
                siteItem.style.animation = 'none';
                setTimeout(() => siteItem.style.animation = '', 10);
            }
            handleSiteCheckboxChange();
        }
    });

    async function refreshSitesList() {
        sitesListContainer.classList.add('loading');
        applyBtn.disabled = true;
        refreshBtn.disabled = true;

        // Load mute settings first
        await loadMutedDomains();

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

    // Ripple effect
    function createRipple(event) {
        const button = event.currentTarget;
        if (button.classList.contains('notification-toggle')) return; // No ripple for bell

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
        if (!button.classList.contains('notification-toggle')) {
            button.addEventListener('click', createRipple);
        }
    });

    applyBtn.addEventListener('click', async () => {
        const checkboxes = document.querySelectorAll('#sites-list input[type="checkbox"]');
        const sitesToRequest = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
        const sitesToRemove = Array.from(checkboxes).filter(cb => !cb.checked).map(cb => cb.value);

        const originsToRequest = sitesToRequest.map(domain => `*://${domain}/*`);
        const originsToRemove = sitesToRemove.map(domain => `*://${domain}/*`);

        try {
            if (originsToRemove.length > 0) {
                await chrome.permissions.remove({ origins: originsToRemove });
            }

            if (originsToRequest.length > 0) {
                showToast('יש לאשר את ההרשאות בחלון הקופץ...', 'info', 5000);
                const granted = await chrome.permissions.request({ origins: originsToRequest });

                if (granted) {
                    showToast('האישור התקבל! האתרים שבחרתם ישולבו כעת באתר הערוץ.', 'success');
                    chrome.runtime.sendMessage({
                        action: 'triggerCookieFix',
                        domains: sitesToRequest
                    });
                } else {
                    showToast('הגישה נדחתה. לא יהיה ניתן לאפשר את כל האתרים.', 'error');
                }
            } else {
                showToast('הגישה לאתרים הוסרה.', 'success');
            }
            
            // Re-render to update bells
            setTimeout(refreshSitesList, 500);

        } catch (error) {
            console.error(error);
            showToast(`אירעה שגיאה: ${error.message}`, 'error');
        }
    });

    // --- טעינה ראשונית ---
    refreshBtn.addEventListener('click', refreshSitesList);
    refreshSitesList();
});