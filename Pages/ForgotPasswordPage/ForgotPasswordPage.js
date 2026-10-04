document.addEventListener('DOMContentLoaded', () => {
    const forgotForm = document.getElementById('forgotForm');
    const submitBtn = forgotForm.querySelector('button[type="submit"]');

    forgotForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Activate loading state & disable button
        submitBtn.classList.add('loading');
        submitBtn.disabled = true;

        const email = document.getElementById('forgotEmail').value;

        try {
            const response = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Request failed');
            }

            window.showSuccessModal(data.message, 'Check Your Inbox', () => {
                forgotForm.reset();
            });
        } catch (err) {
            window.showErrorModal(err.message, 'Reset Request Failed');
        } finally {
            // Remove loading state & re-enable button
            submitBtn.classList.remove('loading');
            submitBtn.disabled = false;
        }
    });
});