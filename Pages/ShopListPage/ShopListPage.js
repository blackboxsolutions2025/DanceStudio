document.addEventListener('DOMContentLoaded', async () => {
    const productGrid = document.getElementById('productGrid');
    const noProductsMessage = document.getElementById('noProductsMessage');

    // Filter Modal Elements
    const openFilterModal = document.getElementById('openFilterModal');
    const closeFilterModal = document.getElementById('closeFilterModal');
    const filterModal = document.getElementById('filterModal');
    const applyModalFilters = document.getElementById('applyModalFilters');
    const resetModalFilters = document.getElementById('resetModalFilters');
    const activeFiltersBadge = document.getElementById('activeFiltersBadge');

    const summaryCategory = document.getElementById('summaryCategory');
    const summaryBrand = document.getElementById('summaryBrand');
    const summarySort = document.getElementById('summarySort');

    const filterCategory = document.getElementById('filterCategory');
    const filterBrand = document.getElementById('filterBrand');
    const filterSort = document.getElementById('filterSort');

    let allProducts = [];

    // --- Modal Open/Close Event Listeners ---
    if (openFilterModal) openFilterModal.addEventListener('click', () => filterModal.style.display = 'flex');
    if (closeFilterModal) closeFilterModal.addEventListener('click', () => filterModal.style.display = 'none');
    window.addEventListener('click', (e) => { if (e.target === filterModal) filterModal.style.display = 'none'; });

    // --- Load Filter Options (Categories, Brands) using secureFetch ---
    async function loadFilterOptions() {
        try {
            const [catRes, brandRes] = await Promise.all([
                secureFetch('/api/categories'),
                secureFetch('/api/brands')
            ]);

            if (catRes.ok && filterCategory) {
                const categories = await catRes.json();
                categories.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c.id;
                    opt.textContent = c.name;
                    filterCategory.appendChild(opt);
                });
            }

            if (brandRes.ok && filterBrand) {
                const brands = await brandRes.json();
                brands.forEach(b => {
                    const opt = document.createElement('option');
                    opt.value = b.id;
                    opt.textContent = b.name;
                    filterBrand.appendChild(opt);
                });
            }
        } catch (err) {
            console.warn('Could not load dynamic filter options:', err);
        }
    }

    // --- Fetch Products Catalog using secureFetch ---
    async function fetchProducts() {
        try {
            const response = await secureFetch('/api/shop/products');
            if (!response.ok) throw new Error('Failed to fetch products.');

            allProducts = await response.json();
            applyFilters();
        } catch (err) {
            console.error('Error loading products:', err);
            if (productGrid) {
                productGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #ef4444; padding: 40px;">Error loading shop products. Please try again later.</p>';
            }
        }
    }

    // --- Apply Filters and Sorting ---
    function applyFilters() {
        const selectedCategory = filterCategory ? filterCategory.value : '';
        const selectedBrand = filterBrand ? filterBrand.value : '';
        const selectedSort = filterSort ? filterSort.value : 'newest';

        const categoryLabel = filterCategory && selectedCategory ? filterCategory.options[filterCategory.selectedIndex].text : "All Categories";
        const brandLabel = filterBrand && selectedBrand ? filterBrand.options[filterBrand.selectedIndex].text : "All Brands";
        
        let sortLabel = "Newest First";
        if (selectedSort === 'price-asc') sortLabel = "Price: Low to High";
        else if (selectedSort === 'price-desc') sortLabel = "Price: High to Low";
        else if (selectedSort === 'name-asc') sortLabel = "Name: A to Z";

        // Update Summary Display
        if (summaryCategory) summaryCategory.textContent = categoryLabel;
        if (summaryBrand) summaryBrand.textContent = brandLabel;
        if (summarySort) summarySort.textContent = sortLabel;

        const isDefault = (!selectedCategory && !selectedBrand && selectedSort === 'newest');
        if (activeFiltersBadge) activeFiltersBadge.style.display = isDefault ? 'none' : 'inline-block';

        // Filter Products
        let filtered = allProducts.filter(product => {
            const matchCategory = !selectedCategory || String(product.category_id) === String(selectedCategory);
            const matchBrand = !selectedBrand || String(product.brand_id) === String(selectedBrand);
            return matchCategory && matchBrand;
        });

        // Sort Products
        filtered.sort((a, b) => {
            if (selectedSort === 'price-asc') {
                return Number(a.base_price) - Number(b.base_price);
            } else if (selectedSort === 'price-desc') {
                return Number(b.base_price) - Number(a.base_price);
            } else if (selectedSort === 'name-asc') {
                return a.title.localeCompare(b.title);
            } else {
                return new Date(b.created_at || 0) - new Date(a.created_at || 0);
            }
        });

        renderProducts(filtered);
        if (filterModal) filterModal.style.display = 'none';
    }

    if (applyModalFilters) applyModalFilters.addEventListener('click', applyFilters);

    if (resetModalFilters) {
        resetModalFilters.addEventListener('click', () => {
            if (filterCategory) filterCategory.value = '';
            if (filterBrand) filterBrand.value = '';
            if (filterSort) filterSort.value = 'newest';
            applyFilters();
        });
    }

    // --- Render Products to Grid ---
    function renderProducts(productsToRender) {
        if (!productGrid) return;

        if (productsToRender.length === 0) {
            productGrid.innerHTML = '';
            if (noProductsMessage) noProductsMessage.style.display = 'block';
            return;
        }

        if (noProductsMessage) noProductsMessage.style.display = 'none';

        productGrid.innerHTML = productsToRender.map(product => {
            const mainImg = product.main_image || 'https://via.placeholder.com/300?text=No+Image';
            const price = product.base_price ? Number(product.base_price).toFixed(2) : '0.00';

            return `
                <div class="product-card">
                    <div class="product-img-wrapper" onclick="window.location.href='../ShopItemInfoPage/ShopItemInfoPage.html?id=${product.id}'">
                        <img src="${mainImg}" alt="${product.title}">
                    </div>
                    <div class="product-info">
                        <h3 class="product-title" title="${product.title}">${product.title}</h3>
                        <div class="product-footer">
                            <span class="product-price">₱${price}</span>
                            <span class="product-sold">In Stock</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    loadFilterOptions();
    fetchProducts();
});