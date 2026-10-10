document.addEventListener('DOMContentLoaded', async () => {
    // 1. Strict Database Role Verification via HttpOnly Cookies BEFORE Loading Any Data
    try {
        const profileRes = await secureFetch('/api/user/profile', {
            credentials: 'include' // <--- Sends the secure cookie automatically
        });

        if (!profileRes.ok) {
            throw new Error('Failed to verify session.');
        }

        const userData = await profileRes.json();

        if (userData.role !== 'admin') {
            await handleUnauthorized('Access denied. Administrator privileges required to access Venue Management.');
            return;
        }

        // Admin verification passed successfully. Proceed to initialize page data.
        initVenueManagement();

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

function initVenueManagement() {
    const venueTableBody = document.getElementById('venueTableBody');

    async function fetchVenues() {
        try {
            // Fetch from admin endpoint to see both active and inactive venues
            const res = await secureFetch('/api/admin/venues', {
                credentials: 'include'
            });
            if (!res.ok) throw new Error('Failed to fetch venues.');
            const venues = await res.json();
            renderVenues(venues);
        } catch (err) {
            console.error('Error fetching venues:', err);
            venueTableBody.innerHTML = `<tr><td colspan="7" class="empty-row" style="color: #f87171;">Failed to load venues. Please try again.</td></tr>`;
        }
    }

    function renderVenues(venues) {
        if (venues.length === 0) {
            venueTableBody.innerHTML = `<tr><td colspan="7" class="empty-row">No venues found.</td></tr>`;
            return;
        }

        venueTableBody.innerHTML = venues.map(venue => {
            const locationDisplay = venue.location || '<span style="color: #64748b; font-style: italic;">No location specified</span>';
            const mapLinkHtml = venue.location_link 
                ? `<a href="${venue.location_link}" target="_blank" class="map-link"><i class="fa-solid fa-map-location-dot"></i> View Map</a>`
                : '<span style="color: #64748b; font-style: italic;">N/A</span>';

            const hourlyRate = venue.hourly_rate 
                ? `₱${Number(venue.hourly_rate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                : '₱1,500.00';

            const isActive = venue.is_active !== undefined ? venue.is_active : 1;
            const statusBadge = isActive 
                ? `<span style="background: rgba(16, 185, 129, 0.15); color: #34d399; padding: 4px 10px; border-radius: 20px; font-size: 0.85rem; font-weight: 600;">Active</span>`
                : `<span style="background: rgba(239, 68, 68, 0.15); color: #f87171; padding: 4px 10px; border-radius: 20px; font-size: 0.85rem; font-weight: 600;">Inactive</span>`;

            const toggleActionTitle = isActive ? 'Deactivate Venue' : 'Activate Venue';
            const toggleBtnClass = isActive ? 'btn-deactivate' : 'btn-activate';
            const toggleIcon = isActive ? '<i class="fa-solid fa-ban"></i>' : '<i class="fa-solid fa-check"></i>';
            const nextStatus = isActive ? 0 : 1;

            const createdDate = venue.created_at ? new Date(venue.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';

            return `
                <tr>
                    <td><strong>${venue.name}</strong></td>
                    <td>${locationDisplay}</td>
                    <td>${mapLinkHtml}</td>
                    <td><strong style="color: #10b981;">${hourlyRate}</strong></td>
                    <td>${statusBadge}</td>
                    <td>${createdDate}</td>
                    <td class="action-buttons-cell">
                        <div class="action-buttons-wrapper">
                            <a href="../VenueBuilderPage/VenueBuilderPage.html?id=${venue.id}" class="btn-action btn-edit" title="Edit Venue">
                                <i class="fa-solid fa-pen-to-square"></i>
                            </a>
                            <button class="btn-action ${toggleBtnClass}" onclick="toggleVenueStatus(${venue.id}, '${venue.name.replace(/'/g, "\\'")}', ${nextStatus})" title="${toggleActionTitle}">
                                ${toggleIcon}
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    window.toggleVenueStatus = async function(venueId, venueName, newStatus) {
        const actionWord = newStatus === 1 ? 'activate' : 'deactivate';
        const confirmed = typeof window.showConfirmModal === 'function'
            ? await window.showConfirmModal(`Are you sure you want to ${actionWord} venue "${venueName}"?`, `Confirm Status Change`, 'Confirm', 'Cancel')
            : confirm(`Are you sure you want to ${actionWord} venue "${venueName}"?`);

        if (!confirmed) return;

        try {
            // Fixed: Moved credentials out of headers and into the top-level fetch configuration object
            const res = await secureFetch(`/api/admin/venues/${venueId}/status`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json'
                },
                credentials: 'include', 
                body: JSON.stringify({ is_active: newStatus })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to update venue status.');

            if (typeof window.showSuccessModal === 'function') {
                await window.showSuccessModal(data.message, 'Success');
            } else {
                alert(data.message);
            }

            fetchVenues();
        } catch (err) {
            console.error('Toggle Status Error:', err);
            if (typeof window.showErrorModal === 'function') {
                window.showErrorModal(err.message, 'Error');
            } else {
                alert(err.message);
            }
        }
    };

    fetchVenues();
}