(async () => {

    // --- Define Global Helpers Immediately ---
    window.getCsrfToken = function() {
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            const [name, val] = cookie.trim().split('=');
            if (name === 'csrf_token') return val;
        }
        return '';
    };

    window.secureFetch = async function(url, options = {}) {
        options.credentials = 'include';
        options.headers = options.headers || {};
        
        const method = (options.method || 'GET').toUpperCase();
        if (['POST', 'PUT', 'DELETE'].includes(method)) {
            // Check if body is FormData (e.g. file uploads)
            if (options.body instanceof FormData) {
                // Remove Content-Type so browser automatically sets multipart/form-data with boundary
                delete options.headers['Content-Type'];
            } else {
                // Default to JSON for normal requests
                if (!options.headers['Content-Type']) {
                    options.headers['Content-Type'] = 'application/json';
                }
            }
            options.headers['X-CSRF-Token'] = window.getCsrfToken();
        }

        return fetch(url, options);
    };

    async function secureFetch(url, options = {}) {
        options.headers = options.headers || {};

        if (options.body instanceof FormData) {
            delete options.headers['Content-Type'];
        } else {
            if (!options.headers['Content-Type']) {
                options.headers['Content-Type'] = 'application/json';
            }
        }

        options.credentials = 'include';

        return fetch(url, options);
    }
    
    // ----------------------------------------

    if (!document.querySelector('link[href*="font-awesome"]')) {
        const fontAwesome = document.createElement('link');
        fontAwesome.rel = 'stylesheet';
        fontAwesome.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
        document.head.appendChild(fontAwesome);
    }

    if (!document.querySelector('link[href*="Shared/header.css"]')) {
        const headerCss = document.createElement('link');
        headerCss.rel = 'stylesheet';
        headerCss.href = '../Shared/header.css';
        document.head.appendChild(headerCss);
    }

    const currentPath = window.location.pathname;

    let userName = localStorage.getItem('userName') || 'Guest User';
    let userRole = localStorage.getItem('userRole') || '';
    let userAvatar = localStorage.getItem('userAvatar');
    let isAuthenticated = false;

    // Check authentication status via profile endpoint using the HttpOnly cookie
    try {
        const profileRes = await fetch('/api/user/profile', {
            credentials: 'include' // <--- Sends the secure cookie automatically
        });
        
        if (profileRes.ok) {
            isAuthenticated = true;
            const profileData = await profileRes.json();
            userName = profileData.name || userName;
            userRole = profileData.role || userRole;
            
            localStorage.setItem('userName', userName);
            localStorage.setItem('userRole', userRole);

            if (profileData.profileImage) {
                userAvatar = profileData.profileImage;
                localStorage.setItem('userAvatar', userAvatar);
            } else {
                localStorage.removeItem('userAvatar');
                userAvatar = null;
            }
        } else if (profileRes.status === 401 || profileRes.status === 403) {
            isAuthenticated = false;
            localStorage.removeItem('userName');
            localStorage.removeItem('userRole');
            localStorage.removeItem('userAvatar');
            userRole = '';
        }
    } catch (err) {
        console.error('Failed to sync header profile data:', err);
    }

    const renderAvatarHTML = (fallbackIconClass) => {
        if (userAvatar && userAvatar !== 'null' && userAvatar !== 'undefined') {
            return `<img src="${userAvatar}" alt="Profile Picture">`;
        }
        return `<i class="fa-solid ${fallbackIconClass}"></i>`;
    };

    const formattedRole = userRole ? userRole.toUpperCase() : '';

    let dropdownContent = '';
    if (isAuthenticated) {
        dropdownContent = `
            <div class="dropdown-user-info">
                <div class="dropdown-avatar">
                    ${renderAvatarHTML('fa-user')}
                </div>
                <div class="dropdown-name-col">
                    <span class="username">${userName}</span>
                    <span class="user-role-badge">${formattedRole.toLowerCase()}</span>
                </div>
            </div>
            <a href="../ShopCartPage/ShopCartPage.html" class="dropdown-btn">
                <i class="fa-solid fa-cart-shopping"></i> Cart
            </a>
            <a href="../UserOrderPage/UserOrderPage.html" class="dropdown-btn">
                <i class="fa-solid fa-box-open"></i> My Orders
            </a>
            <a href="/settings" class="dropdown-btn">
                <i class="fa-solid fa-gear"></i> Settings
            </a>
            <button class="dropdown-btn dropdown-logout" id="logoutBtn">
                <i class="fa-solid fa-right-from-bracket"></i> Log Out
            </button>
        `;
    } else {
        dropdownContent = `
            <div class="dropdown-user-info">
                <div class="dropdown-avatar">
                    <i class="fa-solid fa-user-shield"></i>
                </div>
                <div class="dropdown-name-col">
                    <span class="username">Guest</span>
                    <span class="user-role-badge">Visitor</span>
                </div>
            </div>
            <a href="../LoginPage/LoginPage.html" class="dropdown-btn">
                <i class="fa-solid fa-right-to-bracket"></i> Log In
            </a>
            <a href="../LoginPage/LoginPage.html" class="dropdown-btn">
                <i class="fa-solid fa-user-plus"></i> Sign Up
            </a>
        `;
    }

    const rightHeaderContent = `
        <div class="user-menu-container">
            <button class="user-icon-btn" id="userIconBtn" aria-label="User Menu">
                ${renderAvatarHTML('fa-user')}
            </button>
            <div class="user-dropdown" id="userDropdown">
                ${dropdownContent}
            </div>
        </div>
    `;

    // --- Role-Based Restricted Section ---
    let roleSpecificSectionHTML = '';
    if (isAuthenticated && userRole) {
        let roleLinksHTML = '';
        
        if (userRole === 'student') {
            roleLinksHTML = `
                <li><a href="../StudentClassSchedulePage/StudentClassSchedulePage.html" class="${currentPath.endsWith('StudentClassSchedulePage/StudentClassSchedulePage.html') ? 'active' : ''}"><i class="fa-solid fa-calendar-check"></i> My Class Schedule</a></li>
                <li><a href="../BookedVenuePage/BookedVenuePage.html" class="${currentPath.includes('BookedVenuePage') ? 'active' : ''}"><i class="fa-solid fa-building-circle-check"></i> My Booked Venues</a></li>
                <li><a href="../StudentAttendancePage/StudentAttendancePage.html" class="${currentPath.endsWith('StudentAttendancePage/StudentAttendancePage.html') ? 'active' : ''}"><i class="fa-solid fa-clipboard-user"></i> Attendance History</a></li>
            `;
        } else if (userRole === 'admin') {
            roleLinksHTML = `
                <li><a href="../AdminDashboardPage/AdminDashboardPage.html" class="${currentPath.includes('AdminDashboardPage') ? 'active' : ''}"><i class="fa-solid fa-gauge-high"></i> Admin Dashboard</a></li>
                <li><a href="../CoachListPage/CoachListPage.html" class="${currentPath.includes('CoachListPage') ? 'active' : ''}"><i class="fa-solid fa-chalkboard-user"></i> Instructor Management</a></li>
                <li><a href="../ClassScheduleListPage/ClassScheduleListPage.html" class="${currentPath.includes('ClassScheduleListPage') ? 'active' : ''}"><i class="fa-solid fa-calendar-days"></i> Class Schedule Management</a></li>
                <li><a href="../VenueListPage/VenueListPage.html" class="${currentPath.includes('VenueListPage') ? 'active' : ''}"><i class="fa-solid fa-building"></i> Venue Management</a></li>
                <li><a href="../BookedVenuePage/BookedVenuePage.html" class="${currentPath.includes('BookedVenuePage') ? 'active' : ''}"><i class="fa-solid fa-building-circle-check"></i> Booked Venues</a></li>
                <li><a href="../ProductListPage/ProductListPage.html" class="${currentPath.includes('ProductListPage') ? 'active' : ''}"><i class="fa-solid fa-box"></i> Product Management</a></li>
            `;
        } else if (userRole === 'coach') {
            roleLinksHTML = `
                <li><a href="../CoachSchedulePage/CoachSchedulePage.html" class="${currentPath.includes('CoachSchedulePage') ? 'active' : ''}"><i class="fa-solid fa-calendar-alt"></i> Coach Schedule</a></li>
            `;
        }

        roleSpecificSectionHTML = `
            <li class="drawer-separator-li"><hr class="drawer-separator"></li>
            <li class="drawer-role-display">
                <i class="fa-solid fa-id-badge"></i> <span><strong>${formattedRole}</strong></span>
            </li>
            ${roleLinksHTML}
        `;
    }

    const headerHTML = `
        <header class="site-header">
            <button class="hamburger-btn" id="hamburgerBtn" aria-label="Open Navigation">
                <i class="fa-solid fa-bars"></i>
            </button>
            <a href="../LandingPage/LandingPage.html" class="header-title">RHYTHM & SOUL</a>
            <div class="header-right-auth">
                ${rightHeaderContent}
            </div>
        </header>

        <div class="drawer-overlay" id="drawerOverlay"></div>

        <nav class="nav-drawer" id="navDrawer">
            <div class="drawer-header">
                <a href="../LandingPage/LandingPage.html" class="drawer-brand">
                    <i class="fa-solid fa-compact-disc"></i> Rhythm & <span>Soul</span>
                </a>
            </div>
            <ul class="nav-links">
                <li><a href="../LandingPage/LandingPage.html" class="${currentPath.includes('LandingPage') ? 'active' : ''}"><i class="fa-solid fa-house"></i> Home</a></li>
                <li><a href="../ClassSchedulePage/ClassSchedulePage.html" class="${currentPath.endsWith('ClassSchedulePage/ClassSchedulePage.html') ? 'active' : ''}"><i class="fa-solid fa-calendar-alt"></i> Class Schedule</a></li>
                <li><a href="../VenueRentalPage/VenueRentalPage.html" class="${currentPath.includes('VenueRentalPage') ? 'active' : ''}"><i class="fa-solid fa-building"></i> Venue Rental</a></li>
                <li><a href="../ShopListPage/ShopListPage.html" class="${currentPath.includes('ShopListPage') ? 'active' : ''}"><i class="fa-solid fa-store"></i> Shop</a></li>
                <li><a href="../LandingPage/LandingPage.html#about" class="${currentPath.includes('#about') ? 'active' : ''}"><i class="fa-solid fa-users"></i> About</a></li>
                <li><a href="../LandingPage/LandingPage.html#contact" class="${currentPath.includes('#contact') ? 'active' : ''}"><i class="fa-solid fa-envelope"></i> Contact</a></li>
                ${roleSpecificSectionHTML}
            </ul>
        </nav>
    `;

    const placeholder = document.getElementById('header-placeholder');
    if (placeholder) {
        placeholder.innerHTML = headerHTML;
    } else {
        document.body.insertAdjacentHTML('afterbegin', headerHTML);
    }

    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const navDrawer = document.getElementById('navDrawer');
    const drawerOverlay = document.getElementById('drawerOverlay');

    function openDrawer() {
        navDrawer.classList.add('open');
        drawerOverlay.classList.add('active');
    }

    function closeDrawer() {
        navDrawer.classList.remove('open');
        drawerOverlay.classList.remove('active');
    }

    if (hamburgerBtn) hamburgerBtn.addEventListener('click', openDrawer);
    if (drawerOverlay) drawerOverlay.addEventListener('click', closeDrawer);

    const userIconBtn = document.getElementById('userIconBtn');
    const userDropdown = document.getElementById('userDropdown');

    if (userIconBtn && userDropdown) {
        userIconBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            userDropdown.classList.toggle('active');
        });

        document.addEventListener('click', (e) => {
            if (!userDropdown.contains(e.target) && e.target !== userIconBtn) {
                userDropdown.classList.remove('active');
            }
        });
    }

    ['confirmation-modal', 'success-modal', 'error-modal'].forEach(modalName => {
        if (!document.querySelector(`link[href*="${modalName}.css"]`)) {
            const css = document.createElement('link');
            css.rel = 'stylesheet';
            css.href = `../Shared/${modalName}.css`;
            document.head.appendChild(css);
        }
        if (!document.querySelector(`script[src*="${modalName}.js"]`)) {
            const script = document.createElement('script');
            script.src = `../Shared/${modalName}.js`;
            document.body.appendChild(script);
        }
    });

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                const confirmed = typeof window.showConfirmModal === 'function' 
                    ? await window.showConfirmModal('Are you sure you want to log out of your account?', 'Log Out Confirmation', 'Log Out', 'Cancel')
                    : confirm('Are you sure you want to log out?');

                if (confirmed) {
                    await fetch('/api/auth/logout', {
                        method: 'POST',
                        credentials: 'include'
                    });

                    localStorage.clear();
                    window.location.href = '../LoginPage/LoginPage.html';
                }
            } catch (err) {
                console.error(err);
            }
        });
    }
})();