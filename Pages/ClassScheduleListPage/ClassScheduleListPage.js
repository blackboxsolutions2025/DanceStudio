document.addEventListener('DOMContentLoaded', () => {
    const classTableBody = document.getElementById('classTableBody');
    
    // Modal Elements
    const filterModal = document.getElementById('filterModal');
    const openFilterModalBtn = document.getElementById('openFilterModalBtn');
    const closeFilterModalBtn = document.getElementById('closeFilterModalBtn');
    const modalApplyBtn = document.getElementById('modalApplyBtn');
    const modalResetBtn = document.getElementById('modalResetBtn');
    
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
            // Fetch Coaches[cite: 52]
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

            // Fetch Genres[cite: 52]
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

            // Fetch Venues
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

    // 2. Fetch and render classes based on active filters[cite: 52]
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
            
            // Combined Venue Name on top and Capacity Badge at the bottom   
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
                            <button class="btn-action btn-view" title="View Attendees" onclick="viewAttendees(${cls.id})">
                                <i class="fa-solid fa-users"></i>
                            </button>
                            <button class="btn-action btn-edit" title="Edit Class" onclick="editClass(${cls.id})">
                                <i class="fa-solid fa-pen-to-square"></i>
                            </button>
                            <button class="btn-action btn-delete" title="Delete Class" onclick="deleteClass(${cls.id})">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // 5. Modal Interaction Handlers
    openFilterModalBtn.addEventListener('click', () => {
        modalDateFilter.value = activeFilters.date;
        modalCoachFilter.value = activeFilters.coach;
        modalGenreFilter.value = activeFilters.genre;
        modalVenueFilter.value = activeFilters.venue;
        filterModal.classList.add('active');
    });

    const closeModal = () => {
        filterModal.classList.remove('active');
    };

    closeFilterModalBtn.addEventListener('click', closeModal);
    filterModal.addEventListener('click', (e) => {
        if (e.target === filterModal) closeModal();
    });

    modalApplyBtn.addEventListener('click', () => {
        activeFilters.date = modalDateFilter.value;
        activeFilters.coach = modalCoachFilter.value;
        activeFilters.genre = modalGenreFilter.value;
        activeFilters.venue = modalVenueFilter.value;
        closeModal();
        fetchClasses();
    });

    modalResetBtn.addEventListener('click', () => {
        modalDateFilter.value = '';
        modalCoachFilter.value = '';
        modalGenreFilter.value = '';
        modalVenueFilter.value = '';
    });

    // Global Utility Action Handlers
    window.viewAttendees = (classId) => {
        alert(`Opening attendee list for class ID: ${classId}`);
    };

    window.editClass = (classId) => {
        window.location.href = `../ClassScheduleBuilderPage/ClassScheduleBuilderPage.html?edit=${classId}`;
    };

    window.deleteClass = async (classId) => {
        if (confirm('Are you sure you want to delete this class schedule?')) {
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`/api/classes/${classId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    fetchClasses();
                } else {
                    const data = await res.json();
                    alert(data.message || 'Failed to delete class.');
                }
            } catch (err) {
                console.error('Delete error:', err);
                alert('Server error while deleting class.');
            }
        }
    };

    // Initial Execution
    loadFilterOptions();
    fetchClasses();
});