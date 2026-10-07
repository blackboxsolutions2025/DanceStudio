document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '../LoginPage/LoginPage.html';
        return;
    }

    let allAttendanceData = [];

    const container = document.getElementById('attendanceCardsContainer');
    const emptyState = document.getElementById('emptyState');

    // Filter Modal Elements
    const openFilterModal = document.getElementById('openFilterModal');
    const closeFilterModal = document.getElementById('closeFilterModal');
    const filterModal = document.getElementById('filterModal');
    const applyModalFilters = document.getElementById('applyModalFilters');
    const resetModalFilters = document.getElementById('resetModalFilters');
    const activeFiltersBadge = document.getElementById('activeFiltersBadge');

    const summaryDate = document.getElementById('summaryDate');
    const summaryGenre = document.getElementById('summaryGenre');
    const summaryCoach = document.getElementById('summaryCoach');
    const summaryVenue = document.getElementById('summaryVenue');

    const filterDateRangeMode = document.getElementById('filterDateRangeMode');
    const customDateContainer = document.getElementById('customDateContainer');
    const filterStartDate = document.getElementById('filterStartDate');
    const filterEndDate = document.getElementById('filterEndDate');
    const filterGenre = document.getElementById('filterGenre');
    const filterCoach = document.getElementById('filterCoach');
    const filterVenue = document.getElementById('filterVenue');

    const metricTotalClasses = document.getElementById('metricTotalClasses');
    const metricAttendedClasses = document.getElementById('metricAttendedClasses');
    const metricMissedClasses = document.getElementById('metricMissedClasses');

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

    // --- Load Filter Options (Genres, Coaches, Venues) ---
    async function loadFilterOptions() {
        try {
            const [genreRes, coachRes, venueRes] = await Promise.all([
                fetch('/api/genres'), fetch('/api/coaches'), fetch('/api/venues')
            ]);

            if (genreRes.ok && filterGenre) {
                const genres = await genreRes.json();
                genres.forEach(g => {
                    const opt = document.createElement('option');
                    opt.value = g.id; opt.textContent = g.name; filterGenre.appendChild(opt);
                });
            }

            if (coachRes.ok && filterCoach) {
                const coaches = await coachRes.json();
                coaches.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c.id; opt.textContent = c.name; filterCoach.appendChild(opt);
                });
            }

            if (venueRes.ok && filterVenue) {
                const venues = await venueRes.json();
                venues.forEach(v => {
                    const opt = document.createElement('option');
                    opt.value = v.id; opt.textContent = v.name; filterVenue.appendChild(opt);
                });
            }
        } catch (err) {
            console.warn('Could not load dynamic filter options from server:', err);
        }
    }

    async function fetchAttendanceData() {
        try {
            container.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 50px; color: var(--text-muted);">
                    <i class="fa-solid fa-spinner fa-spin fa-2x"></i>
                    <p style="margin-top: 10px;">Loading your attendance art cards...</p>
                </div>
            `;

            const response = await fetch('/api/user/schedule', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Failed to fetch attendance schedule.');

            allAttendanceData = await response.json();
            applyFilters();
        } catch (err) {
            console.error('Error loading attendance:', err);
            container.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 50px; color: var(--accent-red);">
                    <i class="fa-solid fa-triangle-exclamation fa-2x"></i>
                    <p style="margin-top: 10px;">Could not load attendance data. Please try again.</p>
                </div>
            `;
        }
    }

    function updateSummaryCardDisplay(rangeMode, genreText, coachText, venueText) {
        let rangeLabel = "Upcoming Classes";
        if (rangeMode === 'past') rangeLabel = "Past Classes";
        else if (rangeMode === 'all') rangeLabel = "All Classes";
        else if (rangeMode === 'today') rangeLabel = "This Day";
        else if (rangeMode === 'week') rangeLabel = "This Week";
        else if (rangeMode === 'month') rangeLabel = "This Month";
        else if (rangeMode === 'custom') {
            const from = filterStartDate && filterStartDate.value ? filterStartDate.value : 'Start';
            const to = filterEndDate && filterEndDate.value ? filterEndDate.value : 'End';
            rangeLabel = `${from} to ${to}`;
        }

        if (summaryDate) summaryDate.textContent = rangeLabel;
        if (summaryGenre) summaryGenre.textContent = genreText;
        if (summaryCoach) summaryCoach.textContent = coachText;
        if (summaryVenue) summaryVenue.textContent = venueText;
        
        const isDefault = (
            rangeMode === 'upcoming' && 
            (!filterGenre || filterGenre.value === '') && 
            (!filterCoach || filterCoach.value === '') &&
            (!filterVenue || filterVenue.value === '')
        );
        if (activeFiltersBadge) activeFiltersBadge.style.display = isDefault ? 'none' : 'inline-block';
    }

    function applyFilters() {
        const rangeMode = filterDateRangeMode ? filterDateRangeMode.value : 'upcoming';
        const selectedGenre = filterGenre ? filterGenre.value : '';
        const selectedCoach = filterCoach ? filterCoach.value : '';
        const selectedVenue = filterVenue ? filterVenue.value : '';

        const genreLabel = filterGenre && selectedGenre ? filterGenre.options[filterGenre.selectedIndex].text : "All Genres";
        const coachLabel = filterCoach && selectedCoach ? filterCoach.options[filterCoach.selectedIndex].text : "All Coaches";
        const venueLabel = filterVenue && selectedVenue ? filterVenue.options[filterVenue.selectedIndex].text : "All Venues";

        updateSummaryCardDisplay(rangeMode, genreLabel, coachLabel, venueLabel);

        const now = new Date();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Date range validation rules
        if (rangeMode === 'past' && filterStartDate && filterStartDate.value) {
            const startVal = new Date(filterStartDate.value);
            startVal.setHours(0, 0, 0, 0);
            if (startVal > today) {
                if (typeof showErrorModal === 'function') {
                    showErrorModal('Error: The selected date is greater than today while Past Classes is selected.');
                } else {
                    alert('Error: The selected date is greater than today while Past Classes is selected.');
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

        const processed = allAttendanceData.map(item => {
            const classDate = new Date(item.schedule_date + 'T' + item.start_time);
            const isPast = classDate < now;

            let computedStatus = item.attendance_status;
            if (computedStatus === 'none' && isPast) computedStatus = 'absent';
            else if (computedStatus === 'none' && !isPast) computedStatus = 'upcoming';

            return { ...item, computedStatus, isPast };
        });

        // Compute Metrics on all processed items
        const total = processed.length;
        const attended = processed.filter(i => i.computedStatus === 'completed' || i.computedStatus === 'timed_in').length;
        const missed = processed.filter(i => i.computedStatus === 'absent').length;

        metricTotalClasses.textContent = total;
        metricAttendedClasses.textContent = attended;
        metricMissedClasses.textContent = missed;

        // Apply filters
        const filtered = processed.filter(item => {
            const clsDate = new Date(item.schedule_date);
            clsDate.setHours(0, 0, 0, 0);

            let matchDate = true;

            if (rangeMode === 'upcoming') {
                matchDate = clsDate >= today;
            } else if (rangeMode === 'past') {
                matchDate = clsDate < today;
            } else if (rangeMode === 'all') {
                matchDate = true;
            } else if (rangeMode === 'today') {
                matchDate = clsDate.getTime() === today.getTime();
            } else if (rangeMode === 'week') {
                matchDate = clsDate >= startOfWeek && clsDate <= endOfWeek;
            } else if (rangeMode === 'month') {
                matchDate = clsDate >= startOfMonth && clsDate <= endOfMonth;
            } else if (rangeMode === 'custom' && filterStartDate && filterEndDate) {
                const startVal = filterStartDate.value ? new Date(filterStartDate.value) : null;
                const endVal = filterEndDate.value ? new Date(filterEndDate.value) : null;
                if (startVal) startVal.setHours(0, 0, 0, 0);
                if (endVal) endVal.setHours(0, 0, 0, 0);

                if (startVal && endVal) {
                    matchDate = clsDate >= startVal && clsDate <= endVal;
                } else if (startVal) {
                    matchDate = clsDate >= startVal;
                } else if (endVal) {
                    matchDate = clsDate <= endVal;
                }
            }

            const matchGenre = !selectedGenre || String(item.genreid) === String(selectedGenre);
            const matchCoach = !selectedCoach || String(item.coach_id) === String(selectedCoach);
            const matchVenue = !selectedVenue || String(item.venue_id) === String(selectedVenue);

            return matchDate && matchGenre && matchCoach && matchVenue;
        });

        renderArtCards(filtered);
        if (filterModal) filterModal.style.display = 'none';
    }

    if (applyModalFilters) applyModalFilters.addEventListener('click', applyFilters);

    if (resetModalFilters) {
        resetModalFilters.addEventListener('click', () => {
            if (filterDateRangeMode) filterDateRangeMode.value = 'upcoming';
            if (customDateContainer) customDateContainer.style.display = 'none';
            if (filterStartDate) filterStartDate.value = '';
            if (filterEndDate) filterEndDate.value = '';
            if (filterGenre) filterGenre.value = '';
            if (filterCoach) filterCoach.value = '';
            if (filterVenue) filterVenue.value = '';
            applyFilters();
        });
    }

    function formatTime12h(timeStr) {
        if (!timeStr) return 'N/A';
        const [hours, minutes] = timeStr.split(':');
        let h = parseInt(hours, 10);
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${h}:${minutes} ${ampm}`;
    }

    function formatDateDisplay(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    }

    function formatTimestamp(ts) {
        if (!ts) return 'Not recorded';
        const d = new Date(ts);
        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }

    function renderArtCards(items) {
        if (items.length === 0) {
            container.innerHTML = '';
            emptyState.classList.remove('hidden');
            return;
        }

        emptyState.classList.add('hidden');

        container.innerHTML = items.map(item => {
            let statusClass = 'upcoming';
            let statusText = 'Upcoming Class';
            let statusIcon = 'fa-clock';
            let actualFillClass = 'actual-present';

            if (item.computedStatus === 'completed') {
                statusClass = 'completed';
                statusText = 'Present / Completed';
                statusIcon = 'fa-circle-check';
                actualFillClass = 'actual-present';
            } else if (item.computedStatus === 'timed_in') {
                statusClass = 'timed_in';
                statusText = 'Timed-In (Active)';
                statusIcon = 'fa-spinner fa-spin';
                actualFillClass = 'actual-ongoing';
            } else if (item.computedStatus === 'absent') {
                statusClass = 'absent';
                statusText = 'Absent / Missed';
                statusIcon = 'fa-circle-xmark';
                actualFillClass = 'actual-absent';
            }

            const formattedDate = formatDateDisplay(item.schedule_date);
            const startTimeFormatted = formatTime12h(item.start_time);
            const endTimeFormatted = formatTime12h(item.end_time);
            const timeInFormatted = formatTimestamp(item.time_in);
            const timeOutFormatted = formatTimestamp(item.time_out);

            const overrideNoticeHtml = item.is_overridden ? `
                <div class="override-notice-box">
                    <div class="override-notice-header">
                        <i class="fa-solid fa-user-shield"></i> Overridden by ${item.overridden_by_name || 'Coach / Admin'}
                    </div>
                    <div class="override-reason-text">
                        <strong>Reason:</strong> ${item.override_reason || 'No reason provided'}
                    </div>
                </div>
            ` : '';

            return `
                <div class="attendance-art-card ${statusClass}">
                    <!-- Card Top Header -->
                    <div class="card-header-flex">
                        <div class="class-title-area">
                            <span class="class-date-badge"><i class="fa-solid fa-calendar-day"></i> ${formattedDate}</span>
                            <h3>${item.title}</h3>
                        </div>
                        <div class="status-pill ${statusClass}">
                            <i class="fa-solid ${statusIcon}"></i> ${statusText}
                        </div>
                    </div>

                    <!-- Details Grid -->
                    <div class="card-details-box">
                        <div class="detail-block">
                            <span class="detail-label"><i class="fa-solid fa-music"></i> Genre</span>
                            <span class="detail-val">${item.genre_name}</span>
                        </div>
                        <div class="detail-block">
                            <span class="detail-label"><i class="fa-solid fa-chalkboard-user"></i> Coach</span>
                            <span class="detail-val">${item.coach_name}</span>
                        </div>
                        <div class="detail-block">
                            <span class="detail-label"><i class="fa-solid fa-location-dot"></i> Venue</span>
                            <span class="detail-val">${item.venue_name}</span>
                        </div>
                        <div class="detail-block">
                            <span class="detail-label"><i class="fa-solid fa-clock"></i> Schedule</span>
                            <span class="detail-val">${startTimeFormatted} - ${endTimeFormatted}</span>
                        </div>
                    </div>

                    <!-- Coach Override Notice (If Applicable) -->
                    ${overrideNoticeHtml}

                    <!-- Time Comparison Widget -->
                    <div class="art-card-timeline">
                        <div class="timeline-title">
                            <i class="fa-solid fa-chart-line"></i> Attendance Comparison
                        </div>
                        <div class="timeline-row">
                            <div class="timeline-label-row">
                                <span>Scheduled Window</span>
                                <strong>${startTimeFormatted} – ${endTimeFormatted}</strong>
                            </div>
                            <div class="timeline-track">
                                <div class="timeline-fill scheduled" style="width: 100%;"></div>
                            </div>
                        </div>
                        <div class="timeline-row">
                            <div class="timeline-label-row">
                                <span>Actual Window</span>
                                <strong>${item.time_in ? `${timeInFormatted} to${item.time_out ? timeOutFormatted : 'Active'}` : 'No timestamp logged'}</strong>
                            </div>
                            <div class="timeline-track">
                                <div class="timeline-fill ${actualFillClass}" style="width: ${item.time_in ? '100%' : '0%'};"></div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    loadFilterOptions();
    fetchAttendanceData();
});