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

    displayRecipientName.innerText = cachedProfile.name;
    displayRecipientPhone.innerText = cachedProfile.phone;
    displayRecipientEmail.innerText = cachedProfile.email;

    let checkoutItems = [];
    try {
        const stored = localStorage.getItem('studio_checkout_items');
        if (stored) {
            checkoutItems = JSON.parse(stored);
        } else {
            checkoutItems = JSON.parse(localStorage.getItem('studio_cart') || '[]');
        }
    } catch (e) {
        checkoutItems = [];
    }

    if (backIconBtn) {
        backIconBtn.addEventListener('click', () => {
            window.location.href = '../ShopCartPage/ShopCartPage.html';
        });
    }

    if (!checkoutItems || checkoutItems.length === 0) {
        summaryItemsList.innerHTML = '<p class="loading-summary" style="color: #ef4444;">No items to checkout. Please select items from your cart.</p>';
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
        const price = item.price || (variant ? (variant.price_override || product.base_price) : product.base_price);
        const itemTotal = Number(price) * Number(item.quantity);
        subtotal += itemTotal;

        // Correctly format variant attributes (comma-separated values only, e.g. "Red, Small")
        let attrText = '';
        const sourceAttributes = item.attributes || variant?.attributes;
        if (sourceAttributes && Array.isArray(sourceAttributes) && sourceAttributes.length > 0) {
            attrText = sourceAttributes.map(a => a.value).join(', ');
        }

        formattedItemsForDisplay.push({
            title: product.title,
            image: variant?.image || product.main_image || item.image || 'https://via.placeholder.com/60?text=No+Image',
            price: Number(price),
            quantity: item.quantity,
            attrText: attrText,
            productId: product.id,
            variantId: item.variantId
        });
    });

    if (formattedItemsForDisplay.length === 0) {
        summaryItemsList.innerHTML = '<p class="loading-summary" style="color: #ef4444;">Invalid checkout items.</p>';
        if (proceedPaymentBtn) proceedPaymentBtn.disabled = true;
        return;
    }

    // Group items by product name
    const grouped = {};
    formattedItemsForDisplay.forEach(item => {
        if (!grouped[item.title]) {
            grouped[item.title] = [];
        }
        grouped[item.title].push(item);
    });

    let html = '';
    for (const [productTitle, items] of Object.entries(grouped)) {
        html += `
            <div class="checkout-group-card">
                <div class="checkout-group-header">
                    <h4 class="checkout-group-title">${productTitle}</h4>
                </div>
                <div class="checkout-group-items">
        `;

        items.forEach(item => {
            html += `
                <div class="summary-item-card">
                    <img src="${item.image}" alt="${item.title}" class="summary-item-img">
                    <div class="summary-item-info">
                        ${item.attrText ? `<span class="summary-item-attrs">${item.attrText}</span>` : ''}
                        <p class="summary-item-meta">Qty: ${item.quantity}</p>
                    </div>
                    <span class="summary-item-price">₱${(item.price * item.quantity).toFixed(2)}</span>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;
    }

    summaryItemsList.innerHTML = html;
    totalDisplay.innerText = `₱${subtotal.toFixed(2)}`;

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