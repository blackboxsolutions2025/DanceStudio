document.addEventListener('DOMContentLoaded', async () => {
    const summaryItemsList = document.getElementById('summaryItemsList');
    const totalDisplay = document.getElementById('totalDisplay');
    const proceedPaymentBtn = document.getElementById('proceedPaymentBtn');
    const backIconBtn = document.getElementById('backIconBtn');
    const pageLoadingOverlay = document.getElementById('pageLoadingOverlay');
    const loadingOverlayText = document.getElementById('loadingOverlayText');

    const displayRecipientName = document.getElementById('displayRecipientName');
    const displayRecipientPhone = document.getElementById('displayRecipientPhone');
    const displayRecipientEmail = document.getElementById('displayRecipientEmail');

    let cachedProfile = {
        name: 'Guest Customer',
        email: 'guest@example.com',
        phone: '09000000000'
    };

    // Fetch user profile info to display at top and payload submission
    try {
        const profileRes = await secureFetch('/api/user/profile');
        if (profileRes.ok) {
            const profile = await profileRes.json();
            if (profile.name) cachedProfile.name = profile.name;
            if (profile.email) cachedProfile.email = profile.email;
            if (profile.phone) cachedProfile.phone = profile.phone;
        }
    } catch (err) {
        console.warn('Could not load profile details:', err);
    }

    // Render Top Contact Info
    displayRecipientName.innerText = cachedProfile.name;
    displayRecipientPhone.innerText = cachedProfile.phone;
    displayRecipientEmail.innerText = cachedProfile.email;

    // Load items to checkout
    let checkoutItems = [];
    try {
        const stored = localStorage.getItem('studio_checkout_items');
        if (stored) {
            checkoutItems = JSON.parse(stored);
        } else {
            const cart = JSON.parse(localStorage.getItem('studio_cart') || '[]');
            checkoutItems = cart;
        }
    } catch (e) {
        checkoutItems = [];
    }

    // Handle Return Back Button Click -> Navigate back to ShopItemInfoPage
    if (backIconBtn) {
        backIconBtn.addEventListener('click', () => {
            let returnUrl = '../ShopItemInfoPage/ShopItemInfoPage.html';
            try {
                if (checkoutItems.length > 0 && checkoutItems[0].productId) {
                    returnUrl += `?id=${checkoutItems[0].productId}`;
                }
            } catch (e) {
                // fallback
            }
            window.location.href = returnUrl;
        });
    }

    if (!checkoutItems || checkoutItems.length === 0) {
        summaryItemsList.innerHTML = '<p class="loading-summary" style="color: #ef4444;">No items to checkout. Please select a product or add items to cart.</p>';
        if (proceedPaymentBtn) proceedPaymentBtn.disabled = true;
        return;
    }

    let catalogProducts = [];
    try {
        const res = await secureFetch('/api/shop/products');
        if (res.ok) {
            catalogProducts = await res.json();
        }
    } catch (err) {
        console.error('Failed to load product catalog for checkout summary:', err);
    }

    let subtotal = 0;
    const formattedItemsForDisplay = [];

    checkoutItems.forEach(item => {
        const product = catalogProducts.find(p => p.id == item.productId);
        if (!product) return;

        const variant = product.variants ? product.variants.find(v => v.id == item.variantId) : null;
        const price = variant ? (variant.price_override || product.base_price) : product.base_price;
        const itemTotal = Number(price) * Number(item.quantity);
        subtotal += itemTotal;

        let variantText = '';
        if (item.attributes) {
            variantText = Object.entries(item.attributes).map(([k, v]) => `${k}: ${v}`).join(' | ');
        }

        formattedItemsForDisplay.push({
            title: product.title,
            image: variant?.image || product.main_image || 'https://via.placeholder.com/60?text=No+Image',
            price: Number(price),
            quantity: item.quantity,
            variantText: variantText,
            productId: product.id,
            variantId: item.variantId
        });
    });

    if (formattedItemsForDisplay.length === 0) {
        summaryItemsList.innerHTML = '<p class="loading-summary" style="color: #ef4444;">Invalid checkout items.</p>';
        if (proceedPaymentBtn) proceedPaymentBtn.disabled = true;
        return;
    }

    // Render Scrollable Summary Items
    summaryItemsList.innerHTML = formattedItemsForDisplay.map(item => `
        <div class="summary-item-card">
            <img src="${item.image}" alt="${item.title}" class="summary-item-img">
            <div class="summary-item-info">
                <h4 class="summary-item-title">${item.title}</h4>
                <p class="summary-item-meta">${item.variantText ? item.variantText + ' | ' : ''}Qty: ${item.quantity}</p>
            </div>
            <span class="summary-item-price">₱${(item.price * item.quantity).toFixed(2)}</span>
        </div>
    `).join('');

    totalDisplay.innerText = `₱${subtotal.toFixed(2)}`;

    // Handle Place Order Button Click
    if (proceedPaymentBtn) {
        proceedPaymentBtn.addEventListener('click', async () => {
            const payload = {
                recipient_name: cachedProfile.name,
                email: cachedProfile.email,
                phone: cachedProfile.phone,
                items: checkoutItems.map(item => ({
                    productId: item.productId,
                    variantId: item.variantId,
                    quantity: item.quantity
                }))
            };

            // Show full-page loading overlay
            loadingOverlayText.innerText = 'Locking inventory & initializing PayMongo checkout...';
            pageLoadingOverlay.style.display = 'flex';
            proceedPaymentBtn.disabled = true;
            if (backIconBtn) backIconBtn.disabled = true;

            try {
                const response = await secureFetch('/api/shop/checkout', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.message || 'Failed to initiate shop checkout.');
                }

                if (data.checkoutUrl) {
                    localStorage.removeItem('studio_checkout_items');
                    window.location.href = data.checkoutUrl;
                } else {
                    throw new Error('No checkout URL returned from server.');
                }
            } catch (err) {
                console.error('Checkout Error:', err);
                
                // Hide overlay on error so user can retry
                pageLoadingOverlay.style.display = 'none';
                proceedPaymentBtn.disabled = false;
                if (backIconBtn) backIconBtn.disabled = false;

                if (typeof window.showErrorModal === 'function') {
                    window.showErrorModal(err.message || 'An error occurred during checkout.');
                } else {
                    alert(err.message || 'An error occurred during checkout.');
                }
            }
        });
    }
});