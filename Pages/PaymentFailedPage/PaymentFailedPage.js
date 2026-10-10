document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const classId = urlParams.get('classId');

    // Instantly notify backend to update payment and enrollment status to failed/cancelled using secureFetch
    if (classId) {
        try {
            await secureFetch('/api/checkout/fail', {
                method: 'POST',
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