document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    
    if (!token) {
        if (typeof window.showErrorModal === 'function') {
            window.showErrorModal('Access denied. Please log in as an administrator.', 'Unauthorized Access', () => {
                window.location.href = '../LandingPage/LandingPage.html';
            });
        } else {
            alert('Access denied. Please log in as an administrator.');
            window.location.href = '../LandingPage/LandingPage.html';
        }
        return;
    }

    try {
        // Always check the user's role directly through the database via the API before loading any data
        const response = await fetch('/api/user/profile', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error('Failed to verify user session.');
        }

        const userData = await response.json();

        // Verify if the database role is explicitly 'admin'
        if (userData.role !== 'admin') {
            if (typeof window.showErrorModal === 'function') {
                window.showErrorModal('Access denied. Administrator privileges required.', 'Unauthorized', () => {
                    window.location.href = '../LandingPage/LandingPage.html';
                });
            } else {
                alert('Access denied. Administrator privileges required.');
                window.location.href = '../LandingPage/LandingPage.html';
            }
            return;
        }

        // Admin verification passed successfully. You can now proceed to load dashboard data.
        console.log('Admin session verified for:', userData.name);

    } catch (err) {
        console.error('Admin Role Verification Error:', err);
        if (typeof window.showErrorModal === 'function') {
            window.showErrorModal('Session validation failed. Redirecting to home page.', 'Error', () => {
                window.location.href = '../LandingPage/LandingPage.html';
            });
        } else {
            alert('Session validation failed.');
            window.location.href = '../LandingPage/LandingPage.html';
        }
    }
});