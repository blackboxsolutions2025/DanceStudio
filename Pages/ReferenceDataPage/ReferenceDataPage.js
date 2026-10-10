// Pages/ReferenceDataPage/ReferenceDataPage.js
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('userRole');

    if (!token || userRole !== 'admin') {
        alert('Access denied. Administrator privileges required.');
        window.location.href = '/landing';
        return;
    }

    // Tab switching logic
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');
        });
    });

    // Load Categories
    async function loadCategories() {
        try {
            const res = await secureFetch('/api/categories', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.status === 401 || res.status === 403) {
                window.location.href = '/login';
                return;
            }
            const data = await res.json();
            const tbody = document.getElementById('categoriesTableBody');
            if (data.length === 0) {
                tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-muted); padding: 20px;">No categories found.</td></tr>`;
                return;
            }
            tbody.innerHTML = data.map(c => `
                <tr>
                    <td>#${c.id}</td>
                    <td><strong>${c.name}</strong></td>
                    <td style="text-align: right;">
                        <button type="button" class="btn-secondary edit-category-btn" data-id="${c.id}" data-name="${c.name}" style="padding: 6px 12px; font-size: 0.8rem;">
                            <i class="fa-solid fa-pen"></i> Edit
                        </button>
                    </td>
                </tr>
            `).join('');

            attachCategoryEditHandlers();
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    }

    // Load Brands
    async function loadBrands() {
        try {
            const res = await secureFetch('/api/brands', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.status === 401 || res.status === 403) {
                window.location.href = '/login';
                return;
            }
            const data = await res.json();
            const tbody = document.getElementById('brandsTableBody');
            if (data.length === 0) {
                tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-muted); padding: 20px;">No brands found.</td></tr>`;
                return;
            }
            tbody.innerHTML = data.map(b => `
                <tr>
                    <td>#${b.id}</td>
                    <td><strong>${b.name}</strong></td>
                    <td style="text-align: right;">
                        <button type="button" class="btn-secondary edit-brand-btn" data-id="${b.id}" data-name="${b.name}" style="padding: 6px 12px; font-size: 0.8rem;">
                            <i class="fa-solid fa-pen"></i> Edit
                        </button>
                    </td>
                </tr>
            `).join('');

            attachBrandEditHandlers();
        } catch (error) {
            console.error('Error loading brands:', error);
        }
    }

    // Load Attributes
    async function loadAttributes() {
        try {
            const res = await secureFetch('/api/attributes', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.status === 401 || res.status === 403) {
                window.location.href = '/login';
                return;
            }
            const data = await res.json();
            const tbody = document.getElementById('attributesTableBody');
            if (data.length === 0) {
                tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-muted); padding: 20px;">No attributes found.</td></tr>`;
                return;
            }
            tbody.innerHTML = data.map(a => `
                <tr>
                    <td>#${a.id}</td>
                    <td><strong>${a.name}</strong></td>
                    <td style="text-align: right;">
                        <button type="button" class="btn-secondary edit-attribute-btn" data-id="${a.id}" data-name="${a.name}" style="padding: 6px 12px; font-size: 0.8rem;">
                            <i class="fa-solid fa-pen"></i> Edit
                        </button>
                    </td>
                </tr>
            `).join('');

            attachAttributeEditHandlers();
        } catch (error) {
            console.error('Error loading attributes:', error);
        }
    }

    // --- CATEGORY EDIT HANDLERS ---
    function attachCategoryEditHandlers() {
        document.querySelectorAll('.edit-category-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('editingCategoryId').value = btn.dataset.id;
                document.getElementById('categoryName').value = btn.dataset.name;
                document.getElementById('categoryFormTitle').innerText = 'Edit Category';
                document.getElementById('categorySubmitBtn').innerHTML = '<i class="fa-solid fa-check"></i> Update Category';
                document.getElementById('categoryCancelBtn').style.display = 'inline-flex';
            });
        });
    }

    document.getElementById('categoryCancelBtn').addEventListener('click', () => resetCategoryForm());

    function resetCategoryForm() {
        document.getElementById('editingCategoryId').value = '';
        document.getElementById('categoryName').value = '';
        document.getElementById('categoryFormTitle').innerText = 'Add Category';
        document.getElementById('categorySubmitBtn').innerHTML = '<i class="fa-solid fa-plus"></i> Add Category';
        document.getElementById('categoryCancelBtn').style.display = 'none';
    }

    // Category Form Submission (Handles both Add & Edit) 
    document.getElementById('categoryForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const editingId = document.getElementById('editingCategoryId').value;
        const name = document.getElementById('categoryName').value;
        const url = editingId ? `/api/categories/${editingId}` : '/api/categories';
        const method = editingId ? 'PUT' : 'POST';

        try {
            const res = await secureFetch(url, {
                method: method,
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ name })
            });
            const data = await res.json();
            if (!res.ok) {
                window.showErrorModal(data.message || 'Failed to save category.', 'Validation Warning'); 
                return;
            }
            resetCategoryForm();
            window.showSuccessModal(editingId ? 'Category updated successfully!' : 'Category added successfully!', 'Success!', () => {
                loadCategories();
            }); 
        } catch (error) {
            window.showErrorModal('An unexpected error occurred while saving the category.'); 
        }
    });

    // --- BRAND EDIT HANDLERS ---
    function attachBrandEditHandlers() {
        document.querySelectorAll('.edit-brand-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('editingBrandId').value = btn.dataset.id;
                document.getElementById('brandName').value = btn.dataset.name;
                document.getElementById('brandFormTitle').innerText = 'Edit Brand';
                document.getElementById('brandSubmitBtn').innerHTML = '<i class="fa-solid fa-check"></i> Update Brand';
                document.getElementById('brandCancelBtn').style.display = 'inline-flex';
            });
        });
    }

    document.getElementById('brandCancelBtn').addEventListener('click', () => resetBrandForm());

    function resetBrandForm() {
        document.getElementById('editingBrandId').value = '';
        document.getElementById('brandName').value = '';
        document.getElementById('brandFormTitle').innerText = 'Add Brand';
        document.getElementById('brandSubmitBtn').innerHTML = '<i class="fa-solid fa-plus"></i> Add Brand';
        document.getElementById('brandCancelBtn').style.display = 'none';
    }

    // Brand Form Submission (Handles both Add & Edit) 
    document.getElementById('brandForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const editingId = document.getElementById('editingBrandId').value;
        const name = document.getElementById('brandName').value;
        const url = editingId ? `/api/brands/${editingId}` : '/api/brands';
        const method = editingId ? 'PUT' : 'POST';

        try {
            const res = await secureFetch(url, {
                method: method,
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ name })
            });
            const data = await res.json();
            if (!res.ok) {
                window.showErrorModal(data.message || 'Failed to save brand.', 'Validation Warning'); 
                return;
            }
            resetBrandForm();
            window.showSuccessModal(editingId ? 'Brand updated successfully!' : 'Brand added successfully!', 'Success!', () => {
                loadBrands();
            }); 
        } catch (error) {
            window.showErrorModal('An unexpected error occurred while saving the brand.'); 
        }
    });

    // --- ATTRIBUTE EDIT HANDLERS ---
    function attachAttributeEditHandlers() {
        document.querySelectorAll('.edit-attribute-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('editingAttributeId').value = btn.dataset.id;
                document.getElementById('attributeName').value = btn.dataset.name;
                document.getElementById('attributeFormTitle').innerText = 'Edit Attribute Specification';
                document.getElementById('attributeSubmitBtn').innerHTML = '<i class="fa-solid fa-check"></i> Update Attribute';
                document.getElementById('attributeCancelBtn').style.display = 'inline-flex';
            });
        });
    }

    document.getElementById('attributeCancelBtn').addEventListener('click', () => resetAttributeForm());

    function resetAttributeForm() {
        document.getElementById('editingAttributeId').value = '';
        document.getElementById('attributeName').value = '';
        document.getElementById('attributeFormTitle').innerText = 'Add Attribute Specification';
        document.getElementById('attributeSubmitBtn').innerHTML = '<i class="fa-solid fa-plus"></i> Add Attribute';
        document.getElementById('attributeCancelBtn').style.display = 'none';
    }

    // Attribute Form Submission (Handles both Add & Edit) 
    document.getElementById('attributeForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const editingId = document.getElementById('editingAttributeId').value;
        const name = document.getElementById('attributeName').value;
        const url = editingId ? `/api/attributes/${editingId}` : '/api/attributes';
        const method = editingId ? 'PUT' : 'POST';

        try {
            const res = await secureFetch(url, {
                method: method,
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ name })
            });
            const data = await res.json();
            if (!res.ok) {
                window.showErrorModal(data.message || 'Failed to save attribute.', 'Validation Warning'); 
                return;
            }
            resetAttributeForm();
            window.showSuccessModal(editingId ? 'Attribute updated successfully!' : 'Attribute added successfully!', 'Success!', () => {
                loadAttributes();
            }); 
        } catch (error) {
            window.showErrorModal('An unexpected error occurred while saving the attribute.'); 
        }
    });

    // Initial loads
    loadCategories();
    loadBrands();
    loadAttributes();
});