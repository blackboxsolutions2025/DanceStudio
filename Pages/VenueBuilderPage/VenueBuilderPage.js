let galleryItems = []; // Array of { id: null, file: null, url: null }

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('userRole');

    if (!token || userRole !== 'admin') {
        alert('Access denied. Administrator privileges required.');
        window.location.href = '../LoginPage/LoginPage.html';
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const venueId = urlParams.get('id');

    const pageTitle = document.getElementById('pageTitle');
    const mainHeading = document.getElementById('mainHeading');
    const subHeading = document.getElementById('subHeading');
    const submitBtn = document.getElementById('submitBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const venueForm = document.getElementById('venueForm');
    
    const venueNameInput = document.getElementById('venueName');
    const venueLocationInput = document.getElementById('venueLocation');
    const venueLocationLinkInput = document.getElementById('venueLocationLink');
    const venueHourlyRateInput = document.getElementById('venueHourlyRate'); // <-- Defined here
    const venueImageFileInput = document.getElementById('venueImageFile');
    const mainImageFileName = document.getElementById('mainImageFileName');
    const currentImagePreview = document.getElementById('currentImagePreview');
    const previewImg = document.getElementById('previewImg');

    if (venueId) {
        pageTitle.textContent = 'Edit Venue - Rhythm & Soul';
        mainHeading.textContent = 'Edit Venue';
        subHeading.textContent = 'Update studio room, location, map details, and image sequence.';
        submitBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Update Venue';

        try {
            const res = await fetch(`/api/venues/${venueId}`);
            if (!res.ok) throw new Error('Failed to load venue details.');
            const venue = await res.json();

            venueNameInput.value = venue.name || '';
            venueLocationInput.value = venue.location || '';
            venueLocationLinkInput.value = venue.location_link || '';
            venueHourlyRateInput.value = venue.hourly_rate || '1500.00'; // <-- Populated here correctly

            if (venue.image) {
                previewImg.src = venue.image;
                currentImagePreview.style.display = 'block';
                const fileName = venue.image.split('/').pop();
                if (mainImageFileName) {
                    mainImageFileName.textContent = fileName;
                    mainImageFileName.style.color = '#34d399';
                    mainImageFileName.title = fileName;
                }
            }

            if (venue.gallery_images && Array.isArray(venue.gallery_images)) {
                galleryItems = venue.gallery_images.map(img => ({
                    id: img.id,
                    file: null,
                    url: img.image_path
                }));
            }
            renderGallery();
        } catch (err) {
            console.error('Error fetching venue for edit:', err);
            if (typeof window.showErrorModal === 'function') {
                await window.showErrorModal('Failed to load venue details.', 'Error');
            } else {
                alert('Failed to load venue details.');
            }
        }
    } else {
        renderGallery();
    }

    venueForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Show loading spinner animation and disable buttons
        submitBtn.disabled = true;
        if (cancelBtn) cancelBtn.disabled = true;
        const originalBtnHTML = submitBtn.innerHTML;
        submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saving Venue...`;

        const formData = new FormData();
        formData.append('name', venueNameInput.value.trim());
        formData.append('location', venueLocationInput.value.trim());
        formData.append('location_link', venueLocationLinkInput.value.trim());
        formData.append('hourly_rate', venueHourlyRateInput.value.trim());

        if (venueImageFileInput.files[0]) {
            formData.append('venueImage', venueImageFileInput.files[0]);
        }

        const galleryMeta = [];
        galleryItems.forEach((item) => {
            if (item.file) {
                galleryMeta.push({ type: 'new' });
                formData.append('galleryFiles', item.file);
            } else if (item.url) {
                galleryMeta.push({ type: 'existing', url: item.url });
            }
        });
        formData.append('galleryMeta', JSON.stringify(galleryMeta));

        try {
            const url = venueId ? `/api/admin/venues/${venueId}` : '/api/admin/venues';
            const method = venueId ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method: method,
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to save venue.');

            if (typeof window.showSuccessModal === 'function') {
                await window.showSuccessModal(data.message || 'Venue successfully saved!', 'Success');
            } else {
                alert(data.message || 'Venue successfully saved!');
            }

            window.location.href = '../VenueListPage/VenueListPage.html';
        } catch (err) {
            console.error('Save Venue Error:', err);
            if (typeof window.showErrorModal === 'function') {
                await window.showErrorModal(err.message, 'Error');
            } else {
                alert(err.message);
            }
            // Restore button state on error
            submitBtn.disabled = false;
            if (cancelBtn) cancelBtn.disabled = false;
            submitBtn.innerHTML = originalBtnHTML;
        }
    });
});

window.handleMainImageChange = function(event) {
    const file = event.target.files[0];
    const previewImg = document.getElementById('previewImg');
    const currentImagePreview = document.getElementById('currentImagePreview');
    const mainImageFileName = document.getElementById('mainImageFileName');

    if (file) {
        previewImg.src = URL.createObjectURL(file);
        currentImagePreview.style.display = 'block';
        if (mainImageFileName) {
            mainImageFileName.textContent = file.name;
            mainImageFileName.style.color = '#34d399';
            mainImageFileName.title = file.name;
        }
    }
};

window.renderGallery = function() {
    const container = document.getElementById('galleryRowsContainer');
    if (!container) return;

    if (galleryItems.length === 0) {
        container.innerHTML = `<p style="color: #64748b; font-style: italic; font-size: 0.9rem; margin: 5px 0;">No gallery images added yet. Click below to add one.</p>`;
        return;
    }

    container.innerHTML = galleryItems.map((item, index) => {
        let previewSrc = item.url || `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='50' height='50' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'><rect x='3' y='3' width='18' height='18' rx='2' ry='2'/><circle cx='8.5' cy='8.5' r='1.5'/><polyline points='21 15 16 10 5 21'/></svg>`;
        
        if (item.file) {
            previewSrc = URL.createObjectURL(item.file);
        }

        let displayFileName = 'No file chosen';
        let fileTextColor = '#94a3b8';
        if (item.file) {
            displayFileName = item.file.name;
            fileTextColor = '#34d399';
        } else if (item.url) {
            displayFileName = item.url.split('/').pop();
            fileTextColor = '#34d399';
        }

        return `
            <div class="gallery-row" data-index="${index}">
                <img src="${previewSrc}" alt="Gallery Preview" class="gallery-thumb">
                <div class="gallery-input-wrapper">
                    <div style="display: flex; align-items: center; gap: 12px; width: 100%;">
                        <label style="background: rgba(16, 185, 129, 0.15); color: #34d399; padding: 8px 14px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 0.85rem; border: 1px solid rgba(16, 185, 129, 0.3); display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0; transition: all 0.2s;">
                            <i class="fa-solid fa-folder-open"></i> Choose File
                            <input type="file" accept="image/*" onchange="handleGalleryFileChange(event, ${index})" style="display: none;">
                        </label>
                        <span style="color: ${fileTextColor}; font-size: 0.9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${displayFileName}">${displayFileName}</span>
                    </div>
                </div>
                <div class="gallery-actions">
                    <button type="button" class="btn-action btn-move" onclick="moveGalleryItem(${index}, -1)" ${index === 0 ? 'disabled' : ''} title="Move Up">
                        <i class="fa-solid fa-arrow-up"></i>
                    </button>
                    <button type="button" class="btn-action btn-move" onclick="moveGalleryItem(${index}, 1)" ${index === galleryItems.length - 1 ? 'disabled' : ''} title="Move Down">
                        <i class="fa-solid fa-arrow-down"></i>
                    </button>
                    <button type="button" class="btn-action btn-remove" onclick="removeGalleryItem(${index})" title="Remove">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
};

window.addGalleryRow = function() {
    galleryItems.push({ id: null, file: null, url: null });
    renderGallery();
};

window.removeGalleryItem = function(index) {
    galleryItems.splice(index, 1);
    renderGallery();
};

window.moveGalleryItem = function(index, direction) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= galleryItems.length) return;
    const temp = galleryItems[index];
    galleryItems[index] = galleryItems[newIndex];
    galleryItems[newIndex] = temp;
    renderGallery();
};

window.handleGalleryFileChange = function(event, index) {
    const file = event.target.files[0];
    if (file) {
        galleryItems[index].file = file;
        galleryItems[index].url = null;
        renderGallery();
    }
};