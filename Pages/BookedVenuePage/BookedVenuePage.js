document.addEventListener('DOMContentLoaded', async () => {
    // 1. Strict Database Session & Role Verification via HttpOnly Cookies BEFORE Loading Any Data
    let userRole = '';
    try {
        const profileRes = await fetch('/api/user/profile', {
            credentials: 'include' // <--- Sends the secure cookie automatically
        });

        if (!profileRes.ok) {
            throw new Error('Failed to verify session.');
        }

        const userData = await profileRes.json();
        userRole = userData.role || '';
        
        // Cache safe display values in localStorage
        localStorage.setItem('userRole', userRole);
        localStorage.setItem('userName', userData.name || '');

        // 2. Ensure only authorized roles (Students or Admins) can access this page
        if (userRole !== 'student' && userRole !== 'admin') {
            await handleUnauthorized('Access denied. Please log in as a student or administrator to view booked venues.');
            return;
        }

        // Session verification passed successfully. Initialize page with admin status flag.
        initBookedVenuesManagement(userRole === 'admin');

    } catch (err) {
        console.error('Security Check Error:', err);
        await handleUnauthorized('Session validation failed. Please log in.');
    }
});

// Helper function to handle unauthorized access securely
async function handleUnauthorized(message) {
    if (typeof window.showErrorModal === 'function') {
        await window.showErrorModal(message, 'Access Restricted');
    } else {
        alert(message);
    }
    window.location.href = '../LoginPage/LoginPage.html';
}

function initBookedVenuesManagement(isAdmin) {
    // --- Adapt UI Elements based on Role ---
    if (isAdmin) {
        const pageTitle = document.getElementById('pageTitle');
        const pageHeading = document.getElementById('pageHeading');
        const pageSubheading = document.getElementById('pageSubheading');
        const bookNewBtn = document.getElementById('bookNewBtn');
        const emptyStateTitle = document.getElementById('emptyStateTitle');
        const emptyStateDesc = document.getElementById('emptyStateDesc');
        const emptyStateBtn = document.getElementById('emptyStateBtn');

        if (pageTitle) pageTitle.textContent = 'All Confirmed Venue Bookings - Admin - Rhythm & Soul Dance Studio';
        if (pageHeading) pageHeading.innerHTML = `<i class="fa-solid fa-building-circle-check"></i> All Confirmed Venue Bookings`;
        if (pageSubheading) pageSubheading.textContent = 'View all confirmed private venue rentals across the studio.';
        if (bookNewBtn) bookNewBtn.style.display = 'none';

        if (emptyStateTitle) emptyStateTitle.textContent = 'No Confirmed Bookings Found';
        if (emptyStateDesc) emptyStateDesc.textContent = 'There are no confirmed venue bookings matching this filter criteria.';
        if (emptyStateBtn) emptyStateBtn.style.display = 'none';
    }

    let allRentals = [];

    const loadingIndicator = document.getElementById('loadingIndicator');
    const emptyState = document.getElementById('emptyState');
    const rentalsGrid = document.getElementById('rentalsGrid');

    // Filter Modal Elements
    const openFilterModal = document.getElementById('openFilterModal');
    const closeFilterModal = document.getElementById('closeFilterModal');
    const filterModal = document.getElementById('filterModal');
    const applyModalFilters = document.getElementById('applyModalFilters');
    const resetModalFilters = document.getElementById('resetModalFilters');
    const activeFiltersBadge = document.getElementById('activeFiltersBadge');

    const summaryDate = document.getElementById('summaryDate');
    const summaryVenue = document.getElementById('summaryVenue');

    const filterDateRangeMode = document.getElementById('filterDateRangeMode');
    const customDateContainer = document.getElementById('customDateContainer');
    const filterStartDate = document.getElementById('filterStartDate');
    const filterEndDate = document.getElementById('filterEndDate');
    const filterVenue = document.getElementById('filterVenue');

    // --- Modal Open/Close Event Listeners ---
    if (openFilterModal) openFilterModal.addEventListener('click', () => filterModal.style.display = 'flex');
    if (closeFilterModal) closeFilterModal.addEventListener('click', () => filterModal.style.display = 'none');
    window.addEventListener('click', (e) => { if (e.target === filterModal) filterModal.style.display = 'none'; });

    if (filterDateRangeMode) {
        filterDateRangeMode.addEventListener('change', () => {
            if (filterDateRangeMode.value === 'custom') {
                customDateContainer.style.display = 'flex';
                if (!filterStartDate.value) filterStartDate.value = new Date().toISOString().split('T')[0];
                if (!filterEndDate.value) {
                    const nextWeek = new Date();
                    nextWeek.setDate(nextWeek.getDate() + 7);
                    filterEndDate.value = nextWeek.toISOString().split('T')[0];
                }
            } else {
                customDateContainer.style.display = 'none';
            }
        });
    }

    // --- Load Venue Options for Filter ---
    async function loadVenues() {
        try {
            const res = await fetch('/api/venues');
            if (res.ok && filterVenue) {
                const venues = await res.json();
                venues.forEach(v => {
                    const opt = document.createElement('option');
                    opt.value = v.id;
                    opt.textContent = v.name;
                    filterVenue.appendChild(opt);
                });
            }
        } catch (err) {
            console.warn('Could not load venues for filters:', err);
        }
    }

    // --- Fetch Rentals ---
    async function fetchRentals() {
        try {
            const endpoint = isAdmin ? '/api/admin/venue-rentals' : '/api/user/rentals';
            const response = await fetch(endpoint, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to fetch venue rentals.');
            }

            allRentals = await response.json();
            if (loadingIndicator) loadingIndicator.style.display = 'none';
            applyFilters();
        } catch (err) {
            console.error('Error fetching rentals:', err);
            if (loadingIndicator) {
                loadingIndicator.innerHTML = '<p style="color: #ef4444;">Failed to load venue bookings. Please try again later.</p>';
            }
        }
    }

    // --- Apply Filters & Validation ---
    function applyFilters() {
        const rangeMode = filterDateRangeMode ? filterDateRangeMode.value : 'upcoming';
        const selectedVenueId = filterVenue ? filterVenue.value : '';
        const venueLabel = filterVenue && selectedVenueId ? filterVenue.options[filterVenue.selectedIndex].text : "All Venues";

        let rangeLabel = "Upcoming Bookings";
        if (rangeMode === 'past') rangeLabel = "Past Bookings";
        else if (rangeMode === 'all') rangeLabel = "All Bookings";
        else if (rangeMode === 'today') rangeLabel = "This Day (Today)";
        else if (rangeMode === 'week') rangeLabel = "This Week";
        else if (rangeMode === 'month') rangeLabel = "This Month";
        else if (rangeMode === 'custom') {
            const from = filterStartDate && filterStartDate.value ? filterStartDate.value : 'Start';
            const to = filterEndDate && filterEndDate.value ? filterEndDate.value : 'End';
            rangeLabel = `${from} to ${to}`;
        }

        if (summaryDate) summaryDate.textContent = rangeLabel;
        if (summaryVenue) summaryVenue.textContent = venueLabel;

        const isDefault = (rangeMode === 'upcoming' && !selectedVenueId);
        if (activeFiltersBadge) activeFiltersBadge.style.display = isDefault ? 'none' : 'inline-block';

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (rangeMode === 'past' && filterStartDate && filterStartDate.value) {
            const startVal = new Date(filterStartDate.value);
            startVal.setHours(0, 0, 0, 0);
            if (startVal > today) {
                if (typeof showErrorModal === 'function') {
                    showErrorModal('Error: The selected date is greater than today while Past Bookings is selected.');
                } else {
                    alert('Error: The selected date is greater than today while Past Bookings is selected.');
                }
                return;
            }
        } else if (rangeMode === 'upcoming' && filterStartDate && filterStartDate.value) {
            const startVal = new Date(filterStartDate.value);
            startVal.setHours(0, 0, 0, 0);
            if (startVal < today) {
                if (typeof showErrorModal === 'function') {
                    showErrorModal('Error: The selected date is less than today while Upcoming Bookings is selected.');
                } else {
                    alert('Error: The selected date is less than today while Upcoming Bookings is selected.');
                }
                return;
            }
        }

        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);

        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

        const filtered = allRentals.filter(rental => {
            const rentalDate = new Date(rental.rental_date);
            rentalDate.setHours(0, 0, 0, 0);

            let matchDate = true;
            if (rangeMode === 'upcoming') {
                matchDate = rentalDate >= today;
            } else if (rangeMode === 'past') {
                matchDate = rentalDate < today;
            } else if (rangeMode === 'all') {
                matchDate = true;
            } else if (rangeMode === 'today') {
                matchDate = rentalDate.getTime() === today.getTime();
            } else if (rangeMode === 'week') {
                matchDate = rentalDate >= startOfWeek && rentalDate <= endOfWeek;
            } else if (rangeMode === 'month') {
                matchDate = rentalDate >= startOfMonth && rentalDate <= endOfMonth;
            } else if (rangeMode === 'custom' && filterStartDate && filterEndDate) {
                const startVal = filterStartDate.value ? new Date(filterStartDate.value) : null;
                const endVal = filterEndDate.value ? new Date(filterEndDate.value) : null;
                if (startVal) startVal.setHours(0, 0, 0, 0);
                if (endVal) endVal.setHours(0, 0, 0, 0);

                if (startVal && endVal) matchDate = rentalDate >= startVal && rentalDate <= endVal;
                else if (startVal) matchDate = rentalDate >= startVal;
                else if (endVal) matchDate = rentalDate <= endVal;
            }

            const matchVenue = !selectedVenueId || String(rental.venue_id) === String(selectedVenueId);
            return matchDate && matchVenue;
        });

        renderRentals(filtered);
        if (filterModal) filterModal.style.display = 'none';
    }

    if (applyModalFilters) applyModalFilters.addEventListener('click', applyFilters);

    if (resetModalFilters) {
        resetModalFilters.addEventListener('click', () => {
            if (filterDateRangeMode) filterDateRangeMode.value = 'upcoming';
            if (customDateContainer) customDateContainer.style.display = 'none';
            if (filterStartDate) filterStartDate.value = '';
            if (filterEndDate) filterEndDate.value = '';
            if (filterVenue) filterVenue.value = '';
            applyFilters();
        });
    }

    // --- Render Rentals Grid ---
    function renderRentals(rentalsToRender) {
        if (!rentalsGrid) return;

        if (rentalsToRender.length === 0) {
            if (emptyState) emptyState.style.display = 'block';
            rentalsGrid.innerHTML = '';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';
        rentalsGrid.innerHTML = rentalsToRender.map(rental => {
            const dateObj = new Date(rental.rental_date);
            const formattedDate = dateObj.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                timeZone: 'UTC'
            });

            const formatTime = (timeStr) => {
                if (!timeStr) return '';
                const [hours, minutes] = timeStr.split(':');
                let h = parseInt(hours, 10);
                const ampm = h >= 12 ? 'PM' : 'AM';
                h = h % 12 || 12;
                return `${h}:${minutes} ${ampm}`;
            };

            const startTimeFormatted = formatTime(rental.start_time);
            const endTimeFormatted = formatTime(rental.end_time);

            const [startH, startM] = rental.start_time.split(':').map(Number);
            const [endH, endM] = rental.end_time.split(':').map(Number);
            const startTotalMins = startH * 60 + startM;
            const endTotalMins = endH * 60 + endM;
            const diffMins = endTotalMins - startTotalMins;

            const totalHours = Math.floor(diffMins / 60);
            const totalMins = diffMins % 60;

            let durationText = '';
            if (totalHours > 0) durationText += `${totalHours} hr${totalHours > 1 ? 's' : ''} `;
            if (totalMins > 0) durationText += `${totalMins} min${totalMins > 1 ? 's' : ''}`;
            if (!durationText) durationText = '0 mins';

            const totalHoursDecimal = diffMins / 60;
            const pricePerHour = totalHoursDecimal > 0 ? (Number(rental.total_price) / totalHoursDecimal) : 0;

            const renterInfoHTML = isAdmin ? `
                <div class="detail-row">
                    <i class="fa-solid fa-user"></i>
                    <span>Renter: <strong>${rental.renter_name || 'N/A'}</strong> (${rental.renter_email || ''})</span>
                </div>
            ` : '';

            return `
                <div class="rental-card">
                    <div>
                        <div class="rental-card-top">
                            <h3 class="venue-name">${rental.venue_name}</h3>
                            <span class="status-badge ${rental.status}">${rental.status}</span>
                        </div>
                        <div class="rental-details">
                            ${renterInfoHTML}
                            <div class="detail-row">
                                <i class="fa-solid fa-calendar"></i>
                                <span>${formattedDate}</span>
                            </div>
                            <div class="detail-row">
                                <i class="fa-solid fa-clock"></i>
                                <span>${startTimeFormatted} - ${endTimeFormatted}</span>
                            </div>
                            <div class="detail-row">
                                <i class="fa-solid fa-hourglass-half"></i>
                                <span>Duration: <strong>${durationText.trim()}</strong></span>
                            </div>
                            <div class="detail-row">
                                <i class="fa-solid fa-tag"></i>
                                <span>Rate: <strong>₱${pricePerHour.toFixed(2)} / hr</strong></span>
                            </div>
                        </div>
                    </div>
                    <div class="rental-card-footer">
                        <div>
                            <span class="price-label">Total Paid</span>
                            <div class="price-value">₱${Number(rental.total_price).toFixed(2)}</div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    loadVenues();
    fetchRentals();
}