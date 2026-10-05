document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const classId = urlParams.get('classId');
    const token = localStorage.getItem('token');

    // Instantly notify backend to update payment and enrollment status to failed/cancelled
    if (classId && token) {
        try {
            await fetch('/api/checkout/fail', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ class_id: classId })
            });
        } catch (err) {
            console.error("Failed to update transaction status:", err);
        }
    }

    const btnTryAgain = document.getElementById('btnTryAgain');
    if (btnTryAgain) {
        btnTryAgain.addEventListener('click', () => {
            window.location.href = '../ClassSchedulePage/ClassSchedulePage.html';
        });
    }
});