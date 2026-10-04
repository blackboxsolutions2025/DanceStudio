document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    let userRole = localStorage.getItem('userRole');

    // 1. Strict Role Verification before loading any data[cite: 12]
    if (!token) {
        if (typeof window.showErrorModal === 'function') {
            await window.showErrorModal('Access denied. Please log in as an administrator.', 'Authentication Required');
        } else {
            alert('Access denied. Please log in as an administrator.');
        }
        window.location.href = '../LoginPage/LoginPage.html';
        return;
    }

    try {
        const profileRes = await fetch('/api/user/profile', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (profileRes.ok) {
            const profileData = await profileRes.json();
            userRole = profileData.role;
            localStorage.setItem('userRole', userRole);
        } else {
            throw new Error('Failed to verify user profile.');
        }
    } catch (err) {
        console.error('Role verification error:', err);
        userRole = '';
    }

    if (userRole !== 'admin') {
        if (typeof window.showErrorModal === 'function') {
            await window.showErrorModal('Access denied. Administrator privileges are required to access the Coach Builder.', 'Access Restricted');
        } else {
            alert('Access denied. Administrator privileges are required.');
        }
        window.location.href = '../LandingPage/LandingPage.html';
        return;
    }

    // 2. Form Submission & Navigation Handlers
    const form = document.getElementById('coachBuilderForm');
    const cancelBtn = document.getElementById('cancelBtn');

    cancelBtn.addEventListener('click', async () => {
        const confirmed = typeof window.showConfirmModal === 'function'
            ? await window.showConfirmModal('Are you sure you want to discard changes and go back?', 'Discard Changes', 'Discard', 'Stay')
            : confirm('Discard changes and go back?');
        
        if (confirmed) {
            window.location.href = '../CoachListPage/CoachListPage.html';
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const confirmed = typeof window.showConfirmModal === 'function'
            ? await window.showConfirmModal('Are you sure you want to create this coach account and send an email verification link?', 'Confirm Coach Creation', 'Create Coach', 'Cancel')
            : confirm('Create this new coach?');

        if (!confirmed) return;

        const payload = {
            name: document.getElementById('coachName').value.trim(),
            email: document.getElementById('coachEmail').value.trim(),
            phone: document.getElementById('coachPhone').value.trim()
        };

        try {
            const res = await fetch('/api/admin/coaches', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (res.ok) {
                if (typeof window.showSuccessModal === 'function') {
                    await window.showSuccessModal(data.message || 'Coach successfully created and verification email sent!', 'Success');
                } else {
                    alert(data.message || 'Coach successfully created!');
                }
                window.location.href = '../CoachListPage/CoachListPage.html';
            } else {
                if (typeof window.showErrorModal === 'function') {
                    await window.showErrorModal(data.message || 'Failed to create coach.', 'Creation Error');
                } else {
                    alert(data.message || 'Failed to create coach.');
                }
            }
        } catch (err) {
            console.error('Create Coach Error:', err);
            if (typeof window.showErrorModal === 'function') {
                await window.showErrorModal('A server error occurred while creating the coach.', 'Network Error');
            } else {
                alert('A server error occurred.');
            }
        }
    });
});