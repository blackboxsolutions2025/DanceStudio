document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    
    if (!token) {
        handleUnauthorized('Access denied. Please log in as an administrator.');
        return;
    }

    // 1. Strict Database Role Verification BEFORE Loading Any Data
    try {
        const profileRes = await fetch('/api/user/profile', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!profileRes.ok) {
            throw new Error('Failed to verify session.');
        }

        const userData = await profileRes.json();

        if (userData.role !== 'admin') {
            handleUnauthorized('Access denied. Administrator privileges required.');
            return;
        }

        // Admin verification passed successfully. Proceed to initialize page data.
        initCoachManagement(token);

    } catch (err) {
        console.error('Security Check Error:', err);
        handleUnauthorized('Session validation failed.');
    }
});

function handleUnauthorized(message) {
    if (typeof window.showErrorModal === 'function') {
        window.showErrorModal(message, 'Access Denied', () => {
            window.location.href = '../LandingPage/LandingPage.html';
        });
    } else {
        alert(message);
        window.location.href = '../LandingPage/LandingPage.html';
    }
}

function initCoachManagement(token) {
    const coachTableBody = document.getElementById('coachTableBody');
    const loadingState = document.getElementById('loadingState');
    const emptyState = document.getElementById('emptyState');
    const searchInput = document.getElementById('coachSearchInput');

    let allCoaches = [];

    async function fetchCoaches() {
        try {
            loadingState.style.display = 'block';
            coachTableBody.innerHTML = '';
            emptyState.style.display = 'none';

            const response = await fetch('/api/admin/coaches', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch instructor records.');
            }

            allCoaches = await response.json();
            loadingState.style.display = 'none';
            renderCoaches(allCoaches);
        } catch (err) {
            console.error('Error fetching coaches:', err);
            loadingState.style.display = 'none';
            if (typeof window.showErrorModal === 'function') {
                window.showErrorModal(err.message || 'Failed to load instructor records.', 'Error');
            } else {
                alert('Error: ' + err.message);
            }
        }
    }

    function renderCoaches(coachesToRender) {
        coachTableBody.innerHTML = '';

        if (coachesToRender.length === 0) {
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';

        coachesToRender.forEach(coach => {
            const avatarHTML = coach.profileimage 
                ? `<img src="${coach.profileimage}" alt="${coach.name}">` 
                : `<i class="fa-solid fa-user-tie"></i>`;

            // Email link opens Gmail / default mail client
            const emailHTML = coach.email 
                ? `<a href="mailto:${coach.email}" class="contact-link">${coach.email}</a>` 
                : 'No email provided';

            // Phone link triggers prompt for Call or Copy
            const phoneHTML = coach.phone 
                ? `<a href="#" class="contact-link phone-link" data-phone="${coach.phone}">${coach.phone}</a>` 
                : 'No phone provided';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div class="avatar-cell">
                        <div class="coach-avatar">
                            ${avatarHTML}
                        </div>
                    </div>
                </td>
                <td>
                    <div class="coach-name-col">
                        <span class="coach-name">${coach.name}</span>
                        <span class="coach-role-badge">Instructor</span>
                    </div>
                </td>
                <td>
                    <div class="contact-info-col">
                        <div class="contact-info-item">
                            <i class="fa-solid fa-envelope"></i> ${emailHTML}
                        </div>
                        <div class="contact-info-item">
                            <i class="fa-solid fa-phone"></i> ${phoneHTML}
                        </div>
                    </div>
                </td>
            `;

            // Attach interactive handler for phone number prompt (Call vs Copy)
            const phoneLink = tr.querySelector('.phone-link');
            if (phoneLink) {
                phoneLink.addEventListener('click', async (e) => {
                    e.preventDefault();
                    const phoneNum = coach.phone;

                    // Uses the project's confirmation modal to ask Call (Confirm) or Copy (Cancel)[cite: 44]
                    const wantsCall = typeof window.showConfirmModal === 'function'
                        ? await window.showConfirmModal(`Choose an action for phone number: ${phoneNum}`, 'Phone Options', 'Call', 'Copy')
                        : confirm(`Call ${phoneNum}?\nClick Cancel to Copy instead.`);

                    if (wantsCall) {
                        // Navigate to phone call handler[cite: 44]
                        window.location.href = `tel:${phoneNum}`;
                    } else {
                        // Robust copy approach with fallback for all browsers/contexts
                        try {
                            if (navigator.clipboard && navigator.clipboard.writeText) {
                                await navigator.clipboard.writeText(phoneNum);
                            } else {
                                // Fallback textarea method
                                const textarea = document.createElement('textarea');
                                textarea.value = phoneNum;
                                textarea.style.position = 'fixed'; // Prevents page scrolling
                                document.body.appendChild(textarea);
                                textarea.focus();
                                textarea.select();
                                const successful = document.execCommand('copy');
                                document.body.removeChild(textarea);
                                if (!successful) throw new Error('Fallback copy failed.');
                            }

                            if (typeof window.showSuccessModal === 'function') {
                                window.showSuccessModal(`Phone number ${phoneNum} copied to clipboard!`, 'Copied to Clipboard');
                            } else {
                                alert(`Copied to clipboard: ${phoneNum}`);
                            }
                        } catch (err) {
                            console.error('Failed to copy text: ', err);
                            if (typeof window.showErrorModal === 'function') {
                                window.showErrorModal('Failed to copy phone number to clipboard.', 'Copy Error');
                            } else {
                                alert('Failed to copy phone number.');
                            }
                        }
                    }
                });
            }

            coachTableBody.appendChild(tr);
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            const filtered = allCoaches.filter(coach => 
                coach.name.toLowerCase().includes(query) || 
                (coach.email && coach.email.toLowerCase().includes(query))
            );
            renderCoaches(filtered);
        });
    }

    fetchCoaches();
}