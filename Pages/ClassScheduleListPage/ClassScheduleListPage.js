document.addEventListener('DOMContentLoaded', async () => {
    // 1. Strict Database Role Verification via HttpOnly Cookies BEFORE Loading Any Data
    try {
        const profileRes = await fetch('/api/user/profile', {
            credentials: 'include' // <--- Sends the secure cookie automatically
        });

        if (!profileRes.ok) {
            throw new Error('Failed to verify session.');
        }

        const userData = await profileRes.json();

        if (userData.role !== 'admin') {
            await handleUnauthorized('Access denied. Administrator privileges required to access Class Schedule Management.');
            return;
        }

        // Admin verification passed successfully. Proceed to initialize page data.
        initClassScheduleManagement();

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

function initClassScheduleManagement() {
    const classTableBody = document.getElementById('classTableBody');
    
    // Filter Modal Elements
    const filterModal = document.getElementById('filterModal');
    const openFilterModalBtn = document.getElementById('openFilterModalBtn');
    const closeFilterModalBtn = document.getElementById('closeFilterModalBtn');
    const modalApplyBtn = document.getElementById('modalApplyBtn');
    const modalResetBtn = document.getElementById('modalResetBtn');
    
    // Attendees Modal Elements
    const attendeesModal = document.getElementById('attendeesModal');
    const closeAttendeesModalBtn = document.getElementById('closeAttendeesModalBtn');
    const closeAttendeesFooterBtn = document.getElementById('closeAttendeesFooterBtn');
    const attendeesListContainer = document.getElementById('attendeesListContainer');

    // Modal Input Elements
    const modalDateFilter = document.getElementById('modalDateFilter');
    const modalCoachFilter = document.getElementById('modalCoachFilter');
    const modalGenreFilter = document.getElementById('modalGenreFilter');
    const modalVenueFilter = document.getElementById('modalVenueFilter');

    // UI Feedback Elements
    const valDate = document.getElementById('valDate');
    const valCoach = document.getElementById('valCoach');
    const valGenre = document.getElementById('valGenre');
    const valVenue = document.getElementById('valVenue');
    const badgeDate = document.getElementById('badgeDate');
    const badgeCoach = document.getElementById('badgeCoach');
    const badgeGenre = document.getElementById('badgeGenre');
    const badgeVenue = document.getElementById('badgeVenue');

    // State object for active filters
    let activeFilters = {
        date: '',
        coach: '',
        genre: '',
        venue: ''
    };

    // Store coach, genre, and venue names for summary display
    let coachMap = {};
    let genreMap = {};
    let venueMap = {};

    // 1. Populate Dropdowns from API endpoints
    async function loadFilterOptions() {
        try {
            const coachesRes = await fetch('/api/coaches');
            if (coachesRes.ok) {
                const coaches = await coachesRes.json();
                coaches.forEach(coach => {
                    coachMap[coach.id] = coach.name;
                    const option = document.createElement('option');
                    option.value = coach.id;
                    option.textContent = coach.name;
                    modalCoachFilter.appendChild(option);
                });
            }

            const genresRes = await fetch('/api/genres');
            if (genresRes.ok) {
                const genres = await genresRes.json();
                genres.forEach(genre => {
                    genreMap[genre.id] = genre.name;
                    const option = document.createElement('option');
                    option.value = genre.id;
                    option.textContent = genre.name;
                    modalGenreFilter.appendChild(option);
                });
            }

            const venuesRes = await fetch('/api/venues');
            if (venuesRes.ok) {
                const venues = await venuesRes.json();
                venues.forEach(venue => {
                    venueMap[venue.id] = venue.name;
                    const option = document.createElement('option');
                    option.value = venue.id;
                    option.textContent = venue.name;
                    modalVenueFilter.appendChild(option);
                });
            }
        } catch (err) {
            console.error('Error loading filter options:', err);
        }
    }

    // 2. Fetch and render classes based on active filters
    async function fetchClasses() {
        try {
            const params = new URLSearchParams();
            if (activeFilters.date) params.append('date', activeFilters.date);
            if (activeFilters.coach) params.append('coach', activeFilters.coach);
            if (activeFilters.genre) params.append('genre', activeFilters.genre);
            if (activeFilters.venue) params.append('venue', activeFilters.venue);

            const response = await fetch(`/api/classes?${params.toString()}`);
            if (!response.ok) throw new Error('Failed to fetch classes.');

            const classes = await response.json();
            renderTable(classes);
            updateFilterSummary();
        } catch (err) {
            console.error('Fetch classes error:', err);
            classTableBody.innerHTML = `<tr><td colspan="6" class="error-row">Failed to load classes. Please try again.</td></tr>`;
        }
    }

    // 3. Update Filter Summary Cards
    function updateFilterSummary() {
        if (activeFilters.date) {
            const formattedDate = new Date(activeFilters.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            valDate.textContent = formattedDate;
            badgeDate.classList.add('active');
        } else {
            valDate.textContent = 'All Upcoming Dates';
            badgeDate.classList.remove('active');
        }

        if (activeFilters.coach) {
            valCoach.textContent = coachMap[activeFilters.coach] || 'Selected';
            badgeCoach.classList.add('active');
        } else {
            valCoach.textContent = 'All Instructors';
            badgeCoach.classList.remove('active');
        }

        if (activeFilters.genre) {
            valGenre.textContent = genreMap[activeFilters.genre] || 'Selected';
            badgeGenre.classList.add('active');
        } else {
            valGenre.textContent = 'All Styles';
            badgeGenre.classList.remove('active');
        }

        if (activeFilters.venue) {
            valVenue.textContent = venueMap[activeFilters.venue] || 'Selected';
            badgeVenue.classList.add('active');
        } else {
            valVenue.textContent = 'All Venues';
            badgeVenue.classList.remove('active');
        }
    }

    // 4. Render table rows dynamically
    function renderTable(classes) {
        if (classes.length === 0) {
            classTableBody.innerHTML = `<tr><td colspan="6" class="empty-row">No classes found matching the selected filters.</td></tr>`;
            return;
        }

        classTableBody.innerHTML = classes.map(cls => {
            const formatTime = (timeStr) => {
                if (!timeStr) return '';
                const [hours, minutes] = timeStr.split(':');
                const h = parseInt(hours, 10);
                const ampm = h >= 12 ? 'PM' : 'AM';
                const formattedHours = h % 12 || 12;
                return `${formattedHours}:${minutes} ${ampm}`;
            };

            const formattedDate = new Date(cls.schedule_date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });

            const timeDisplay = `<strong>${formattedDate}</strong><br><small class="schedule-time">${formatTime(cls.start_time)} - ${formatTime(cls.end_time)}</small>`;   
            const classInfo = `<strong class="class-title-truncate" title="${cls.title}">${cls.title}</strong><span class="genre-badge" title="${cls.genre_name}">${cls.genre_name}</span>`;   
            const instructor = cls.coach_name || 'Unassigned';   
            
            const venueName = cls.venue_name || 'Main Studio';   
            const capacityBadge = `<span class="slots-badge ${cls.slots_remaining === 0 ? 'full' : ''}">${cls.slots_remaining} / ${cls.capacity}</span>`;   
            const venueDisplay = `<strong>${venueName}</strong><br>${capacityBadge}`;   

            const price = `₱${parseFloat(cls.price).toFixed(2)}`;

            return `
                <tr>
                    <td>${timeDisplay}</td>
                    <td>${classInfo}</td>
                    <td>${instructor}</td>
                    <td>${venueDisplay}</td>
                    <td>${price}</td>
                    <td class="action-buttons-cell">
                        <div class="action-buttons-wrapper">
                            <button class="btn-action btn-view" title="View Attendees" onclick="viewAttendees(${cls.id}, '${cls.title.replace(/'/g, "\\'")}')">
                                <i class="fa-solid fa-users"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // 5. Filter Modal Interaction Handlers
    openFilterModalBtn.addEventListener('click', () => {
        modalDateFilter.value = activeFilters.date;
        modalCoachFilter.value = activeFilters.coach;
        modalGenreFilter.value = activeFilters.genre;
        modalVenueFilter.value = activeFilters.venue;
        filterModal.classList.add('active');
    });

    const closeFilterModal = () => filterModal.classList.remove('active');
    closeFilterModalBtn.addEventListener('click', closeFilterModal);
    filterModal.addEventListener('click', (e) => {
        if (e.target === filterModal) closeFilterModal();
    });

    modalApplyBtn.addEventListener('click', () => {
        activeFilters.date = modalDateFilter.value;
        activeFilters.coach = modalCoachFilter.value;
        activeFilters.genre = modalGenreFilter.value;
        activeFilters.venue = modalVenueFilter.value;
        closeFilterModal();
        fetchClasses();
    });

    modalResetBtn.addEventListener('click', () => {
        modalDateFilter.value = '';
        modalCoachFilter.value = '';
        modalGenreFilter.value = '';
        modalVenueFilter.value = '';
    });

    // 6. Attendees Modal Handlers
    const closeAttendeesModal = () => attendeesModal.classList.remove('active');
    if (closeAttendeesModalBtn) closeAttendeesModalBtn.addEventListener('click', closeAttendeesModal);
    if (closeAttendeesFooterBtn) closeAttendeesFooterBtn.addEventListener('click', closeAttendeesModal);
    if (attendeesModal) {
        attendeesModal.addEventListener('click', (e) => {
            if (e.target === attendeesModal) closeAttendeesModal();
        });
    }

    window.viewAttendees = async (classId, classTitle) => {
        attendeesListContainer.innerHTML = '<p style="text-align: center; color: #94a3b8; padding: 20px;">Loading attendees...</p>';
        attendeesModal.classList.add('active');

        try {
            const res = await fetch(`/api/classes/${classId}/attendees`, {
                credentials: 'include' // Uses HttpOnly cookie session securely
            });
            if (!res.ok) throw new Error('Failed to fetch attendees.');
            const attendees = await res.json();

            if (attendees.length === 0) {
                attendeesListContainer.innerHTML = '<p style="text-align: center; color: #94a3b8; padding: 20px;">No students enrolled in this class yet.</p>';
                return;
            }

            attendeesListContainer.innerHTML = `
                <h4 style="margin-top: 0; color: #10b981; font-size: 1.15rem; margin-bottom: 20px; text-align: center; font-weight: 700;">${classTitle}</h4>
                <div class="attendees-list-wrapper">
                    ${attendees.map(att => {
                        const avatar = att.profile_image 
                            ? `<img src="${att.profile_image}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;" alt="Avatar">`
                            : `<div style="width: 40px; height: 40px; border-radius: 50%; background: rgba(16,185,129,0.2); color: #10b981; display: flex; align-items: center; justify-content: center; font-weight: bold;"><i class="fa-solid fa-user"></i></div>`;
                        
                        const phoneStr = att.phone || 'No phone provided';

                        return `
                            <div class="attendee-row-card">
                                <div style="display: flex; align-items: center; gap: 12px; width: 100%;">
                                    ${avatar}
                                    <div style="display: flex; flex-direction: column; gap: 3px; width: 100%;">
                                        <strong style="color: #ffffff; font-size: 0.95rem;">${att.name}</strong>
                                        <small style="color: #94a3b8; word-break: break-all;">${att.email}</small>
                                        <a href="#" class="attendee-phone-link" onclick="handlePhoneClick('${phoneStr.replace(/'/g, "\\'")}'); return false;" style="font-size: 0.85rem; font-weight: 600;">
                                            <i class="fa-solid fa-phone"></i> ${phoneStr}
                                        </a>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        } catch (err) {
            console.error('Error fetching attendees:', err);
            attendeesListContainer.innerHTML = '<p style="text-align: center; color: #f87171; padding: 20px;">Failed to load attendees list.</p>';
        }
    };

    window.handlePhoneClick = async (phone) => {
        if (!phone || phone === 'No phone provided') return;
        const cleanPhone = phone.trim();
        
        let callAction = false;
        if (typeof window.showConfirmModal === 'function') {
            callAction = await window.showConfirmModal(
                `Would you like to call or copy the phone number: ${cleanPhone}?`,
                'Contact Student',
                'Call',
                'Copy'
            );
        } else {
            callAction = confirm(`Phone Number: ${cleanPhone}\n\nClick OK to Call, or Cancel to Copy.`);
        }

        if (callAction) {
            window.location.href = `tel:${cleanPhone}`;
        } else {
            navigator.clipboard.writeText(cleanPhone).then(() => {
                if (typeof window.showSuccessModal === 'function') {
                    window.showSuccessModal(`Copied "${cleanPhone}" toclipboard!`, 'Copied');
                } else {
                    alert(`Copied "${cleanPhone}" to clipboard!`);
                }
            }).catch(err => {
                console.error('Failed to copy text: ', err);
                alert('Failed to copy phone number.');
            });
        }
    };

    // Initial Execution
    loadFilterOptions();
    fetchClasses();
}