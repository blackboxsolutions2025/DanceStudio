document.addEventListener('DOMContentLoaded', async () => {
    // 1. Strict Database Role Verification via HttpOnly Cookies BEFORE Loading Any Data
    try {
        const profileRes = await secureFetch('/api/user/profile', {
            credentials: 'include' // <--- Sends the secure cookie automatically[cite: 52]
        });

        if (!profileRes.ok) {
            throw new Error('Failed to verify session.');
        }

        const userData = await profileRes.json();

        if (userData.role !== 'admin') {
            await handleUnauthorized('Access denied. Administrator privileges required to access Product Builder.');
            return;
        }

        // Admin verification passed successfully. Proceed to initialize page data.
        initProductBuilder();

    } catch (err) {
        console.error('Security Check Error:', err);
        await handleUnauthorized('Session validation failed. Please log in again.');
    }
});

// Helper function to handle unauthorized access securely
async function handleUnauthorized(message) {
    if (typeof window.showErrorModal === 'function') {
        await window.showErrorModal(message, 'Access Restricted');
    } else {
        alert(message);
    }
    window.location.href = '../LandingPage/LandingPage.html';
}

function initProductBuilder() {
    const categorySelect = document.getElementById('categoryId');
    const brandSelect = document.getElementById('brandId');
    const productNameInput = document.getElementById('productName');
    const basePriceInput = document.getElementById('basePrice');
    const variantsContainer = document.getElementById('variantsContainer');
    const addVariantBtn = document.getElementById('addVariantBtn');
    const productForm = document.getElementById('productForm');
    const formError = document.getElementById('formError');

    const urlParams = new URLSearchParams(window.location.search);
    const editProductId = urlParams.get('id');

    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingText = document.getElementById('loadingText');
    const saveProductBtn = document.getElementById('saveProductBtn');

    let globalAttributes = [];
    let existingGalleryImages = []; // Tracks gallery images when editing
    let newGalleryFiles = [];

    const triggerGalleryBtn = document.getElementById('triggerGalleryBtn');
    const productGalleryInput = document.getElementById('productGallery');
    const galleryManagerContainer = document.getElementById('galleryManagerContainer');

    triggerGalleryBtn.addEventListener('click', () => productGalleryInput.click());

    if (editProductId) {
        document.querySelector('.page-title h1').textContent = 'Edit Product';
        document.querySelector('.page-title p').textContent = 'Update product details, physical variants, and attribute specifications.';
        document.getElementById('saveProductBtn').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Update Product';
    }

    async function loadMetadata() {
        try {
            const [catRes, brandRes, attrRes] = await Promise.all([
                secureFetch('/api/categories', { credentials: 'include' }),
                secureFetch('/api/brands', { credentials: 'include' }),
                secureFetch('/api/attributes', { credentials: 'include' })
            ]);

            if (catRes.status === 401 || brandRes.status === 401 || attrRes.status === 401) {
                localStorage.clear();
                window.location.href = '../LoginPage/LoginPage.html';
                return;
            }

            const categories = await catRes.json();
            const brands = await brandRes.json();
            globalAttributes = await attrRes.json();

            categories.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = c.name;
                categorySelect.appendChild(opt);
            });

            brands.forEach(b => {
                const opt = document.createElement('option');
                opt.value = b.id;
                opt.textContent = b.name;
                brandSelect.appendChild(opt);
            });
        } catch (error) {
            console.error('Error loading metadata:', error);
        }
    }

    function addVariantRowFromExisting(variantData) {
        const presetAttrIds = [];
        if (variantData.attributes && variantData.attributes.length > 0) {
            variantData.attributes.forEach(attr => {
                const matchingAttrObj = globalAttributes.find(ga => ga.name === attr.attribute_name);
                if (matchingAttrObj) presetAttrIds.push(matchingAttrObj.id);
            });
        }

        addVariantRow(presetAttrIds, variantData.image);
        const variantBox = variantsContainer.lastElementChild;
        
        variantBox.querySelector('.variant-sku').value = variantData.sku || '';
        variantBox.querySelector('.variant-sku').dataset.manual = 'true';
        variantBox.querySelector('.variant-stock').value = variantData.stock_quantity ?? 10;
        variantBox.querySelector('.variant-override').value = variantData.price_override ?? '';

        if (variantData.attributes && variantData.attributes.length > 0) {
            const attrRows = variantBox.querySelectorAll('.attributes-list .attribute-row');
            variantData.attributes.forEach((attr, idx) => {
                if (attrRows[idx]) {
                    attrRows[idx].querySelector('.attr-value').value = attr.value || '';
                }
            });
        }
    }

    async function initPage() {
        await loadMetadata();

        if (editProductId) {
            try {
                const res = await secureFetch(`/api/shop/products/${editProductId}`, {
                    credentials: 'include'
                });
                
                if (!res.ok) throw new Error('Failed to fetch product details.');
                const product = await res.json();

                if (product) {
                    productNameInput.value = product.title || '';
                    categorySelect.value = product.category_id || '';
                    brandSelect.value = product.brand_id || '';
                    basePriceInput.value = product.base_price || '';
                    document.getElementById('description').value = product.description || '';

                    const mainImageInput = document.getElementById('productImage');
                    const mainImageContainer = document.getElementById('mainImagePreviewContainer');
                    mainImageInput.removeAttribute('required');

                    if (product.main_image) {
                        mainImageContainer.innerHTML = `
                            <div style="position: relative; width: 70px; height: 70px; border-radius: 8px; overflow: hidden; border: 1px solid var(--border-color);">
                                <img src="${product.main_image}" style="width: 100%; height: 100%; object-fit: cover;">
                            </div>
                            <div>
                                <span style="font-size: 0.85rem; color: var(--accent-green); display: block; margin-bottom: 4px;"><i class="fa-solid fa-check"></i> Current Main Image</span>
                                <button type="button" class="btn-secondary" id="changeMainImgBtn" style="padding: 4px 10px; font-size: 0.8rem;"><i class="fa-solid fa-pen"></i> Change Image</button>
                            </div>
                        `;
                        mainImageInput.style.display = 'none';
                        document.getElementById('changeMainImgBtn').addEventListener('click', () => {
                            mainImageContainer.style.display = 'none';
                            mainImageInput.style.display = 'block';
                        });
                    }

                    if (product.gallery_images && product.gallery_images.length > 0) {
                        existingGalleryImages = [...product.gallery_images];
                        renderGalleryPreviews();
                    }

                    variantsContainer.innerHTML = '';
                    if (product.variants && product.variants.length > 0) {
                        product.variants.forEach(v => addVariantRowFromExisting(v));
                    } else {
                        addVariantRow();
                    }
                }
            } catch (err) {
                console.error('Failed to load product for editing:', err);
            }
        } else {
            addVariantRow();
        }
    }

    initPage();

    function cleanToken(str, maxLen) {
        if (!str) return '';
        return str.replace(/[^a-zA-Z0-9]/g, '').substring(0, maxLen).toUpperCase();
    }

    function updateVariantSku(variantBox) {
        const skuInput = variantBox.querySelector('.variant-sku');
        if (skuInput.dataset.manual === 'true') return;

        const brandText = brandSelect.selectedIndex > 0 ? brandSelect.options[brandSelect.selectedIndex].textContent : '';
        const productName = productNameInput.value.trim();
        const brandCode = cleanToken(brandText, 3);
        const productCode = cleanToken(productName, 4);

        let parts = [brandCode, productCode].filter(Boolean);
        variantBox.querySelectorAll('.attr-value').forEach(input => {
            const val = input.value.trim();
            if (val) parts.push(cleanToken(val, 5));
        });

        skuInput.value = parts.length > 0 ? parts.join('-') : '';
    }

    function updateAllSkus() {
        variantsContainer.querySelectorAll('.variant-box').forEach(box => updateVariantSku(box));
    }

    productNameInput.addEventListener('input', updateAllSkus);
    brandSelect.addEventListener('change', updateAllSkus);

    function getTemplateAttributes() {
        const firstVariant = variantsContainer.querySelector('.variant-box');
        if (!firstVariant) return [];
        const attrs = [];
        firstVariant.querySelectorAll('.attribute-row').forEach(row => {
            attrs.push(row.querySelector('.attr-id').value);
        });
        return attrs;
    }

    function addSpecToAllVariants(attributeId = '') {
        variantsContainer.querySelectorAll('.variant-box').forEach(box => {
            addAttrRow(box.querySelector('.attributes-list'), box, attributeId);
        });
    }

    function addVariantRow(presetAttrIds = [], existingImageUrl = null) {
        const variantIndex = variantsContainer.children.length + 1;
        const variantBox = document.createElement('div');
        variantBox.className = 'variant-box';
        variantBox.innerHTML = `
            <div class="variant-header">
                <span>Variant #${variantIndex}</span>
                <button type="button" class="remove-variant-btn" title="Remove Variant"><i class="fa-solid fa-trash"></i></button>
            </div>
            <div class="variant-fields">
                <div class="input-group">
                    <label>SKU / Barcode * <small style="color:var(--accent-green); font-weight:normal;">(Auto-generated)</small></label>
                    <input type="text" class="variant-sku" required placeholder="e.g., RHY-HOOD-BLK-L">
                </div>
                <div class="input-group">
                    <label>Stock Quantity *</label>
                    <input type="number" class="variant-stock" value="10" min="0" required>
                </div>
                <div class="input-group">
                    <label>Price Override (₱) <small>(Optional)</small></label>
                    <div class="price-input-wrapper">
                        <input type="number" step="0.01" class="variant-override" placeholder="Defaults to base price">
                        <div class="price-suggestions-dropdown"></div>
                    </div>
                </div>
                <div class="input-group variant-image-container">
                    <label>Variant Image <small>(Optional)</small></label>
                    <div class="variant-img-preview" style="margin-bottom: 4px;"></div>
                    <button type="button" class="btn-secondary variant-upload-trigger" style="padding: 6px 12px; font-size: 0.85rem; width: fit-content;">
                        <i class="fa-solid fa-upload"></i> Choose Image
                    </button>
                    <input type="file" class="variant-image-input" accept="image/*" style="display: none;">
                </div>
            </div>
            <div class="attributes-section">
                <div class="attributes-header">
                    <span>Variant Specifications (e.g. Size, Color)</span>
                    <button type="button" class="btn-secondary add-attr-btn" style="padding: 4px 10px; font-size: 0.8rem;"><i class="fa-solid fa-plus"></i> Add Spec</button>
                </div>
                <div class="attributes-list"></div>
            </div>
        `;

        const skuInput = variantBox.querySelector('.variant-sku');
        skuInput.addEventListener('input', () => { skuInput.dataset.manual = 'true'; });

        variantBox.querySelector('.remove-variant-btn').addEventListener('click', async () => {
            if (variantsContainer.children.length > 1) {
                variantBox.remove();
                updateAllSkus();
            } else {
                alert('A product must have at least one variant.');
            }
        });

        variantBox.querySelector('.add-attr-btn').addEventListener('click', () => addSpecToAllVariants(''));
        variantsContainer.appendChild(variantBox);

        if (presetAttrIds && presetAttrIds.length > 0) {
            presetAttrIds.forEach(attrId => addAttrRow(variantBox.querySelector('.attributes-list'), variantBox, attrId));
        }

        setupVariantImageHandling(variantBox, existingImageUrl);
        updateVariantSku(variantBox);
    }

    function addAttrRow(container, variantBox, selectedAttrId = '') {
        const row = document.createElement('div');
        row.className = 'attribute-row';
        let attrOptions = globalAttributes.map(a => `<option value="${a.id}" ${a.id == selectedAttrId ? 'selected' : ''}>${a.name}</option>`).join('');

        row.innerHTML = `
            <select class="attr-id" required><option value="">Select Attribute...</option>${attrOptions}</select>
            <input type="text" class="attr-value" required placeholder="Value (e.g. Large, Black)">
            <button type="button" class="btn-icon-danger remove-attr-btn" title="Remove Attribute"><i class="fa-solid fa-x"></i></button>
        `;

        row.querySelector('.attr-id').addEventListener('change', () => updateVariantSku(variantBox));
        row.querySelector('.attr-value').addEventListener('input', () => updateVariantSku(variantBox));
        row.querySelector('.remove-attr-btn').addEventListener('click', () => row.remove());

        container.appendChild(row);
    }

    addVariantBtn.addEventListener('click', () => addVariantRow(getTemplateAttributes()));

    // Product Form Submission
    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (saveProductBtn.disabled) return;

        formError.textContent = '';
        showLoading(editProductId ? 'Updating product details and images...' : 'Saving new product and uploading files...');

        const formData = new FormData();
        formData.append('title', productNameInput.value.trim());
        formData.append('category_id', categorySelect.value);
        formData.append('brand_id', brandSelect.value);
        formData.append('base_price', basePriceInput.value);
        formData.append('description', document.getElementById('description').value.trim());

        const imageFile = document.getElementById('productImage').files[0];
        if (imageFile) formData.append('productImage', imageFile);

        const galleryMeta = [];
        existingGalleryImages.forEach(url => galleryMeta.push({ type: 'existing', url }));

        newGalleryFiles.forEach(file => {
            galleryMeta.push({ type: 'new' });
            formData.append('productGallery', file);
        });
        formData.append('galleryMeta', JSON.stringify(galleryMeta));

        const variantBoxes = variantsContainer.querySelectorAll('.variant-box');
        const variants = [];

        for (let i = 0; i < variantBoxes.length; i++) {
            const box = variantBoxes[i];
            const sku = box.querySelector('.variant-sku').value.trim();
            const stock_quantity = parseInt(box.querySelector('.variant-stock').value) || 0;
            const priceOverrideVal = box.querySelector('.variant-override').value;
            const price_override = priceOverrideVal !== '' ? parseFloat(priceOverrideVal) : null;
            const existingImage = box.dataset.existingImage || null;
            const variantFile = box._getVariantFile ? box._getVariantFile() : null;

            if (variantFile) {
                formData.append(`variantImage_${i}`, variantFile);
            }

            const attributes = [];
            box.querySelectorAll('.attribute-row').forEach(r => {
                const attributeId = r.querySelector('.attr-id').value;
                const value = r.querySelector('.attr-value').value.trim();
                if (attributeId && value) attributes.push({ attributeId, value });
            });

            variants.push({ sku, stock_quantity, price_override, existingImage, attributes });
        }

        formData.append('variants', JSON.stringify(variants));

        const endpoint = editProductId ? `/api/shop/products/${editProductId}` : '/api/shop/products';
        const method = editProductId ? 'PUT' : 'POST';

        try {
            const response = await secureFetch(endpoint, {
                method: method,
                credentials: 'include',
                body: formData
            });

            const result = await response.json();
            hideLoading();

            if (response.ok) {
                if (typeof window.showSuccessModal === 'function') {
                    window.showSuccessModal(result.message || 'Product successfully saved!', 'Success!', () => {
                        window.location.href = '../ProductListPage/ProductListPage.html';
                    });
                } else {
                    alert(result.message);
                    window.location.href = '../ProductListPage/ProductListPage.html';
                }
            } else {
                formError.textContent = result.message || 'Failed to save product.';
            }
        } catch (error) {
            console.error('Submission error:', error);
            hideLoading();
            formError.textContent = 'Server connection error.';
        }
    });

    productGalleryInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        files.forEach(file => newGalleryFiles.push(file));
        renderGalleryPreviews();
        productGalleryInput.value = '';
    });

    function renderGalleryPreviews() {
        galleryManagerContainer.innerHTML = '';

        existingGalleryImages.forEach((url, idx) => {
            const thumb = document.createElement('div');
            thumb.style.cssText = 'position: relative; width: 70px; height: 70px; border-radius: 8px; overflow: hidden; border: 1px solid var(--border-color);';
            thumb.innerHTML = `
                <img src="${url}" style="width: 100%; height: 100%; object-fit: cover;">
                <button type="button" class="remove-existing-gallery" data-index="${idx}" style="position: absolute; top: 2px; right: 2px; background: rgba(0,0,0,0.8); color: #ef4444; border: none; border-radius: 50%; width: 22px; height: 22px; cursor: pointer; font-size: 0.75rem;"><i class="fa-solid fa-xmark"></i></button>
            `;
            thumb.querySelector('.remove-existing-gallery').addEventListener('click', () => {
                existingGalleryImages.splice(idx, 1);
                renderGalleryPreviews();
            });
            galleryManagerContainer.appendChild(thumb);
        });

        newGalleryFiles.forEach((file, idx) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const thumb = document.createElement('div');
                thumb.style.cssText = 'position: relative; width: 70px; height: 70px; border-radius: 8px; overflow: hidden; border: 1px solid var(--accent-green);';
                thumb.innerHTML = `
                    <img src="${e.target.result}" style="width: 100%; height: 100%; object-fit: cover;">
                    <button type="button" class="remove-new-gallery" data-index="${idx}" style="position: absolute; top: 2px; right: 2px; background: rgba(0,0,0,0.8); color: #ef4444; border: none; border-radius: 50%; width: 22px; height: 22px; cursor: pointer; font-size: 0.75rem;"><i class="fa-solid fa-xmark"></i></button>
                `;
                thumb.querySelector('.remove-new-gallery').addEventListener('click', () => {
                    newGalleryFiles.splice(idx, 1);
                    renderGalleryPreviews();
                });
                galleryManagerContainer.appendChild(thumb);
            };
            reader.readAsDataURL(file);
        });
    }

    function setupVariantImageHandling(variantBox, existingImageUrl = null) {
        const uploadTrigger = variantBox.querySelector('.variant-upload-trigger');
        const fileInput = variantBox.querySelector('.variant-image-input');
        const previewContainer = variantBox.querySelector('.variant-img-preview');

        let currentFile = null;
        let activeExistingImage = existingImageUrl;
        if (existingImageUrl) {
            variantBox.dataset.existingImage = existingImageUrl;
        }

        function updateVariantPreview() {
            previewContainer.innerHTML = '';
            if (currentFile) {
                previewContainer.innerHTML = `
                    <span style="font-size: 0.85rem; color: var(--accent-green); display: inline-flex; align-items: center; gap: 6px;">
                        <i class="fa-solid fa-file-image"></i> ${currentFile.name} (New)
                    </span>
                `;
                uploadTrigger.innerHTML = '<i class="fa-solid fa-pen"></i> Change Image';
            } else if (activeExistingImage) {
                previewContainer.innerHTML = `
                    <div style="position: relative; width: 60px; height: 60px; border-radius: 6px; overflow: hidden; border: 1px solid var(--border-color); display: inline-block; margin-bottom: 4px;">
                        <img src="${activeExistingImage}" style="width: 100%; height: 100%; object-fit: cover;">
                    </div>
                    <div>
                        <a href="${activeExistingImage}" target="_blank" style="font-size: 0.85rem; color: var(--accent-green); text-decoration: underline;">
                            <i class="fa-solid fa-external-link-alt"></i> View Full Image
                        </a>
                    </div>
                `;
                uploadTrigger.innerHTML = '<i class="fa-solid fa-pen"></i> Change Image';
            } else {
                previewContainer.innerHTML = '';
                uploadTrigger.innerHTML = '<i class="fa-solid fa-upload"></i> Choose Image';
            }
        }

        uploadTrigger.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                currentFile = e.target.files[0];
                activeExistingImage = null; 
                variantBox.dataset.existingImage = '';
                updateVariantPreview();
            }
        });

        variantBox._getVariantFile = () => currentFile;
        updateVariantPreview();
    }

    function showLoading(message) {
        if (loadingText) loadingText.textContent = message || 'Processing product data...';
        if (loadingOverlay) loadingOverlay.classList.add('active');
        if (saveProductBtn) saveProductBtn.disabled = true;
    }

    function hideLoading() {
        if (loadingOverlay) loadingOverlay.classList.remove('active');
        if (saveProductBtn) saveProductBtn.disabled = false;
    }
}