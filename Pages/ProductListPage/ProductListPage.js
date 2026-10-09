document.addEventListener('DOMContentLoaded', async () => {
    // 1. Enforce Admin-Only Access Guard
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('userRole');

    if (!token || userRole !== 'admin') {
        alert('Access denied. Administrator privileges required.');
        window.location.href = '../LandingPage/LandingPage.html';
        return;
    }

    const productTableBody = document.getElementById('productTableBody');
    const searchInput = document.getElementById('searchInput');
    const addProductBtn = document.getElementById('addProductBtn');
    
    // Modal Elements
    const variantsModal = document.getElementById('variantsModal');
    const modalProductName = document.getElementById('modalProductName');
    const variantsTableBody = document.getElementById('variantsTableBody');
    const closeModalBtn = document.getElementById('closeModalBtn');

    let allProducts = [];

    // Navigate to Product Builder Page
    addProductBtn.addEventListener('click', () => {
        window.location.href = '../ProductBuilderPage/ProductBuilderPage.html';
    });

    // Fetch Products Catalog
    const loadInventory = async () => {
        try {
            const res = await fetch('/api/shop/products');
            allProducts = await res.json();
            renderTable(allProducts);
        } catch (err) {
            console.error('Failed to load inventory:', err);
            productTableBody.innerHTML = `<tr><td colspan="5" class="loading-text" style="color: #ef4444;">Failed to load inventory data.</td></tr>`;
        }
    };

    // Render Table Rows
    const renderTable = (products) => {
        productTableBody.innerHTML = '';
        if (products.length === 0) {
            productTableBody.innerHTML = `<tr><td colspan="5" class="loading-text">No products found in catalog.</td></tr>`;
            return;
        }

        products.forEach(p => {
            // Compute total stock across all variants
            const totalStock = p.variants ? p.variants.reduce((sum, v) => sum + (v.stock_quantity || 0), 0) : 0;
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${p.title}</strong></td>
                <td>${p.brand_name || '—'}</td>
                <td>${p.category_name || '—'}</td>
                <td><span style="color: ${totalStock > 0 ? 'var(--accent-green)' : '#ef4444'}; font-weight: bold;">${totalStock} units</span></td>
                <td>
                    <div class="action-buttons-group">
                        <button class="action-btn view-variants-btn" data-id="${p.id}" title="View Variants">
                            <i class="fa-solid fa-eye"></i> <span>(${p.variants ? p.variants.length : 0})</span>
                        </button>
                        <button class="action-btn edit-product-btn" data-id="${p.id}" title="Edit Product">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                    </div>
                </td>
            `;

            // Attach event to open variants modal
            tr.querySelector('.view-variants-btn').addEventListener('click', () => {
                openVariantsModal(p);
            });

            // Attach event listener to redirect to ProductBuilderPage with ID
            tr.querySelector('.edit-product-btn').addEventListener('click', () => {
                window.location.href = `../ProductBuilderPage/ProductBuilderPage.html?id=${p.id}`;
            });

            productTableBody.appendChild(tr);
        });
    };

    // Open Variants Modal
    const openVariantsModal = (product) => {
        modalProductName.textContent = `${product.title} - Variants`;
        variantsTableBody.innerHTML = '';

        if (!product.variants || product.variants.length === 0) {
            variantsTableBody.innerHTML = `<tr><td colspan="4" class="loading-text">No variants configured for this product.</td></tr>`;
        } else {
            product.variants.forEach(v => {
                // Map dynamic attributes from variant_values (e.g. Size: Large, Color: Black)
                const specs = v.attributes && v.attributes.length > 0 
                    ? v.attributes.map(attr => `${attr.attribute_name}: ${attr.value}`).join(' | ') 
                    : 'Standard';

                const priceDisplay = v.price_override !== null && v.price_override !== undefined 
                    ? `₱${Number(v.price_override).toFixed(2)}` 
                    : `₱${Number(product.base_price).toFixed(2)} (Base)`;

                const vTr = document.createElement('tr');
                vTr.innerHTML = `
                    <td><code>${v.sku}</code></td>
                    <td>${specs}</td>
                    <td>${priceDisplay}</td>
                    <td><strong>${v.stock_quantity}</strong></td>
                `;
                variantsTableBody.appendChild(vTr);
            });
        }

        variantsModal.classList.add('active');
    };

    // Close Modal Events
    closeModalBtn.addEventListener('click', () => variantsModal.classList.remove('active'));
    variantsModal.addEventListener('click', (e) => {
        if (e.target === variantsModal) variantsModal.classList.remove('active');
    });

    // Search Filtering
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const filtered = allProducts.filter(p => 
            p.title.toLowerCase().includes(query) || 
            (p.brand_name && p.brand_name.toLowerCase().includes(query)) ||
            (p.category_name && p.category_name.toLowerCase().includes(query))
        );
        renderTable(filtered);
    });

    loadInventory();
});