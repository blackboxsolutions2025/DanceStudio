document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('itemInfoContainer');
    const stickyBottomBar = document.getElementById('stickyBottomBar');
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');

    if (!productId) {
        container.innerHTML = '<p class="loading-state" style="color: #ef4444;">Product not found.</p>';
        return;
    }

    try {
        const response = await fetch('/api/shop/products');
        if (!response.ok) throw new Error('Failed to fetch product catalog.'); 

        const products = await response.json();
        const product = products.find(p => p.id == productId);

        if (!product) {
            container.innerHTML = '<p class="loading-state" style="color: #ef4444;">Product does not exist or has been removed.</p>'; 
            return;
        }

        // Collect all available images
        let allImages = [];
        if (product.main_image) allImages.push(product.main_image);
        if (product.gallery_images && product.gallery_images.length > 0) {
            allImages = allImages.concat(product.gallery_images);
        }
        if (product.variants) {
            product.variants.forEach(v => {
                if (v.image && !allImages.includes(v.image)) allImages.push(v.image);
            });
        }
        if (allImages.length === 0) allImages.push('https://via.placeholder.com/400?text=No+Image');

        // Extract unique attribute types and values
        const attributeMap = {};
        if (product.variants && product.variants.length > 0) {
            product.variants.forEach(v => {
                if (v.attributes) {
                    v.attributes.forEach(attr => {
                        if (!attributeMap[attr.attribute_name]) {
                            attributeMap[attr.attribute_name] = new Set();
                        }
                        attributeMap[attr.attribute_name].add(attr.value);
                    });
                }
            });
        }

        // State tracking
        window.currentProduct = product;
        window.attributeMap = attributeMap;
        window.selectedAttributes = {}; // Empty by default so all options start enabled and unselected
        window.activeModalActionType = 'cart';
        window.currentPreviewImage = null; // Track manually clicked gallery images

        // Render Page Layout with Description Card & Main Page Attributes Container
        container.innerHTML = `
            <div class="product-detail-grid">
                <!-- Gallery Column -->
                <div class="gallery-col">
                    <div class="main-preview-img" id="mainPreviewWrapper">
                        <img src="${allImages[0]}" alt="${product.title}" id="mainPreviewImg">
                    </div>
                    <div class="thumbnail-row" id="thumbnailRow">
                        ${allImages.map((img, idx) => `
                            <div class="thumb-img ${idx === 0 ? 'active' : ''}" data-img-src="${img}">
                                <img src="${img}" alt="Thumbnail" onerror="this.src='https://via.placeholder.com/70?text=Missing'">
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Details Column -->
                <div class="details-col">
                    <h1 class="product-name">${product.title}</h1>
                    <div class="product-price-tag" id="priceDisplay">₱${Number(product.base_price).toFixed(2)}</div>

                    <!-- Scrollable Description Card -->
                    <div class="product-description-card">
                        <span class="section-title">Description</span>
                        <div class="description-scroll-box">
                            <p>${product.description || 'No description provided for this item.'}</p>
                        </div>
                    </div>

                    <!-- Main Page Variant Attributes Container -->
                    <div class="page-attributes-container" id="pageAttributesContainer">
                        <!-- Dynamically injected attribute groups -->
                    </div>
                </div>
            </div>
        `;

        // Attach event listener for horizontally scrollable sub-images using event delegation
        const thumbnailRow = document.getElementById('thumbnailRow');
        if (thumbnailRow) {
            thumbnailRow.addEventListener('click', (e) => {
                const thumb = e.target.closest('.thumb-img');
                if (!thumb) return;
                const imgSrc = thumb.getAttribute('data-img-src');
                if (imgSrc) {
                    changePreviewImage(imgSrc, thumb);
                }
            });
        }

        // Show sticky action bar
        stickyBottomBar.style.display = 'block';

        // Render both main page attributes and modal attributes
        renderAllAttributeContainers();

    } catch (err) {
        console.error('Error loading product details:', err);
        container.innerHTML = '<p class="loading-state" style="color: #ef4444;">Failed to load product details.</p>';
    }
});

// Render attribute buttons for both main page and modal
function renderAllAttributeContainers() {
    renderAttributeContainer('pageAttributesContainer');
    renderAttributeContainer('modalAttributesContainer');

    const modalProductName = document.getElementById('modalProductName');
    if (modalProductName && window.currentProduct) {
        modalProductName.innerText = window.currentProduct.title;
    }

    updateMatchedVariantState();
}

function renderAttributeContainer(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const attributeMap = window.attributeMap;
    let attrHtml = '';
    
    Object.keys(attributeMap).forEach(attrName => {
        const values = Array.from(attributeMap[attrName]);
        attrHtml += `
            <div class="attribute-group">
                <span class="section-title">${attrName}</span>
                <div class="variants-group" data-attribute-name="${attrName}">
                    ${values.map(val => `
                        <button class="variant-btn ${window.selectedAttributes[attrName] === val ? 'selected' : ''}"
                                data-value="${val}"
                                onclick="selectAttributeValue('${attrName}', '${val}', this)">
                            ${val}
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
    });
    container.innerHTML = attrHtml;
}

// Handle selecting or deselecting an attribute value in the modal or main page
window.selectAttributeValue = function(attrName, attrValue, element) {
    if (element && element.classList.contains('disabled')) {
        return;
    }

    if (window.selectedAttributes[attrName] === attrValue) {
        delete window.selectedAttributes[attrName];
    } else {
        window.selectedAttributes[attrName] = attrValue;
    }
    
    window.currentPreviewImage = null; // Clear gallery preview so variant/main image takes over on attribute change
    renderAllAttributeContainers();
};


// Check availability matrix, update price, stock, and navigate preview images dynamically
function updateMatchedVariantState() {
    const product = window.currentProduct;
    if (!product) return;

    const mainPreviewImg = document.getElementById('mainPreviewImg');
    const modalImg = document.getElementById('modalImg');
    const priceDisplay = document.getElementById('priceDisplay');
    const modalPriceDisplay = document.getElementById('modalPriceDisplay');
    const modalStockDisplay = document.getElementById('modalStockDisplay');
    const confirmBtn = document.getElementById('modalConfirmBtn');

    const selectedKeys = Object.keys(window.selectedAttributes).filter(k => window.selectedAttributes[k]);

    let matchedVariant = null;
    if (selectedKeys.length > 0) {
        matchedVariant = product.variants.find(v => {
            return selectedKeys.every(attrName => {
                const val = window.selectedAttributes[attrName];
                return v.attributes.some(attr => attr.attribute_name === attrName && attr.value === val);
            });
        });
    }

    let currentPrice = product.base_price;
    let currentStock = product.variants.reduce((sum, v) => sum + v.stock_quantity, 0);
    let currentImg = product.main_image;

    if (matchedVariant) {
        currentPrice = matchedVariant.price_override || product.base_price;
        currentStock = matchedVariant.stock_quantity;
        if (matchedVariant.image) {
            currentImg = matchedVariant.image;
            window.currentPreviewImage = null; // Reset manual gallery override when a variant with an image matches
        }
    } 

    // Respect manually clicked gallery sub-image if no variant image overrides it
    if (!matchedVariant?.image && window.currentPreviewImage) {
        currentImg = window.currentPreviewImage;
    }

    // Update Price and Stock Displays
    if (priceDisplay) priceDisplay.innerText = `₱${Number(currentPrice).toFixed(2)}`;
    if (modalPriceDisplay) modalPriceDisplay.innerText = `₱${Number(currentPrice).toFixed(2)}`;
    if (modalStockDisplay) modalStockDisplay.innerText = `Stock: ${currentStock}`;

    // Update Images (Main Preview and Modal Image)
    if (mainPreviewImg && currentImg) mainPreviewImg.src = currentImg;
    if (modalImg && currentImg) modalImg.src = currentImg;

    // Highlight matching thumbnail if available
    if (currentImg) {
        const thumbs = document.querySelectorAll('.thumb-img');
        thumbs.forEach(thumb => {
            const imgEl = thumb.querySelector('img');
            const thumbSrc = thumb.getAttribute('data-img-src');
            if (imgEl && (imgEl.src === currentImg || thumbSrc === currentImg)) {
                thumbs.forEach(t => t.classList.remove('active'));
                thumb.classList.add('active');
            }
        });
    }

    if (confirmBtn) {
        if (selectedKeys.length < Object.keys(window.attributeMap).length || (matchedVariant && matchedVariant.stock_quantity <= 0)) {
            if (matchedVariant && matchedVariant.stock_quantity <= 0) {
                confirmBtn.innerText = 'Out of Stock';
                confirmBtn.style.opacity = '0.5';
                confirmBtn.style.pointerEvents = 'none';
            } else {
                confirmBtn.innerText = window.activeModalActionType === 'cart' ? 'Add to Cart' : 'Proceed to Checkout';
                confirmBtn.style.opacity = '1';
                confirmBtn.style.pointerEvents = 'auto';
            }
        } else {
            confirmBtn.innerText = window.activeModalActionType === 'cart' ? 'Add to Cart' : 'Proceed to Checkout';
            confirmBtn.style.opacity = '1';
            confirmBtn.style.pointerEvents = 'auto';
        }
    }

    // Smart Graying Out across all variant groups
    const attrGroups = document.querySelectorAll('.variants-group');
    attrGroups.forEach(group => {
        const attrName = group.getAttribute('data-attribute-name');
        const buttons = group.querySelectorAll('.variant-btn');

        buttons.forEach(btn => {
            const val = btn.getAttribute('data-value');
            const testSelections = { ...window.selectedAttributes, [attrName]: val };
            const activeTestKeys = Object.keys(testSelections).filter(k => testSelections[k]);

            const isValidCombination = product.variants.some(v => {
                const matchesTest = activeTestKeys.every(k => {
                    const testVal = testSelections[k];
                    return v.attributes.some(attr => attr.attribute_name === k && attr.value === testVal);
                });
                return matchesTest && v.stock_quantity > 0;
            });

            if (!isValidCombination) {
                btn.classList.add('disabled');
            } else {
                btn.classList.remove('disabled');
            }

            if (window.selectedAttributes[attrName] === val) {
                btn.classList.add('selected');
            } else {
                btn.classList.remove('selected');
            }
        });
    });
}

// Open / Close Modal Handlers
window.openVariantModal = function(actionType) {
    window.activeModalActionType = actionType;
    const confirmBtn = document.getElementById('modalConfirmBtn');
    if (confirmBtn) {
        confirmBtn.innerText = actionType === 'cart' ? 'Add to Cart' : 'Proceed to Checkout';
    }

    updateMatchedVariantState();
    document.getElementById('shopModalOverlay').classList.add('active');
};

window.closeVariantModal = function(event) {
    document.getElementById('shopModalOverlay').classList.remove('active');
};

// Quantity adjustment inside modal
window.updateModalQty = function(change) {
    const input = document.getElementById('modalQtyInput');
    if (!input) return;
    let current = parseInt(input.value) + change;
    if (current < 1) current = 1;
    input.value = current;
};

// Confirm action (Add to Cart or Buy Now / Checkout) with Stock Validation & Global Modals
window.confirmModalAction = function() {
    const product = window.currentProduct;
    const qtyInput = document.getElementById('modalQtyInput');
    const qty = qtyInput ? parseInt(qtyInput.value) : 1;

    const matchedVariant = product.variants.find(v => {
        return Object.keys(window.selectedAttributes).every(attrName => {
            const val = window.selectedAttributes[attrName];
            return v.attributes.some(attr => attr.attribute_name === attrName && attr.value === val);
        });
    });

    if (!matchedVariant || matchedVariant.stock_quantity <= 0) {
        if (typeof window.showErrorModal === 'function') {
            window.showErrorModal('Please select valid and in-stock variant attributes.');
        } else {
            alert('Please select valid and in-stock variant attributes.');
        }
        return;
    }

    if (qty > matchedVariant.stock_quantity) {
        const errorMsg = `The requested quantity (${qty}) exceeds the available stock (${matchedVariant.stock_quantity}).`;
        if (typeof window.showErrorModal === 'function') {
            window.showErrorModal(errorMsg);
        } else {
            alert(errorMsg);
        }
        return;
    }

    const cartItem = { 
        productId: product.id, 
        variantId: matchedVariant.id, 
        quantity: qty,
        attributes: window.selectedAttributes 
    };
    
    let cart = JSON.parse(localStorage.getItem('studio_cart') || '[]');
    cart.push(cartItem);
    localStorage.setItem('studio_cart', JSON.stringify(cart));

    closeVariantModal();

    if (window.activeModalActionType === 'cart') {
        if (typeof window.showSuccessModal === 'function') {
            window.showSuccessModal('Product successfully added to your cart!');
        } else {
            alert('Product successfully added to your cart!');
        }
    } else {
        window.location.href = '../Shop/Checkout.html';
    }
};

// Global preview image switcher with automatic variant selection and deselection
window.changePreviewImage = function(imgSrc, thumbElement) {
    window.currentPreviewImage = imgSrc; // Store clicked gallery image
    const mainImg = document.getElementById('mainPreviewImg');
    if (mainImg) mainImg.src = imgSrc;
    
    document.querySelectorAll('.thumb-img').forEach(el => el.classList.remove('active'));
    if (thumbElement) {
        thumbElement.classList.add('active');
    }

    const product = window.currentProduct;
    if (!product || !product.variants) return;

    const matchedVariant = product.variants.find(v => v.image === imgSrc);

    if (matchedVariant && matchedVariant.attributes && matchedVariant.attributes.length > 0) {
        window.selectedAttributes = {};
        matchedVariant.attributes.forEach(attr => {
            window.selectedAttributes[attr.attribute_name] = attr.value;
        });
    } else {
        window.selectedAttributes = {};
    }

    renderAllAttributeContainers();
};
