document.addEventListener('DOMContentLoaded', async () => {
    await loadCartItems();
});

let cartData = [];

async function loadCartItems() {
    const container = document.getElementById('cartContainer');
    const stickyFooter = document.getElementById('cartStickyFooter');

    try {
        const response = await secureFetch('/api/shop/cart');
        
        if (response.status === 401 || response.status === 403) {
            container.innerHTML = `
                <div class="empty-cart-state">
                    <i class="fa-solid fa-lock"></i>
                    <h3>Authentication Required</h3>
                    <p>Please log in to view your shopping cart items.</p>
                    <a href="../LoginPage/LoginPage.html" class="btn-shop-now">Log In Now</a>
                </div>
            `;
            if (stickyFooter) stickyFooter.style.display = 'none';
            return;
        }

        if (!response.ok) throw new Error('Failed to load cart items.');

        cartData = await response.json();

        if (cartData.length === 0) {
            container.innerHTML = `
                <div class="empty-cart-state">
                    <i class="fa-solid fa-cart-shopping"></i>
                    <h3>Your Cart is Empty</h3>
                    <p>Explore our shop catalog and discover amazing dance apparel and gear!</p>
                    <a href="../ShopListPage/ShopListPage.html" class="btn-shop-now">Explore Shop</a>
                </div>
            `;
            if (stickyFooter) stickyFooter.style.display = 'none';
            return;
        }

        renderCartItems();
        if (stickyFooter) stickyFooter.style.display = 'block';
        updateFooterSummary();

    } catch (err) {
        console.error('Error fetching cart:', err);
        container.innerHTML = '<p class="loading-state" style="color: #ef4444;">Failed to load cart items. Please try again.</p>';
        if (stickyFooter) stickyFooter.style.display = 'none';
    }
}

function renderCartItems() {
    const container = document.getElementById('cartContainer');
    
    // Group cart items by product title
    const grouped = {};
    cartData.forEach(item => {
        if (!grouped[item.title]) {
            grouped[item.title] = [];
        }
        grouped[item.title].push(item);
    });

    let html = '';

    for (const [productTitle, items] of Object.entries(grouped)) {
        const encodedTitle = encodeURIComponent(productTitle);
        html += `
            <div class="cart-group-card" id="groupCard-${encodedTitle}">
                <div class="cart-group-header">
                    <div class="cart-group-header-left">
                        <input type="checkbox" class="cart-item-checkbox group-checkbox" data-product-title="${encodedTitle}" onchange="handleGroupCheckboxChange(this)">
                        <h3 class="cart-group-title">${productTitle}</h3>
                    </div>
                    <button class="cart-edit-group-btn" onclick="toggleGroupEditMode('${encodedTitle}')">Edit</button>
                </div>
                <div class="cart-group-items">
        `;

        items.forEach(item => {
            const attrStr = item.attributes && item.attributes.length > 0 
                ? item.attributes.map(a => a.value).join(', ') 
                : '';

            html += `
                <div class="cart-item-wrapper">
                    <div class="cart-delete-action" onclick="removeCartItem(${item.cartId})">
                        <i class="fa-solid fa-trash-can"></i>
                    </div>
                    <div class="cart-item-card" data-cart-id="${item.cartId}" 
                         ontouchstart="handleTouchStart(event)" ontouchmove="handleTouchMove(event)" ontouchend="handleTouchEnd(event)"
                         onmousedown="handleMouseDown(event)">
                        <input type="checkbox" class="cart-item-checkbox item-checkbox" data-cart-id="${item.cartId}" data-product-title="${encodedTitle}" onchange="handleItemCheckboxChange()">
                        <div class="cart-item-img">
                            <img src="${item.image}" alt="${item.title}" onerror="this.src='https://via.placeholder.com/100?text=Missing'">
                        </div>
                        <div class="cart-item-details">
                            ${attrStr ? `<span class="cart-item-attrs">${attrStr}</span>` : ''}
                            <div class="cart-item-bottom-row">
                                <span class="cart-item-price">₱${Number(item.price).toFixed(2)}</span>
                                <div class="cart-item-actions">
                                    <div class="cart-qty-control">
                                        <button class="cart-qty-btn" onclick="updateQuantity(${item.cartId}, -1)" ${item.quantity <= 1 ? 'disabled' : ''}>
                                            <i class="fa-solid fa-minus"></i>
                                        </button>
                                        <input type="text" class="cart-qty-input" value="${item.quantity}" readonly>
                                        <button class="cart-qty-btn" onclick="updateQuantity(${item.cartId}, 1)" ${item.quantity >= item.stock ? 'disabled' : ''}>
                                            <i class="fa-solid fa-plus"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;
    }

    container.innerHTML = html;
}

window.toggleGroupEditMode = function(encodedTitle) {
    const groupCard = document.getElementById(`groupCard-${encodedTitle}`);
    if (groupCard) {
        const isEditing = groupCard.classList.toggle('editing-mode');
        const editBtn = groupCard.querySelector('.cart-edit-group-btn');
        editBtn.innerText = isEditing ? 'Done' : 'Edit';
    }
};

/* Touch & Swipe Handling for Delete */
let touchStartX = 0;
let currentSwipeCard = null;

window.handleTouchStart = function(e) {
    touchStartX = e.touches[0].clientX;
    currentSwipeCard = e.currentTarget;
};

window.handleTouchMove = function(e) {
    if (!currentSwipeCard) return;
    const currentX = e.touches[0].clientX;
    const diff = touchStartX - currentX;
    if (diff > 30) {
        currentSwipeCard.classList.add('swiped');
    } else if (diff < -10) {
        currentSwipeCard.classList.remove('swiped');
    }
};

window.handleTouchEnd = function(e) {
    currentSwipeCard = null;
};

let mouseStartX = 0;
let mouseSwipeCard = null;

window.handleMouseDown = function(e) {
    if (e.target.closest('input') || e.target.closest('button')) return;
    mouseStartX = e.clientX;
    mouseSwipeCard = e.currentTarget;
    
    const onMouseMove = (moveEvent) => {
        if (!mouseSwipeCard) return;
        const diff = mouseStartX - moveEvent.clientX;
        if (diff > 30) {
            mouseSwipeCard.classList.add('swiped');
        } else if (diff < -10) {
            mouseSwipeCard.classList.remove('swiped');
        }
    };
    
    const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        mouseSwipeCard = null;
    };
    
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
};

window.toggleSelectAll = function(selectAllCheckbox) {
    const checkboxes = document.querySelectorAll('.cart-item-checkbox');
    checkboxes.forEach(cb => {
        cb.checked = selectAllCheckbox.checked;
    });
    updateFooterSummary();
};

window.handleGroupCheckboxChange = function(groupCheckbox) {
    const title = groupCheckbox.getAttribute('data-product-title');
    const childCheckboxes = document.querySelectorAll(`.item-checkbox[data-product-title="${title}"]`);
    childCheckboxes.forEach(cb => {
        cb.checked = groupCheckbox.checked;
    });
    updateGlobalSelectAllState();
    updateFooterSummary();
};

window.handleItemCheckboxChange = function() {
    const groupCards = document.querySelectorAll('.cart-group-card');
    groupCards.forEach(card => {
        const groupCb = card.querySelector('.group-checkbox');
        const title = groupCb.getAttribute('data-product-title');
        const children = card.querySelectorAll('.item-checkbox');
        const allChildrenChecked = Array.from(children).every(cb => cb.checked);
        const someChildrenChecked = Array.from(children).some(cb => cb.checked);
        
        groupCb.checked = allChildrenChecked;
        groupCb.indeterminate = someChildrenChecked && !allChildrenChecked;
    });

    updateGlobalSelectAllState();
    updateFooterSummary();
};

function updateGlobalSelectAllState() {
    const itemCheckboxes = document.querySelectorAll('.item-checkbox');
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    
    const allChecked = Array.from(itemCheckboxes).every(cb => cb.checked);
    const someChecked = Array.from(itemCheckboxes).some(cb => cb.checked);

    if (selectAllCheckbox) {
        selectAllCheckbox.checked = allChecked;
        selectAllCheckbox.indeterminate = someChecked && !allChecked;
    }
}

function updateFooterSummary() {
    const checkboxes = document.querySelectorAll('.item-checkbox:checked');
    const selectedCountSpan = document.getElementById('selectedCount');
    const totalPriceDisplay = document.getElementById('totalPriceDisplay');
    const checkoutBtn = document.getElementById('checkoutBtn');

    let total = 0;
    const selectedCartIds = Array.from(checkboxes).map(cb => parseInt(cb.getAttribute('data-cart-id')));

    selectedCartIds.forEach(cartId => {
        const item = cartData.find(i => i.cartId === cartId);
        if (item) {
            total += item.price * item.quantity;
        }
    });

    if (selectedCountSpan) selectedCountSpan.innerText = selectedCartIds.length;
    if (totalPriceDisplay) totalPriceDisplay.innerText = `₱${total.toFixed(2)}`;
    if (checkoutBtn) checkoutBtn.disabled = selectedCartIds.length === 0;
}

window.updateQuantity = async function(cartId, change) {
    const item = cartData.find(i => i.cartId === cartId);
    if (!item) return;

    const newQty = item.quantity + change;
    if (newQty < 1 || newQty > item.stock) return;

    // 1. Save currently checked item IDs before re-rendering
    const checkedCartIds = Array.from(document.querySelectorAll('.item-checkbox:checked'))
        .map(cb => cb.getAttribute('data-cart-id'));

    try {
        const response = await secureFetch(`/api/shop/cart/${cartId}`, {
            method: 'PUT',
            body: JSON.stringify({ quantity: newQty })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.message || 'Failed to update quantity.');
        }

        item.quantity = newQty;
        renderCartItems();

        // 2. Restore checked states on the newly rendered elements
        checkedCartIds.forEach(id => {
            const checkbox = document.querySelector(`.item-checkbox[data-cart-id="${id}"]`);
            if (checkbox) checkbox.checked = true;
        });

        // 3. Recalculate group checkboxes and footer summary
        handleItemCheckboxChange();

    } catch (err) {
        console.error('Update quantity error:', err);
        alert(err.message || 'Failed to update quantity.');
    }
};

window.removeCartItem = async function(cartId) {
    try {
        const confirmed = typeof window.showConfirmModal === 'function'
            ? await window.showConfirmModal('Are you sure you want to remove this item from your cart?', 'Remove Item', 'Remove', 'Cancel')
            : confirm('Remove this item from your cart?');

        if (!confirmed) return;

        // Save currently checked item IDs before removal & re-render
        const checkedCartIds = Array.from(document.querySelectorAll('.item-checkbox:checked'))
            .map(cb => cb.getAttribute('data-cart-id'))
            .filter(id => id !== String(cartId)); // Exclude the deleted item

        const response = await secureFetch(`/api/shop/cart/${cartId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.message || 'Failed to remove item.');
        }

        cartData = cartData.filter(i => i.cartId !== cartId);
        
        if (cartData.length === 0) {
            loadCartItems();
        } else {
            renderCartItems();

            // Restore checked states for remaining items
            checkedCartIds.forEach(id => {
                const checkbox = document.querySelector(`.item-checkbox[data-cart-id="${id}"]`);
                if (checkbox) checkbox.checked = true;
            });

            handleItemCheckboxChange();
        }

    } catch (err) {
        console.error('Remove item error:', err);
        alert(err.message || 'Failed to remove item.');
    }
};

window.proceedToCheckout = function() {
    const checkboxes = document.querySelectorAll('.item-checkbox:checked');
    const selectedCartIds = Array.from(checkboxes).map(cb => parseInt(cb.getAttribute('data-cart-id')));

    if (selectedCartIds.length === 0) return;

    const checkoutItems = selectedCartIds.map(cartId => {
        const item = cartData.find(i => i.cartId === cartId);
        return {
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            price: item.price,
            title: item.title,
            image: item.image,
            attributes: item.attributes
        };
    });

    localStorage.setItem('studio_checkout_items', JSON.stringify(checkoutItems));
    window.location.href = '../ShopCheckoutPage/ShopCheckoutPage.html';
};