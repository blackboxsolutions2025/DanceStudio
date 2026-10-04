document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    const resetForm = document.getElementById('resetForm');

    if (!token) {
        window.showErrorModal('Missing or invalid password reset token.', 'Invalid Link', () => {
            window.location.href = '../LoginPage/LoginPage.html';
        });
        resetForm.style.display = 'none';
        return;
    }

    resetForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (newPassword !== confirmPassword) {
            window.showErrorModal('New passwords do not match.', 'Password Mismatch');
            return;
        }

        try {
            const response = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, newPassword })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Password reset failed');
            }

            window.showSuccessModal(data.message, 'Password Updated', () => {
                window.location.href = '../LoginPage/LoginPage.html';
            });
        } catch (err) {
            window.showErrorModal(err.message, 'Reset Failed');
        }
    });
});