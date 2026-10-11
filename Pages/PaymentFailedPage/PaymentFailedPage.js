document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const classId = urlParams.get('classId');
    const shopCancelled = urlParams.get('shop');

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

    const failedTitle = document.getElementById('failedTitle');
    const failedDescription = document.getElementById('failedDescription');
    const btnTryAgain = document.getElementById('btnTryAgain');

    if (shopCancelled) {
        if (failedTitle) failedTitle.textContent = 'Shop Payment Cancelled or Failed';
        if (failedDescription) {
            failedDescription.textContent = "We couldn't process your shop payment transaction or your PayMongo session expired. No charges were made to your account. You can return to your cart to review and retry your order.";
        }
        if (btnTryAgain) {
            btnTryAgain.innerHTML = '<i class="fa-solid fa-cart-shopping"></i> Return to Cart';
            btnTryAgain.addEventListener('click', () => {
                window.location.href = '../ShopCartPage/ShopCartPage.html';
            });
        }
    } else {
        if (btnTryAgain) {
            btnTryAgain.addEventListener('click', () => {
                window.location.href = '../ClassSchedulePage/ClassSchedulePage.html';
            });
        }
    }
});